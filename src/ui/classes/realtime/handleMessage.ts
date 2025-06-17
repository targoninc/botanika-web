import {BotanikaServerEvent} from "../../../models/websocket/serverEvents/botanikaServerEvent.ts";
import {toast} from "../ui.ts";
import {ToastType} from "../../enums/ToastType.ts";
import {chats, currentChatId} from "../state/store.ts";
import {ChatMessage} from "../../../models/chat/ChatMessage.ts";
import {playAudio} from "../audio/audio.ts";

/**
 * Update a specific message in a chat
 * @param chatId The ID of the chat
 * @param messageId The ID of the message to update
 * @param event The event that triggered the update
 * @param updateFn A function that takes the message and returns an updated version
 */
function updateMessage(chatId: string, messageId: string, event: BotanikaServerEvent, updateFn: (message: ChatMessage) => ChatMessage) {
    const chatsList = chats.value;
    const chat = chatsList.find(c => c.id === chatId);

    if (!chat) return;

    const message = chat.history.find(m => m.id === messageId);
    if (!message) return;

    chat.updatedAt = event.timestamp!;
    updateFn(message);
    message.createdAt = event.timestamp!;

    chats._callbacks.forEach(c => c(chats.value, true));
}

function addTextToMessage(chatId: string, event: BotanikaServerEvent & { type: "messageTextAdded" }) {
    updateMessage(chatId, event.messageId, event, message => {
        if ("text" in message) {
            message.text += event.messageChunk;
        }

        return message;
    });
}

function setMessageText(chatId: string, event: BotanikaServerEvent & { type: "messageTextCompleted" }) {
    updateMessage(chatId, event.messageId, event, message => {
        if ('text' in message) {
            message.text = event.text;
        }

        return message;
    });
}

function setMessageAudio(chatId: string, event: BotanikaServerEvent & { type: "audioGenerated" }) {
    updateMessage(chatId, event.messageId, event, message => {
        if (message.type === 'assistant') {
            message.hasAudio = true;
        }

        return message;
    });

    // Play the audio if this is the current chat
    if (currentChatId.value === chatId) {
        playAudio(event.messageId).then();
    }
}

function completeMessage(chatId: string, event: BotanikaServerEvent & { type: "messageCompleted" }) {
    const chat = chats.value.find(c => c.id === chatId);

    if (!chat) return;

    const message = chat.history[chat.history.length - 1];

    if (!message) return;

    message.createdAt = event.timestamp!;
    chat.updatedAt = event.timestamp!;

    if (message.type === "assistant") {
        message.finished = true;

        chats._callbacks.forEach(c => c(chats.value, true));
    }
}

/**
 * Update a chat's name
 * @param chatId The ID of the chat
 * @param event The event that triggered the name update
 */
function setChatName(chatId: string, event: BotanikaServerEvent & { type: "chatNameSet" }) {
    const chatsList = chats.value;
    const chat = chatsList.find(c => c.id === chatId);

    if (!chat) return;

    chat.name = event.name;
    chat.updatedAt = event.timestamp!;

    chats._callbacks.forEach(c => c(chats.value, true));
}

function updateToolInvocations(chatId: string, event: BotanikaServerEvent & { type: "updateToolInvocations" }) {
    updateMessage(chatId, event.messageId, event, message => {
        if (message.type === 'assistant') {
            message.toolInvocations = event.toolInvocations;
        }
        return message;
    });
}

function updateFiles(chatId: string, event: BotanikaServerEvent & { type: "updateFiles" }) {
    updateMessage(chatId, event.messageId, event, message => {
        if (message.type === 'assistant' || message.type === 'user') {
            message.files = event.files;
        }

        return message;
    });
}

/**
 * Handle a chat branched event
 * @param chatId The ID of the new chat
 * @param event The event that triggered the branching
 */
function handleChatBranched(chatId: string, event: BotanikaServerEvent & { type: "chatBranched" }) {
    const oldChat = chats.value.find(c => c.id === event.branchedFromChatId);

    if (!oldChat) return;

    const newChat = structuredClone(oldChat);
    newChat.id = chatId;

    if (currentChatId.value === event.branchedFromChatId) {
        currentChatId.value = chatId;
    }

    chats.value.push(newChat);
    chats._callbacks.forEach(c => c(chats.value, true));
}

function handleMessageCreated(chatId: string, event: BotanikaServerEvent & { type: "messageCreated" | "userMessageCreated" }) {
    chats.value.find(c => c.id === chatId)?.history.push(event.message);
    chats._callbacks.forEach(c => c(chats.value, true));
}

function handleChatCreated(chatId: string, event: BotanikaServerEvent & { type: "chatCreated" }) {
    chats.value.push({
        id: chatId,
        name: "",
        createdAt: event.timestamp!,
        updatedAt: event.timestamp!,
        shared: false,
        userId: event.userId,
        history: [event.userMessage]
    });
    chats._callbacks.forEach(c => c(chats.value, true));
}

function handleChatDeletedAfterMessage(chatId: string, event: BotanikaServerEvent & { type: "chatDeletedAfterMessage" }) {
    const chat = chats.value.find(c => c.id === chatId);

    if (!chat) return;

    const indexAfterMessage = chat.history.findIndex(m => m.id === event.afterMessageId);
    if (indexAfterMessage === -1) return;

    chat.history = chat.history.filter((_, i) => i > indexAfterMessage);
    chat.updatedAt = event.timestamp!;

    chats._callbacks.forEach(c => c(chats.value, true));
}

function handleUsageCreated(chatId: string, event: BotanikaServerEvent & { type: "usageCreated" }) {
    updateMessage(chatId, event.messageId, event, message => {
        if (message.type === 'assistant') {
            message.usage = event.usage;
        }

        return message;
    });
}

function handleReasoningFinished(chatId: string, event: BotanikaServerEvent & { type: "reasoningFinished" }) {
    updateMessage(chatId, event.messageId, event, message => {
        if (message.type === 'assistant') {
            message.reasoning = event.reasoningDetails;
        }

        return message;
    });
}

export function deleteChat(chatId: string) {
    chats.value = chats.value.filter(c => c.id !== chatId);
}

export async function handleMessage(event: BotanikaServerEvent) {
    // Common events that need special handling
    switch (event.type) {
        case "error":
            console.error(`Error from server`, event);
            toast(`Error from server: ${event.error}`, null, ToastType.negative);
            return;
        case "warning":
            console.warn(`Warning from server`, event);
            toast(`Warning from server: ${event.warning}`, null, ToastType.sensitive);
            return;
        case "log":
            console.log(`Log from server`, event);
            return;
    }

    // Chat-related events
    if ('chatId' in event) {
        const chatId = event.chatId;

        switch (event.type) {
            case "messageCreated": {
                handleMessageCreated(chatId, event);
                break;
            }
            case "userMessageCreated": {
                handleMessageCreated(chatId, event);
                break;
            }
            case "chatSharedSet": {
                break;
            }
            case "toolCallStarted": {
                break;
            }
            case "toolCallFinished": {
                break;
            }
            case "reasoningFinished": {
                handleReasoningFinished(chatId, event);
                break;
            }
            case "usageCreated": {
                handleUsageCreated(chatId, event);
                break;
            }
            case "chatDeletedAfterMessage": {
                handleChatDeletedAfterMessage(chatId, event);
                break;
            }
            case "chatCreated": {
                handleChatCreated(chatId, event);
                break;
            }
            case "messageTextAdded": {
                // Add text to a message incrementally
                addTextToMessage(chatId, event);
                break;
            }
            case "messageTextCompleted": {
                // Set the complete text of a message
                setMessageText(chatId, event);
                break;
            }
            case "messageCompleted": {
                // Mark the message as finished
                completeMessage(chatId, event);
                break;
            }
            case "audioGenerated": {
                // Set the audio URL and play it if appropriate
                setMessageAudio(chatId, event);
                break;
            }
            case "chatNameSet": {
                // Update the chat name
                setChatName(chatId, event);
                break;
            }
            case "updateToolInvocations": {
                updateToolInvocations(chatId, event);
                break;
            }
            case "updateFiles": {
                // Update message files
                updateFiles(chatId, event);
                break;
            }
            case "chatDeleted": {
                // Delete the chat
                deleteChat(chatId);
                break;
            }
            case "chatBranched": {
                // Handle chat branching
                handleChatBranched(chatId, event);
                break;
            }
            default: {
                // @ts-expect-error event.type should be "never" here. If there is no error that means we have a new event type that we don't handle yet.
                console.warn(`Unhandled chat event type: ${event.type}`, event);
                break;
            }
        }
    } else {
        console.warn(`Don't know what to do with websocket message`, event);
    }
}
