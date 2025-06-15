import {BotanikaServerEvent} from "../../../models/websocket/serverEvents/botanikaServerEvent.ts";
import {BotanikaServerEventType} from "../../../models/websocket/serverEvents/botanikaServerEventType.ts";
import {ChatUpdate} from "../../../models/chat/ChatUpdate.ts";
import {toast} from "../ui.ts";
import {ServerErrorEvent} from "../../../models/websocket/serverEvents/serverErrorEvent.ts";
import {ToastType} from "../../enums/ToastType.ts";
import {ServerWarningEvent} from "../../../models/websocket/serverEvents/serverWarningEvent.ts";
import {chats, currentChatId, deleteChat, processUpdate, updateChats} from "../state/store.ts";
import {ChatContext} from "../../../models/chat/ChatContext.ts";
import {ChatMessage} from "../../../models/chat/ChatMessage.ts";
import {playAudio} from "../audio/audio.ts";

/**
 * Update a specific message in a chat
 * @param chatId The ID of the chat
 * @param messageId The ID of the message to update
 * @param updateFn A function that takes the message and returns an updated version
 */
function updateMessage(chatId: string, messageId: string, updateFn: (message: ChatMessage) => ChatMessage) {
    const chatsList = chats.value;
    const chat = chatsList.find(c => c.id === chatId);

    if (!chat) return;

    const updatedChat = structuredClone(chat);
    const messageIndex = updatedChat.history.findIndex(m => m.id === messageId);

    if (messageIndex === -1) return;

    updatedChat.history[messageIndex] = updateFn(updatedChat.history[messageIndex]);
    updatedChat.updatedAt = Date.now();

    updateChats(chatsList.map(c => c.id === chatId ? updatedChat : c));
}

/**
 * Add text to a message
 * @param chatId The ID of the chat
 * @param messageId The ID of the message
 * @param text The text to add
 */
function addTextToMessage(chatId: string, messageId: string, text: string) {
    updateMessage(chatId, messageId, message => {
        if ('text' in message) {
            return {
                ...message,
                text: message.text + text
            };
        }
        return message;
    });
}

/**
 * Set the complete text of a message
 * @param chatId The ID of the chat
 * @param messageId The ID of the message
 * @param text The complete text
 */
function setMessageText(chatId: string, messageId: string, text: string) {
    updateMessage(chatId, messageId, message => {
        if ('text' in message) {
            return {
                ...message,
                text
            };
        }
        return message;
    });
}

/**
 * Mark a message as having audio
 * @param chatId The ID of the chat
 * @param messageId The ID of the message
 * @param audioUrl The URL of the audio file
 */
function setMessageAudio(chatId: string, messageId: string, audioUrl: string) {
    updateMessage(chatId, messageId, message => {
        if (message.type === 'assistant') {
            return {
                ...message,
                hasAudio: true,
                audioUrl
            };
        }
        return message;
    });

    // Play the audio if this is the current chat
    if (currentChatId.value === chatId) {
        playAudio(messageId).then();
    }
}

/**
 * Mark a message as finished
 * @param chatId The ID of the chat
 */
function completeMessage(chatId: string) {
    const chatsList = chats.value;
    const chat = chatsList.find(c => c.id === chatId);

    if (!chat) return;

    const updatedChat = structuredClone(chat);

    // Find the most recent message
    if (updatedChat.history.length > 0) {
        const latestMessage = updatedChat.history.reduce((latest, current) => 
            current.time > latest.time ? current : latest
        );

        if (latestMessage.type === 'assistant') {
            const messageIndex = updatedChat.history.findIndex(m => m.id === latestMessage.id);
            updatedChat.history[messageIndex] = {
                ...latestMessage,
                finished: true
            };
            updatedChat.updatedAt = Date.now();

            updateChats(chatsList.map(c => c.id === chatId ? updatedChat : c));
        }
    }
}

/**
 * Update a chat's name
 * @param chatId The ID of the chat
 * @param name The new name
 */
function setChatName(chatId: string, name: string) {
    const chatsList = chats.value;
    const chat = chatsList.find(c => c.id === chatId);

    if (!chat) return;

    const updatedChat = {
        ...chat,
        name,
        updatedAt: Date.now()
    };

    updateChats(chatsList.map(c => c.id === chatId ? updatedChat : c));
}

/**
 * Update a message's references
 * @param chatId The ID of the chat
 * @param messageId The ID of the message
 * @param references The new references
 */
function updateReferences(chatId: string, messageId: string, references: any[]) {
    updateMessage(chatId, messageId, message => {
        if (message.type === 'assistant') {
            return {
                ...message,
                references
            };
        }
        return message;
    });
}

/**
 * Update a message's files
 * @param chatId The ID of the chat
 * @param messageId The ID of the message
 * @param files The new files
 */
function updateFiles(chatId: string, messageId: string, files: any[]) {
    updateMessage(chatId, messageId, message => {
        return {
            ...message,
            files
        };
    });
}

/**
 * Handle a chat branched event
 * @param chatId The ID of the new chat
 * @param branchedFromChatId The ID of the original chat
 * @param messageId The ID of the message to branch from
 */
function handleChatBranched(chatId: string, branchedFromChatId: string, messageId: string) {
    // If we're currently viewing the original chat, switch to the new one
    if (currentChatId.value === branchedFromChatId) {
        currentChatId.value = chatId;
    }

    // The new chat will be loaded from the server when needed
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
            case "chatCreated":
                // Create a new chat with the initial user message
                const update: ChatUpdate = {
                    chatId,
                    messages: [event.userMessage]
                };
                await processUpdate(update);
                break;

            case "messageTextAdded":
                // Add text to a message incrementally
                addTextToMessage(chatId, event.messageId, event.messageChunk);
                break;

            case "messageTextCompleted":
                // Set the complete text of a message
                setMessageText(chatId, event.messageId, event.text);
                break;

            case "messageCompleted":
                // Mark the message as finished
                completeMessage(chatId);
                break;

            case "audioGenerated":
                // Set the audio URL and play it if appropriate
                setMessageAudio(chatId, event.messageId, event.audioUrl);
                break;

            case "chatNameSet":
                // Update the chat name
                setChatName(chatId, event.name);
                break;

            case "updateReferences":
                // Update message references
                updateReferences(chatId, event.messageId, event.references);
                break;

            case "updateFiles":
                // Update message files
                updateFiles(chatId, event.messageId, event.files);
                break;

            case "chatDeleted":
                // Delete the chat
                deleteChat(chatId);
                break;

            case "chatBranched":
                // Handle chat branching
                handleChatBranched(chatId, event.branchedFromChatId, event.messageId);
                break;

            case "messageCreated":
                // Add a new message to the chat
                const messageUpdate: ChatUpdate = {
                    chatId,
                    messages: [event.message]
                };
                await processUpdate(messageUpdate);
                break;

            default:
                console.warn(`Unhandled chat event type: ${event.type}`, event);
                break;
        }
    } else {
        console.warn(`Don't know what to do with websocket message`, event);
    }
}
