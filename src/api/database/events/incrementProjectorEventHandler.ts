import { BotanikaServerEvent } from "../../../models/websocket/serverEvents/botanikaServerEvent.ts";
import { CLI } from "../../CLI.ts";
import { eventStore, EventHandler } from "./eventStore.ts";
import {ChatMessage} from "../../../models/chat/ChatMessage.ts";
import {MessageFile} from "../../../models/chat/MessageFile.ts";
import {ResourceReference} from "../../../models/chat/ResourceReference.ts";
import {ChatContext} from "../../../models/chat/ChatContext.ts";
import {db} from "../db.ts";

/**
 * Types of increments that can be created by the increment projector
 */
export enum IncrementType {
    ADD_TO_MESSAGE = "addToMessage",
    NEW_CHAT = "newChat",
    UPDATE_CHAT = "updateChat"
}

/**
 * Base interface for all increments
 */
type Increment = {
    latestUpdateTimestamp: number;
    earliestUpdateTimestamp: number;
    size: number;
}

type UserIncrement = Increment & {
    chatIncrements: Map<string, ChatIncrement>;
}

type ChatIncrement = Increment & ({
    type: "addToChat";
    messageIncrements: Map<string, MessageIncrement>;
} | {
    type: "newChat";
    chat: ChatContext;
})

type MessageIncrement = Increment & ({
    type: "addToMessage";
    text: string;
    files: MessageFile[];
    references: ResourceReference[];
    audio?: boolean;
    finished?: boolean;
} | {
    type: "newMessage";
    message: ChatMessage;
})

/**
 * Increment projector event handler that creates increment objects based on events
 * This handler processes events and creates increments that represent changes to entities
 */
export class IncrementProjectorEventHandler {
    // Store increments in memory, organized by user ID
    private static increments: Map<string, UserIncrement> = new Map();

    /**
     * Calculate the size of a string in bytes
     * @param str The string to calculate the size of
     * @returns The size in bytes
     */
    private static calculateStringSize(str: string): number {
        return new TextEncoder().encode(str).length;
    }

    /**
     * Calculate the size of a MessageFile in bytes
     * @param file The MessageFile to calculate the size of
     * @returns The size in bytes
     */
    private static calculateFileSize(file: MessageFile): number {
        let size = 0;

        size += IncrementProjectorEventHandler.calculateStringSize(file.name ?? "");
        size += IncrementProjectorEventHandler.calculateStringSize(file.base64);

        return size;
    }

    /**
     * Calculate the size of a ResourceReference in bytes
     * @param reference The ResourceReference to calculate the size of
     * @returns The size in bytes
     */
    private static calculateReferenceSize(reference: ResourceReference): number {
        let size = 0;

        // Add size of reference properties
        if (reference.title) size += IncrementProjectorEventHandler.calculateStringSize(reference.title);
        if (reference.url) size += IncrementProjectorEventHandler.calculateStringSize(reference.url);
        if (reference.snippet) size += IncrementProjectorEventHandler.calculateStringSize(reference.snippet);

        return size;
    }

    /**
     * Calculate the size of a ChatIncrement in bytes
     * @param increment The ChatIncrement to calculate the size of
     * @returns The size in bytes
     */
    private static calculateChatIncrementSize(increment: ChatIncrement): number {
        let size = 0;

        if (increment.type === "addToChat") {
            // Calculate size of all message increments
            for (const messageIncrement of increment.messageIncrements.values()) {
                size += messageIncrement.size;
            }
        } else if (increment.type === "newChat") {
            // Calculate size of chat
            if (increment.chat) {
                if (increment.chat.name) {
                    size += IncrementProjectorEventHandler.calculateStringSize(increment.chat.name);
                }

                // We don't include the history size here as that would be counted in message increments
            }
        }

        return size;
    }

    /**
     * Calculate the size of a UserIncrement in bytes
     * @param increment The UserIncrement to calculate the size of
     * @returns The size in bytes
     */
    private static calculateUserIncrementSize(increment: UserIncrement): number {
        let size = 0;

        // Calculate size of all chat increments
        for (const chatIncrement of increment.chatIncrements.values()) {
            size += chatIncrement.size;
        }

        return size;
    }

    /**
     * Get or create a user increment
     * @param userId The user ID
     * @param timestamp The timestamp of the event
     * @returns The user increment
     */
    private static getOrCreateUserIncrement(userId: string, timestamp: number): UserIncrement {
        let userIncrement = IncrementProjectorEventHandler.increments.get(userId);

        if (!userIncrement) {
            userIncrement = {
                chatIncrements: new Map(),
                earliestUpdateTimestamp: timestamp,
                latestUpdateTimestamp: timestamp,
                size: 0
            };

            IncrementProjectorEventHandler.increments.set(userId, userIncrement);
        } else {
            // Update timestamps
            userIncrement.earliestUpdateTimestamp = Math.min(userIncrement.earliestUpdateTimestamp, timestamp);
            userIncrement.latestUpdateTimestamp = Math.max(userIncrement.latestUpdateTimestamp, timestamp);
        }

        return userIncrement;
    }

    /**
     * Get or create a chat increment
     * @param userIncrement The user increment
     * @param chatId The chat ID
     * @param type The type of chat increment
     * @param timestamp The timestamp of the event
     * @returns The chat increment
     */
    private static getOrCreateChatIncrement(
        userIncrement: UserIncrement, 
        chatId: string, 
        timestamp: number,
        type: ChatIncrement["type"]
    ): ChatIncrement {
        let chatIncrement = userIncrement.chatIncrements.get(chatId);

        if (!chatIncrement) {
            switch (type) {
                case "addToChat":
                    chatIncrement = {
                        type: "addToChat",
                        messageIncrements: new Map(),
                        earliestUpdateTimestamp: timestamp,
                        latestUpdateTimestamp: timestamp,
                        size: 0
                    };
                    break;
                case "newChat":
                    chatIncrement = {
                        type: "newChat",
                        chat: {
                            id: chatId,
                            name: "",
                            createdAt: timestamp,
                            updatedAt: timestamp,
                            history: []
                        },
                        earliestUpdateTimestamp: timestamp,
                        latestUpdateTimestamp: timestamp,
                        size: 0
                    };
                    break;
                default:
                    throw new Error(`Invalid chat increment type: ${type}`);
            }

            userIncrement.chatIncrements.set(chatId, chatIncrement);
        } else {
            chatIncrement.earliestUpdateTimestamp = Math.min(chatIncrement.earliestUpdateTimestamp, timestamp);
            chatIncrement.latestUpdateTimestamp = Math.max(chatIncrement.latestUpdateTimestamp, timestamp);
        }

        return chatIncrement;
    }

    /**
     * Handle a chat update event (message chunk)
     * Creates or updates an ADD_TO_MESSAGE increment
     * 
     * @param event The chat update event
     */
    private static async handleChatUpdate(event: BotanikaServerEvent & { type: "messageTextAdded" }): Promise<void> {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();
            // Calculate the chunk size once at the beginning
            const chunkSize = IncrementProjectorEventHandler.calculateStringSize(event.messageChunk);

            // Get or create user increment
            const userIncrement = IncrementProjectorEventHandler.getOrCreateUserIncrement(userId, timestamp);

            // Get or create chat increment
            const chatIncrement = IncrementProjectorEventHandler.getOrCreateChatIncrement(
                userIncrement,
                event.chatId,
                timestamp,
                "addToChat"
            ) as { type: "addToChat" } & ChatIncrement;

            switch (chatIncrement.type) {
                case "addToChat":
                    // Get or create message increment
                    let messageIncrement = chatIncrement.messageIncrements.get(event.messageId);
                    if (!messageIncrement) {
                        messageIncrement = {
                            type: "addToMessage",
                            text: event.messageChunk,
                            files: [],
                            references: [],
                            earliestUpdateTimestamp: timestamp,
                            latestUpdateTimestamp: timestamp,
                            size: chunkSize
                        };
                        chatIncrement.messageIncrements.set(event.messageId, messageIncrement);
                    }else {
                        switch (messageIncrement.type) {
                            case "addToMessage":
                                // Update the message increment
                                messageIncrement.text += event.messageChunk;
                                messageIncrement.latestUpdateTimestamp = timestamp;
                                break;
                            case "newMessage":
                                if ("text" in messageIncrement.message) {
                                    messageIncrement.message.text += event.messageChunk;
                                }else {
                                    throw new Error("Message increment is not of type 'newMessage'");
                                }

                                messageIncrement.size += chunkSize;
                                break;
                        }
                    }
                    break;
                case "newChat":
                    break;
            }
            let messageIncrement = chatIncrement.messageIncrements.get(event.messageId);

            if (!messageIncrement || messageIncrement.type !== "addToMessage") {
                messageIncrement = {
                    type: "addToMessage",
                    text: event.messageChunk,
                    files: [],
                    references: [],
                    earliestUpdateTimestamp: timestamp,
                    latestUpdateTimestamp: timestamp,
                    size: chunkSize
                };

                chatIncrement.messageIncrements.set(event.messageId, messageIncrement);
                CLI.debug(`Created new addToMessage increment for message ${event.messageId}`);

                // For new message increments, calculate the full size
                chatIncrement.size = IncrementProjectorEventHandler.calculateChatIncrementSize(chatIncrement);
                userIncrement.size = IncrementProjectorEventHandler.calculateUserIncrementSize(userIncrement);
            } else {
                // Update the message increment
                messageIncrement.text += event.messageChunk;
                messageIncrement.latestUpdateTimestamp = timestamp;

                // Add the chunk size to the message increment size
                messageIncrement.size += chunkSize;

                // Add the chunk size to the chat increment size
                chatIncrement.size += chunkSize;

                // Add the chunk size to the user increment size
                userIncrement.size += chunkSize;

                CLI.debug(`Updated increments for message ${event.messageId}, added ${chunkSize} bytes`);
            }
        } catch (error) {
            CLI.error(`Error handling chat update event: ${error}`);
        }
    }

    /**
     * Handle a chat created event
     * Creates a NEW_CHAT increment
     * 
     * @param event The chat created event
     */
    private static async handleChatCreated(event: BotanikaServerEvent & { type: "chatCreated" }): Promise<void> {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            // Get or create user increment
            const userIncrement = IncrementProjectorEventHandler.getOrCreateUserIncrement(userId, timestamp);

            // Get or create chat increment
            const chatIncrement = IncrementProjectorEventHandler.getOrCreateChatIncrement(
                userIncrement, 
                event.chatId, 
                "newChat", 
                timestamp
            ) as ChatIncrement & { type: "newChat" };

            // Calculate the size of the user message
            let messageSize = 0;
            if (event.userMessage.text) {
                messageSize += IncrementProjectorEventHandler.calculateStringSize(event.userMessage.text);
            }

            // Add size of files if any
            if (event.userMessage.files) {
                for (const file of event.userMessage.files) {
                    messageSize += IncrementProjectorEventHandler.calculateFileSize(file);
                }
            }

            // Add size of references if any
            if (event.userMessage.references) {
                for (const reference of event.userMessage.references) {
                    messageSize += IncrementProjectorEventHandler.calculateReferenceSize(reference);
                }
            }

            // Update chat with user message
            chatIncrement.chat = {
                id: event.chatId,
                name: "New Chat", // Default name, will be updated later
                createdAt: timestamp,
                updatedAt: timestamp,
                history: [event.userMessage]
            };

            // Add the default name size
            const defaultNameSize = IncrementProjectorEventHandler.calculateStringSize("New Chat");

            // Update size incrementally
            chatIncrement.size += messageSize + defaultNameSize;

            // Update user increment size incrementally
            userIncrement.size += messageSize + defaultNameSize;

            CLI.debug(`Created newChat increment for chat ${event.chatId}, message size: ${messageSize} bytes, name size: ${defaultNameSize} bytes, total: ${messageSize + defaultNameSize} bytes`);
        } catch (error) {
            CLI.error(`Error handling chat created event: ${error}`);
        }
    }

    /**
     * Handle a chat name set event
     * Updates a NEW_CHAT increment or creates an UPDATE_CHAT increment
     * 
     * @param event The chat name set event
     */
    private static async handleChatNameSet(event: BotanikaServerEvent & { type: "chatNameSet" }): Promise<void> {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            // Get or create user increment
            const userIncrement = IncrementProjectorEventHandler.getOrCreateUserIncrement(userId, timestamp);

            // Check if we have a chat increment for this chat
            let chatIncrement = userIncrement.chatIncrements.get(event.chatId);

            if (chatIncrement) {
                // Update the name in the existing chat increment
                if (chatIncrement.type === "newChat") {
                    // Update name in newChat increment
                    const oldName = chatIncrement.chat.name;
                    const oldNameSize = IncrementProjectorEventHandler.calculateStringSize(oldName);
                    const newNameSize = IncrementProjectorEventHandler.calculateStringSize(event.name);
                    const sizeDifference = newNameSize - oldNameSize;

                    chatIncrement.chat.name = event.name;

                    // Update size by adding the difference between new and old name sizes
                    chatIncrement.size += sizeDifference;

                    // Update user increment size as well
                    userIncrement.size += sizeDifference;

                    CLI.debug(`Updated name in newChat increment for chat ${event.chatId}, size change: ${sizeDifference} bytes`);
                } else {
                    // For addToChat increments, we don't store the name directly
                    CLI.debug(`Chat ${event.chatId} is an addToChat increment, name change will be reflected in database`);
                }

                // Update timestamps
                chatIncrement.latestUpdateTimestamp = timestamp;

                // Update user increment size
                userIncrement.size = IncrementProjectorEventHandler.calculateUserIncrementSize(userIncrement);
            } else {
                // If no chat increment exists, create a new one
                chatIncrement = IncrementProjectorEventHandler.getOrCreateChatIncrement(

                // Calculate the name size
                const nameSize = IncrementProjectorEventHandler.calculateStringSize(event.name);

                // Set the name
                chatIncrement.chat.name = event.name;

                // Update size incrementally
                chatIncrement.size += nameSize;

                // Update user increment size incrementally
                userIncrement.size += nameSize;

                CLI.debug(`Created newChat increment for chat ${event.chatId} with name ${event.name}`);
            }
        } catch (error) {
            CLI.error(`Error handling chat name set event: ${error}`);
        }
    }

    /**
     * Get all user increments
     * 
     * @returns A map of user IDs to user increments
     */
    public static getAllUserIncrements(): Map<string, UserIncrement> {
        return new Map(IncrementProjectorEventHandler.increments);
    }

    /**
     * Get a user increment
     * 
     * @param userId The user ID
     * @returns The user increment, or undefined if not found
     */
    public static getUserIncrement(userId: string): UserIncrement | undefined {
        return IncrementProjectorEventHandler.increments.get(userId);
    }

    /**
     * Get a chat increment
     * 
     * @param userId The user ID
     * @param chatId The chat ID
     * @returns The chat increment, or undefined if not found
     */
    public static getChatIncrement(userId: string, chatId: string): ChatIncrement | undefined {
        const userIncrement = IncrementProjectorEventHandler.increments.get(userId);
        if (!userIncrement) return undefined;

        return userIncrement.chatIncrements.get(chatId);
    }

    /**
     * Get a message increment
     * 
     * @param userId The user ID
     * @param chatId The chat ID
     * @param messageId The message ID
     * @returns The message increment, or undefined if not found
     */
    public static getMessageIncrement(userId: string, chatId: string, messageId: string): MessageIncrement | undefined {
        const chatIncrement = IncrementProjectorEventHandler.getChatIncrement(userId, chatId);
        if (!chatIncrement || chatIncrement.type !== "addToChat") return undefined;

        return chatIncrement.messageIncrements.get(messageId);
    }

    /**
     * Get the total size of all increments for a user
     * 
     * @param userId The user ID
     * @returns The total size in bytes
     */
    public static getUserIncrementSize(userId: string): number {
        const userIncrement = IncrementProjectorEventHandler.increments.get(userId);
        if (!userIncrement) return 0;

        return userIncrement.size;
    }

    /**
     * Get the total size of all increments
     * 
     * @returns The total size in bytes
     */
    public static getTotalIncrementSize(): number {
        let totalSize = 0;

        for (const userIncrement of IncrementProjectorEventHandler.increments.values()) {
            totalSize += userIncrement.size;
        }

        return totalSize;
    }

    /**
     * Clear all increments
     */
    public static clearIncrements(): void {
        IncrementProjectorEventHandler.increments.clear();
        CLI.debug("Cleared all increments");
    }

    /**
     * Main event handler function that routes events to specific handlers
     * 
     * @param event The event to handle
     */
    public static async handleEvent(event: BotanikaServerEvent): Promise<void> {
        try {
            switch (event.type) {
                case "messageTextAdded":
                    await IncrementProjectorEventHandler.handleChatUpdate(event as BotanikaServerEvent & { type: "messageTextAdded" });
                    break;
                case "chatCreated":
                    await IncrementProjectorEventHandler.handleChatCreated(event as BotanikaServerEvent & { type: "chatCreated" });
                    break;
                case "chatNameSet":
                    await IncrementProjectorEventHandler.handleChatNameSet(event as BotanikaServerEvent & { type: "chatNameSet" });
                    break;
                // Add more handlers for other event types as needed
            }
        } catch (error) {
            CLI.error(`Error in increment projector event handler: ${error}`);
        }
    }
}

// Event handler function that can be registered with the event store
export const incrementProjectorEventHandler: EventHandler = IncrementProjectorEventHandler.handleEvent;

// Register the increment projector event handler with the event store
export function registerIncrementProjectorEventHandler(): () => void {
    return eventStore.subscribe('*', incrementProjectorEventHandler);
}
