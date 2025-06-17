import {ChatContext} from "../../../models/chat/ChatContext.ts";
import {ChatEvent} from "../../../models/websocket/serverEvents/botanikaServerEvent.ts";

export function applyEventOnChat(chat: ChatContext | null, event: ChatEvent) : ChatContext {
    if (chat === null && event.type !== "chatCreated") {
        throw new Error("Cannot apply event to null chat");
    }

    if (chat){
        chat.updatedAt = event.timestamp!;
    }

    // Just to make TS happy
    chat = chat!;


    switch (event.type) {
        case "messageCompleted": {
            const assistantMessage = chat.history[chat.history.length - 1];
            if (assistantMessage.type === "assistant") {
                assistantMessage.finished = true;
                assistantMessage.createdAt = event.timestamp!;
            }
            break;
        }
        case "chatCreated": {
            return {
                id: event.chatId,
                name: "",
                createdAt: event.timestamp!,
                updatedAt: event.timestamp!,
                history: [event.userMessage],
                userId: event.userId,
                shared: false,
                deleted: false
            }
        }
        case "userMessageCreated": {
            chat.history.push(event.message);
            break;
        }
        case "messageTextAdded": {
            const message = chat.history.find(m => m.id === event.messageId);
            if (message && message.type === "assistant") {
                message.text += event.messageChunk;
                message.createdAt = event.timestamp!;
            }
            break;
        }
        case "audioGenerated": {
            const message = chat.history.find(m => m.id === event.messageId);
            if (message && message.type === "assistant") {
                message.hasAudio = true;
            }
            break;
        }
        case "chatNameSet": {
            chat.name = event.name;
            break;
        }
        case "chatSharedSet": {
            chat.shared = event.shared;
            break;
        }
        case "updateToolInvocations": {
            const message = chat.history.find(m => m.id === event.messageId);
            if (message && message.type === "assistant") {
                message.toolInvocations = event.toolInvocations;
                message.createdAt = event.timestamp!;
            }
            break;
        }
        case "messageTextCompleted": {
            const message = chat.history.find(m => m.id === event.messageId);
            if (message && message.type === "assistant") {
                message.finished = true;
                message.createdAt = event.timestamp!;
            }
            break;
        }
        case "updateFiles": {
            const message = chat.history.find(m => m.id === event.messageId);
            if (message && message.type === "assistant") {
                message.files = event.files;
            }
            break;
        }
        case "toolCallStarted": {
            const message = chat.history.find(m => m.id === event.messageId);
            if (message && message.type === "assistant") {
                message.toolInvocations.push({
                    args: event.args,
                    state: "call",
                    toolCallId: event.toolCallId,
                    toolName: event.toolName
                });
            }
            break;
        }
        case "toolCallFinished": {
            const message = chat.history.find(m => m.id === event.messageId);
            if (message && message.type === "assistant") {
                message.toolInvocations = message.toolInvocations.map(ti => {
                    if (ti.toolCallId !== event.toolCallId) {
                        return ti;
                    }

                    return {
                        ...ti,
                        state: "result",
                        result: event.toolResult,
                    }
                });

                message.createdAt = event.timestamp!;
            }
            break;
        }
        case "messageCreated": {
            chat.history.push(event.message);
            break;
        }
        case "reasoningFinished": {
            const message = chat.history.find(m => m.id === event.messageId);
            if (message && message.type === "assistant") {
                message.reasoning = event.reasoningDetails;
                message.createdAt = event.timestamp!;
            }
            break;
        }
        case "usageCreated": {
            const message = chat.history.find(m => m.id === event.messageId);
            if (message && message.type === "assistant") {
                message.usage = event.usage;
                message.createdAt = event.timestamp!;
            }
            break;
        }
        case "chatDeleted": {
            chat.history = [];
            chat.deleted = true;
            break;
        }
        case "chatBranched": {
            const newChat = structuredClone(chat);
            newChat.id = event.chatId;
            newChat.branched_from_chat_id = event.branchedFromChatId;
            newChat.createdAt = event.timestamp!;
            newChat.updatedAt = event.timestamp!;

            return newChat;
        }
        case "chatDeletedAfterMessage": {
            const messageIndex = chat.history.findIndex(m => m.id === event.afterMessageId);
            if (messageIndex === -1) {
                throw new Error("Message not found in chat history");
            }

            chat.history = chat.history.slice(0, messageIndex + 1);
            break;
        }
        default:
            // @ts-expect-error event.type should always be a valid event type.
            throw new Error("Event of type " + event.type + " not supported");
    }

    return chat;
}
