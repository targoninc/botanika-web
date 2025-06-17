import {BotanikaClientEvent} from "../../models-shared/websocket/clientEvents/botanikaClientEvent.ts";
import {GenerationStoppedEventData} from "../../models-shared/websocket/clientEvents/generationStoppedEventData.ts";
import {WebsocketConnection, ongoingConversations, sendChatUpdate} from "./websocket.ts";
import {CLI} from "../CLI.ts";
import {activeAbortControllers} from "./newMessageEventHandler.ts";
import {ChatStorage} from "../storage/ChatStorage.ts";

export async function generationStoppedEventHandler(ws: WebsocketConnection, message: BotanikaClientEvent<GenerationStoppedEventData>) {
    const request = message.data;
    if (!request.chatId) {
        throw new Error("Invalid request: chatId is required");
    }

    const abortController = activeAbortControllers.get(request.chatId);
    if (abortController) {
        CLI.log(`Aborting generation for chat ${request.chatId}`);

        // Get the ongoing conversation
        const conversation = ongoingConversations.get(request.chatId);
        if (conversation && conversation.userId === ws.userId) {
            // Find the current assistant message that's being generated
            const currentMessage = conversation.updates
                .flatMap(update => update.messages || [])
                .find(msg => msg.type === "assistant" && !msg.finished);

            if (currentMessage) {
                // Mark the message as finished
                currentMessage.finished = true;
                currentMessage.text += " [Generation stopped]";

                // Update the conversation
                sendChatUpdate(ws, {
                    chatId: request.chatId,
                    timestamp: Date.now(),
                    messages: [currentMessage]
                });

                // Read the chat context
                const chat = await ChatStorage.readChatContext(ws.userId, request.chatId);
                if (chat) {
                    // Update the message in the chat history
                    const messageIndex = chat.history.findIndex(m => m.id === currentMessage.id);
                    if (messageIndex >= 0) {
                        chat.history[messageIndex] = currentMessage;
                    } else {
                        chat.history.push(currentMessage);
                    }

                    // Write the updated chat context
                    await ChatStorage.writeChatContext(ws.userId, chat);
                }
            }
        }

        // Abort the generation
        abortController.abort();

        // Remove the abort controller from the map
        activeAbortControllers.delete(request.chatId);
    } else {
        CLI.log(`No active generation found for chat ${request.chatId}`);
    }
}
