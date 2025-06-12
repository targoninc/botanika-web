import {ChatMessage} from "../../../models/chat/ChatMessage";
import {Signal} from "@targoninc/jess";
import {broadcastToUser, ongoingConversations, UPDATE_LIMIT} from "../../websocket-server/websocket.ts";
import {BotanikaServerEventType} from "../../../models/websocket/serverEvents/botanikaServerEventType.ts";
import {CLI} from "../../CLI.ts";

function updateConversation(
    chatId: string,
    userId: string,
    message: ChatMessage,
    isGenerating: boolean
) {
    const conversation = ongoingConversations.get(chatId);
    if (conversation && conversation.userId === userId) {
        const update = {
            chatId,
            timestamp: Date.now(),
            messages: [message]
        };

        broadcastToUser(userId, {
            type: BotanikaServerEventType.chatUpdate,
            data: update
        });

        const lastUpdate = conversation.updates[conversation.updates.length - 1];
        if (lastUpdate && lastUpdate.messages && lastUpdate.messages.length > 0 &&
            lastUpdate.messages[0].id === message.id) {
            lastUpdate.messages[0] = message;
            lastUpdate.timestamp = Date.now();
        } else {
            conversation.updates.push(update);
        }

        conversation.lastUpdated = Date.now();
        conversation.isGenerating = isGenerating;

        if (conversation.updates.length > UPDATE_LIMIT) {
            conversation.updates = conversation.updates.slice(-UPDATE_LIMIT);
        }

        if (!isGenerating) {
            CLI.debug(`Finished streaming for chat ${chatId}`);
        }
    } else {
        CLI.debug(`Conversation not found for chat ${chatId} and user ${userId}`);
    }
}

export async function updateMessageFromStream(
    message: Signal<ChatMessage>,
    stream: AsyncIterable<string> & ReadableStream<string>,
    text: Promise<string>,
    chatId: string,
    userId: string
) {
    const reader = stream.getReader();

    while (true) {
        const {value, done} = await reader.read();
        const m = message.value;
        if (done) {
            break;
        }

        message.value = {
            ...m,
            text: m.text + value
        }

        updateConversation(chatId, userId, message.value, true);
    }

    const finalText = await text;
    message.value = {
        ...message.value,
        text: finalText,
        finished: true
    }

    updateConversation(chatId, userId, message.value, false);
}