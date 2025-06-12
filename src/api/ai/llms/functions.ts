import {ChatMessage} from "../../../models/chat/ChatMessage";
import {Signal} from "@targoninc/jess";
import {broadcastToUser, ongoingConversations} from "../../websocket-server/websocket.ts";
import {BotanikaServerEventType} from "../../../models/websocket/serverEvents/botanikaServerEventType.ts";
import {CLI} from "../../CLI.ts";

export async function updateMessageFromStream(message: Signal<ChatMessage>, stream: AsyncIterable<string> & ReadableStream<string>, text: Promise<string>, chatId: string, userId: string) {
    const reader = stream.getReader();

    while (true) {
        const { value, done } = await reader.read();
        const m = message.value;
        if (done) {
            break;
        }

        message.value = {
            ...m,
            text: m.text + value
        }

        // Update the ongoing conversation and broadcast to all connections
        const conversation = ongoingConversations.get(chatId);
        if (conversation && conversation.userId === userId) {
            // Create a chat update with the current message
            const update = {
                chatId,
                timestamp: Date.now(),
                messages: [message.value]
            };

            // Broadcast the update to all connections for this user
            broadcastToUser(userId, {
                type: BotanikaServerEventType.chatUpdate,
                data: update
            });

            // Update the conversation's last update
            const lastUpdate = conversation.updates[conversation.updates.length - 1];
            if (lastUpdate && lastUpdate.messages && lastUpdate.messages.length > 0 && 
                lastUpdate.messages[0].id === message.value.id) {
                // Update the existing message in the last update
                lastUpdate.messages[0] = message.value;
                lastUpdate.timestamp = Date.now();
            } else {
                // Add a new update
                conversation.updates.push(update);
            }

            // Update the lastUpdated timestamp
            conversation.lastUpdated = Date.now();

            // Set isGenerating to true since we're still streaming
            conversation.isGenerating = true;

            // Limit the number of stored updates to prevent memory issues
            if (conversation.updates.length > 100) {
                conversation.updates = conversation.updates.slice(-100);
            }
        } else {
            CLI.debug(`Conversation not found for chat ${chatId} and user ${userId}`);
        }
    }

    const finalText = await text;

    message.value = {
        ...message.value,
        text: finalText,
        finished: true
    }

    // Update the ongoing conversation and broadcast to all connections
    const conversation = ongoingConversations.get(chatId);
    if (conversation && conversation.userId === userId) {
        const update = {
            chatId,
            timestamp: Date.now(),
            messages: [message.value]
        };

        // Broadcast the update to all connections for this user
        broadcastToUser(userId, {
            type: BotanikaServerEventType.chatUpdate,
            data: update
        });

        // Update the conversation's last update
        const lastUpdate = conversation.updates[conversation.updates.length - 1];
        if (lastUpdate && lastUpdate.messages && lastUpdate.messages.length > 0 && 
            lastUpdate.messages[0].id === message.value.id) {
            // Update the existing message in the last update
            lastUpdate.messages[0] = message.value;
            lastUpdate.timestamp = Date.now();
        } else {
            // Add a new update
            conversation.updates.push(update);
        }

        // Update the lastUpdated timestamp
        conversation.lastUpdated = Date.now();

        // Set isGenerating to false since we're done streaming
        conversation.isGenerating = false;

        CLI.debug(`Finished streaming for chat ${chatId}`);
    } else {
        CLI.debug(`Conversation not found for chat ${chatId} and user ${userId}`);
    }
}
