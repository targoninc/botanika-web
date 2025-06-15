import {
    BotanikaServerEvent,
    ChatEvent,
    ChatEventTypes
} from "../../../models/websocket/serverEvents/botanikaServerEvent.ts";
import { CLI } from "../../CLI.ts";
import { eventStore } from "./eventStore.ts";
import {ChatMessage} from "../../../models/chat/ChatMessage.ts";
import {MessageFile} from "../../../models/chat/MessageFile.ts";
import {ResourceReference} from "../../../models/chat/ResourceReference.ts";
import {ChatContext} from "../../../models/chat/ChatContext.ts";
import {ChatStorage} from "../../storage/ChatStorage.ts";

export type Increment = {
    latestUpdateTimestamp: number;
    earliestUpdateTimestamp: number;
}

export type UserIncrement = Increment & {
    userId: string;
    size: number;
    chatIncrements: Map<string, ChatIncrement>;
}

export type ChatIncrement = Increment & ({
    type: "addToChat";
    messageIncrements: Map<string, MessageIncrement>;
    name?: string;
} | {
    type: "newChat";
    chat: ChatContext;
})

export type MessageIncrement = Increment & ({
    type: "addToMessage";
    text: string;
    files: MessageFile[];
    references: ResourceReference[];
    audio?: boolean;
    finished?: boolean;
} | {
    type: "userMessageCreatedEvent";
    message: ChatMessage;
})

export class IncrementProjector {
    public userIncrementMap: Map<string, UserIncrement> = new Map();

    public size: number = 0;

    private static calculateStringSize(str: string): number {
        return new TextEncoder().encode(str).length;
    }

    private getOrCreateUserIncrement(userId: string, timestamp: number): UserIncrement {
        let userIncrement = this.userIncrementMap.get(userId);

        if (!userIncrement) {
            userIncrement = {
                userId,
                chatIncrements: new Map(),
                earliestUpdateTimestamp: timestamp,
                latestUpdateTimestamp: timestamp,
                size: 0
            };

            this.userIncrementMap.set(userId, userIncrement);
        }

        return userIncrement;
    }

    /**
     * Get or create a chat increment
     * @param userIncrement The user increment
     * @param chatId The chat ID
     * @param timestamp The timestamp of the event
     * @returns The chat increment
     */
    private getOrCreateChatIncrement(
        userIncrement: UserIncrement, 
        chatId: string, 
        timestamp: number,
    ): ChatIncrement {
        let chatIncrement = userIncrement.chatIncrements.get(chatId);

        if (!chatIncrement) {
            chatIncrement = {
                type: "addToChat",
                messageIncrements: new Map(),
                earliestUpdateTimestamp: timestamp,
                latestUpdateTimestamp: timestamp,
            }

            userIncrement.chatIncrements.set(chatId, chatIncrement);
        }

        return chatIncrement;
    }

    /**
     * Handle a chat update event (message chunk)
     * Creates or updates an ADD_TO_MESSAGE increment
     * 
     * @param event The chat update event
     */
    private handleMessagesTextAdded(event: BotanikaServerEvent & { type: "messageTextAdded" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            switch (chatIncrement.type) {
                case "addToChat": {
                    let messageIncrement = chatIncrement.messageIncrements.get(event.messageId);
                    if (!messageIncrement) {
                        messageIncrement = {
                            type: "addToMessage",
                            text: event.messageChunk,
                            files: [],
                            references: [],
                            earliestUpdateTimestamp: timestamp,
                            latestUpdateTimestamp: timestamp,
                        };

                        chatIncrement.messageIncrements.set(event.messageId, messageIncrement);
                    } else {
                        switch (messageIncrement.type) {
                            case "addToMessage":
                                messageIncrement.text += event.messageChunk;
                                messageIncrement.latestUpdateTimestamp = timestamp;
                                break;
                            case "userMessageCreatedEvent":
                                if ("text" in messageIncrement.message) {
                                    messageIncrement.message.text += event.messageChunk;
                                    messageIncrement.latestUpdateTimestamp = timestamp;
                                } else {
                                    throw new Error("Message increment is not of type 'newMessage'");
                                }

                                break;
                        }
                    }

                    break;
                }
                case "newChat": {
                    let messageFound = false;
                    for (let index = chatIncrement.chat.history.length - 1; index >= 0; index--) {
                        const message = chatIncrement.chat.history[index];
                        if (message.id === event.messageId) {
                            if ("text" in message) {
                                message.text += event.messageChunk;
                                messageFound = true;
                            }
                            break;
                        }
                    }

                    if (!messageFound) {
                        CLI.error(`Message with ID ${event.messageId} not found in chat ${chatIncrement.chat.id}`);
                    }
                }
            }

            chatIncrement.latestUpdateTimestamp = timestamp;

            userIncrement.latestUpdateTimestamp = timestamp;
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
    private handleChatCreated(event: BotanikaServerEvent & { type: "chatCreated" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);

            // Get or create chat increment
            const chatIncrement: ChatIncrement = {
                type: "newChat",
                chat: {
                    id: event.chatId,
                    name: "",
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    history: [event.userMessage],
                    userId: userId,
                    shared: false,
                },
                latestUpdateTimestamp: timestamp,
                earliestUpdateTimestamp: timestamp,
            }
            userIncrement.chatIncrements.set(event.chatId, chatIncrement);

        } catch (error) {
            CLI.error(`Error handling chat created event: ${error}`);
        }
    }

    private handleChatNameSet(event: BotanikaServerEvent & { type: "chatNameSet" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            switch (chatIncrement.type){
                case "addToChat":
                    chatIncrement.name = event.name;
                    break;
                case "newChat":
                    chatIncrement.chat.name = event.name;
                    break;
            }

        } catch (error) {
            CLI.error(`Error handling chat name set event: ${error}`);
        }
    }

    /**
     * Calculate the size of an event
     *
     * @param event The event to calculate the size of
     * @returns The size in bytes
     */
    static calculateSize(event: BotanikaServerEvent): number {
        let size = 0;

        switch(event.type) {
            case "error":
            case "log":
            case "warning":
            case "messageTextCompleted":
            case "messageCompleted":
            case "toolCallStarted":
            case "toolCallFinished":
                break;
            case "chatCreated":
                size += IncrementProjector.calculateStringSize(event.userMessage.text);
                break;
            case "messageTextAdded":
                size += IncrementProjector.calculateStringSize(event.messageChunk);
                break;
            case "audioGenerated":
                size += IncrementProjector.calculateStringSize(event.audioUrl);
                break;
            case "chatNameSet":
                size += IncrementProjector.calculateStringSize(event.name);
                break;
            case "updateReferences":
                for (const reference of event.references) {
                    size += IncrementProjector.calculateReferenceSize(reference);
                }
                break;
            case "updateFiles":
                for (const file of event.files) {
                    size += IncrementProjector.calculateFileSize(file);
                }
                break;
            case "messageCreated":
                size += IncrementProjector.calculateMessageSize(event.message);


                break;
        }

        return size;
    }

    private static calculateMessageSize(message: ChatMessage): number {
        let size = 0;

        switch(message.type){
            case "tool":
                size += IncrementProjector.calculateStringSize(JSON.stringify(message.toolInvocations));
                break;
            case "user":
                size += IncrementProjector.calculateStringSize(message.text);
                for (const file of message.files) {
                    size += IncrementProjector.calculateFileSize(file);
                }
                break;
            case "assistant":
                size += IncrementProjector.calculateStringSize(message.text);
                size += IncrementProjector.calculateStringSize(message.model);
                size += IncrementProjector.calculateStringSize(message.provider);
                for (const file of message.files) {
                    size += IncrementProjector.calculateFileSize(file);
                }
                for (const reference of message.references) {
                    size += IncrementProjector.calculateReferenceSize(reference);
                }
                if (message.reasoning) {
                    for (const reasoning of message.reasoning) {
                        switch (reasoning.type) {
                            case "redacted":
                                size += IncrementProjector.calculateStringSize(reasoning.data);
                                break;
                            case "text":
                                size += IncrementProjector.calculateStringSize(reasoning.text);
                                if (reasoning.signature) {
                                    size += IncrementProjector.calculateStringSize(reasoning.signature);
                                }
                                break;
                        }
                    }
                }
                break;
        }

        return size;
    }

    private static calculateReferenceSize(reference: ResourceReference) {
        let size = 0;

        size += IncrementProjector.calculateStringSize(reference.name);
        if (reference.link) size += IncrementProjector.calculateStringSize(reference.link);
        if (reference.imageUrl) size += IncrementProjector.calculateStringSize(reference.imageUrl);
        if (reference.snippet) size += IncrementProjector.calculateStringSize(reference.snippet);

        if (reference.metadata) {
            for (const [key, value] of Object.entries(reference.metadata)) {
                size += IncrementProjector.calculateStringSize(key);
                size += IncrementProjector.calculateStringSize(String(value));
            }
        }

        return size;
    }

    private static calculateFileSize(file: Omit<MessageFile, "id">) {
        let size = 0;
        size += IncrementProjector.calculateStringSize(file.base64);
        size += IncrementProjector.calculateStringSize(file.name);
        size += IncrementProjector.calculateStringSize(file.mimeType);
        return size;
    }

    /**
     * Handle an audio generated event
     * Updates a message increment to indicate it has audio
     * 
     * @param event The audio generated event
     */
    private handleAudioGenerated(event: BotanikaServerEvent & { type: "audioGenerated" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            switch (chatIncrement.type) {
                case "addToChat": {
                    let messageIncrement = chatIncrement.messageIncrements.get(event.messageId);
                    if (!messageIncrement) {
                        messageIncrement = {
                            type: "addToMessage",
                            text: "",
                            files: [],
                            references: [],
                            audio: true,
                            earliestUpdateTimestamp: timestamp,
                            latestUpdateTimestamp: timestamp,
                        };

                        chatIncrement.messageIncrements.set(event.messageId, messageIncrement);
                    } else if (messageIncrement.type === "addToMessage") {
                        messageIncrement.audio = true;
                        messageIncrement.latestUpdateTimestamp = timestamp;
                    }
                    break;
                }
                case "newChat": {
                    for (let index = chatIncrement.chat.history.length - 1; index >= 0; index--) {
                        const message = chatIncrement.chat.history[index];
                        if (message.id === event.messageId && message.type === "assistant") {
                            message.hasAudio = true;
                            break;
                        }
                    }
                    break;
                }
            }

            chatIncrement.latestUpdateTimestamp = timestamp;
            userIncrement.latestUpdateTimestamp = timestamp;
        } catch (error) {
            CLI.error(`Error handling audio generated event: ${error}`);
        }
    }

    /**
     * Handle an update references event
     * Updates a message increment with references
     * 
     * @param event The update references event
     */
    private handleUpdateReferences(event: BotanikaServerEvent & { type: "updateReferences" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            switch (chatIncrement.type) {
                case "addToChat": {
                    let messageIncrement = chatIncrement.messageIncrements.get(event.messageId);
                    if (!messageIncrement) {
                        messageIncrement = {
                            type: "addToMessage",
                            text: "",
                            files: [],
                            references: event.references,
                            earliestUpdateTimestamp: timestamp,
                            latestUpdateTimestamp: timestamp,
                        };

                        chatIncrement.messageIncrements.set(event.messageId, messageIncrement);
                    } else if (messageIncrement.type === "addToMessage") {
                        messageIncrement.references = event.references;
                        messageIncrement.latestUpdateTimestamp = timestamp;
                    }
                    break;
                }
                case "newChat": {
                    for (let index = chatIncrement.chat.history.length - 1; index >= 0; index--) {
                        const message = chatIncrement.chat.history[index];
                        if (message.id === event.messageId && message.type === "assistant") {
                            message.references = event.references;
                            break;
                        }
                    }
                    break;
                }
            }

            chatIncrement.latestUpdateTimestamp = timestamp;
            userIncrement.latestUpdateTimestamp = timestamp;
        } catch (error) {
            CLI.error(`Error handling update references event: ${error}`);
        }
    }

    /**
     * Handle an update files event
     * Updates a message increment with files
     * 
     * @param event The update files event
     */
    private handleUpdateFiles(event: BotanikaServerEvent & { type: "updateFiles" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            // Create message files with IDs
            const files = event.files.map(file => ({
                ...file,
                id: crypto.randomUUID()
            }));

            switch (chatIncrement.type) {
                case "addToChat": {
                    let messageIncrement = chatIncrement.messageIncrements.get(event.messageId);
                    if (!messageIncrement) {
                        messageIncrement = {
                            type: "addToMessage",
                            text: "",
                            files,
                            references: [],
                            earliestUpdateTimestamp: timestamp,
                            latestUpdateTimestamp: timestamp,
                        };

                        chatIncrement.messageIncrements.set(event.messageId, messageIncrement);
                    } else if (messageIncrement.type === "addToMessage") {
                        messageIncrement.files = files;
                        messageIncrement.latestUpdateTimestamp = timestamp;
                    }
                    break;
                }
                case "newChat": {
                    for (let index = chatIncrement.chat.history.length - 1; index >= 0; index--) {
                        const message = chatIncrement.chat.history[index];
                        if (message.id === event.messageId) {
                            message.files = files;
                            break;
                        }
                    }
                    break;
                }
            }

            chatIncrement.latestUpdateTimestamp = timestamp;
            userIncrement.latestUpdateTimestamp = timestamp;
        } catch (error) {
            CLI.error(`Error handling update files event: ${error}`);
        }
    }

    /**
     * Handle a message created event
     * Creates a new message increment
     * 
     * @param event The message created event
     */
    private handleMessageCreated(event: BotanikaServerEvent & { type: "messageCreated" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            switch (chatIncrement.type) {
                case "addToChat": {
                    const messageIncrement: MessageIncrement = {
                        type: "userMessageCreatedEvent",
                        message: event.message,
                        earliestUpdateTimestamp: timestamp,
                        latestUpdateTimestamp: timestamp,
                    };

                    chatIncrement.messageIncrements.set(event.message.id, messageIncrement);
                    break;
                }
                case "newChat": {
                    chatIncrement.chat.history.push(event.message);
                    break;
                }
            }

            chatIncrement.latestUpdateTimestamp = timestamp;
            userIncrement.latestUpdateTimestamp = timestamp;
        } catch (error) {
            CLI.error(`Error handling message created event: ${error}`);
        }
    }

    /**
     * Handle a message text completed event
     * Marks a message as having its text completed
     * 
     * @param event The message text completed event
     */
    private handleMessageTextCompleted(event: BotanikaServerEvent & { type: "messageTextCompleted" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            switch (chatIncrement.type) {
                case "addToChat": {
                    let messageIncrement = chatIncrement.messageIncrements.get(event.messageId);
                    if (!messageIncrement) {
                        messageIncrement = {
                            type: "addToMessage",
                            text: event.text,
                            files: [],
                            references: [],
                            earliestUpdateTimestamp: timestamp,
                            latestUpdateTimestamp: timestamp,
                        };

                        chatIncrement.messageIncrements.set(event.messageId, messageIncrement);
                    } else if (messageIncrement.type === "addToMessage") {
                        messageIncrement.text = event.text;
                        messageIncrement.latestUpdateTimestamp = timestamp;
                    }
                    break;
                }
                case "newChat": {
                    for (let index = chatIncrement.chat.history.length - 1; index >= 0; index--) {
                        const message = chatIncrement.chat.history[index];
                        if (message.id === event.messageId && "text" in message) {
                            message.text = event.text;
                            break;
                        }
                    }
                    break;
                }
            }

            chatIncrement.latestUpdateTimestamp = timestamp;
            userIncrement.latestUpdateTimestamp = timestamp;
        } catch (error) {
            CLI.error(`Error handling message text completed event: ${error}`);
        }
    }

    /**
     * Handle a message completed event
     * Marks a message as finished
     * 
     * @param event The message completed event
     */
    private handleMessageCompleted(event: BotanikaServerEvent & { type: "messageCompleted" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            // Find the last message in the chat
            switch (chatIncrement.type) {
                case "addToChat": {
                    // Find the most recent message increment
                    let latestMessageId: string | null = null;
                    let latestTimestamp = 0;

                    for (const [messageId, messageIncrement] of chatIncrement.messageIncrements.entries()) {
                        if (messageIncrement.latestUpdateTimestamp > latestTimestamp) {
                            latestTimestamp = messageIncrement.latestUpdateTimestamp;
                            latestMessageId = messageId;
                        }
                    }

                    if (latestMessageId) {
                        const messageIncrement = chatIncrement.messageIncrements.get(latestMessageId);
                        if (messageIncrement && messageIncrement.type === "addToMessage") {
                            messageIncrement.finished = true;
                            messageIncrement.latestUpdateTimestamp = timestamp;
                        }
                    }
                    break;
                }
                case "newChat": {
                    // Find the most recent message
                    if (chatIncrement.chat.history.length > 0) {
                        const latestMessage = chatIncrement.chat.history.reduce((latest, current) => 
                            current.time > latest.time ? current : latest
                        );

                        if (latestMessage.type === "assistant") {
                            latestMessage.finished = true;
                        }
                    }
                    break;
                }
            }

            chatIncrement.latestUpdateTimestamp = timestamp;
            userIncrement.latestUpdateTimestamp = timestamp;
        } catch (error) {
            CLI.error(`Error handling message completed event: ${error}`);
        }
    }

    /**
     * Handle a reasoning finished event
     * Updates a message with reasoning details
     * 
     * @param event The reasoning finished event
     */
    private handleReasoningFinished(event: BotanikaServerEvent & { type: "reasoningFinished" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            switch (chatIncrement.type) {
                case "addToChat": {
                    // We don't store reasoning in message increments
                    // This will be handled by the database directly
                    break;
                }
                case "newChat": {
                    for (let index = chatIncrement.chat.history.length - 1; index >= 0; index--) {
                        const message = chatIncrement.chat.history[index];
                        if (message.id === event.messageId && message.type === "assistant") {
                            message.reasoning = event.reasoningDetails;
                            break;
                        }
                    }
                    break;
                }
            }

            chatIncrement.latestUpdateTimestamp = timestamp;
            userIncrement.latestUpdateTimestamp = timestamp;
        } catch (error) {
            CLI.error(`Error handling reasoning finished event: ${error}`);
        }
    }

    /**
     * Handle a tool call started event
     * Updates a message with tool call information
     * 
     * @param event The tool call started event
     */
    private handleToolCallStarted(event: BotanikaServerEvent & { type: "toolCallStarted" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            // Tool calls are complex objects that are stored directly in the database
            // We don't need to update the increments for this event
            // This is handled by the database directly

            chatIncrement.latestUpdateTimestamp = timestamp;
            userIncrement.latestUpdateTimestamp = timestamp;
        } catch (error) {
            CLI.error(`Error handling tool call started event: ${error}`);
        }
    }

    /**
     * Handle a tool call finished event
     * Updates a message with tool call result
     * 
     * @param event The tool call finished event
     */
    private handleToolCallFinished(event: BotanikaServerEvent & { type: "toolCallFinished" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            // Tool calls are complex objects that are stored directly in the database
            // We don't need to update the increments for this event
            // This is handled by the database directly

            chatIncrement.latestUpdateTimestamp = timestamp;
            userIncrement.latestUpdateTimestamp = timestamp;
        } catch (error) {
            CLI.error(`Error handling tool call finished event: ${error}`);
        }
    }

    /**
     * Handle a usage created event
     * Updates a message with usage information
     * 
     * @param event The usage created event
     */
    private handleUsageCreated(event: BotanikaServerEvent & { type: "usageCreated" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            // Usage information is stored directly in the database
            // We don't need to update the increments for this event
            // This is handled by the database directly

            chatIncrement.latestUpdateTimestamp = timestamp;
            userIncrement.latestUpdateTimestamp = timestamp;
        } catch (error) {
            CLI.error(`Error handling usage created event: ${error}`);
        }
    }

    /**
     * Handle a chat deleted event
     * Marks a chat as deleted
     * 
     * @param event The chat deleted event
     */
    private handleChatDeleted(event: BotanikaServerEvent & { type: "chatDeleted" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            // For chat deletion, we don't need to create increments
            // We'll handle this directly in the database
            // Remove the chat from the user's increments if it exists
            const userIncrement = this.userIncrementMap.get(userId);
            if (userIncrement) {
                userIncrement.chatIncrements.delete(event.chatId);
            }
        } catch (error) {
            CLI.error(`Error handling chat deleted event: ${error}`);
        }
    }

    /**
     * Handle a chat deleted after message event
     * Deletes messages after a specific message
     * 
     * @param event The chat deleted after message event
     */
    private handleChatDeletedAfterMessage(event: BotanikaServerEvent & { type: "chatDeletedAfterMessage" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
            const chatIncrement = this.getOrCreateChatIncrement(userIncrement, event.chatId, timestamp);

            switch (chatIncrement.type) {
                case "addToChat": {
                    // We can't easily handle this in increments
                    // This will be handled directly by the database
                    break;
                }
                case "newChat": {
                    // Find the message and remove all messages after it
                    for (let i = 0; i < chatIncrement.chat.history.length; i++) {
                        if (chatIncrement.chat.history[i].id === event.afterMessageId) {
                            if (event.exclusive) {
                                // Remove all messages after this one
                                chatIncrement.chat.history = chatIncrement.chat.history.slice(0, i + 1);
                            } else {
                                // Remove this message and all after it
                                chatIncrement.chat.history = chatIncrement.chat.history.slice(0, i);
                            }
                            break;
                        }
                    }
                    break;
                }
            }

            chatIncrement.latestUpdateTimestamp = timestamp;
            userIncrement.latestUpdateTimestamp = timestamp;
        } catch (error) {
            CLI.error(`Error handling chat deleted after message event: ${error}`);
        }
    }

    /**
     * Handle a chat branched event
     * Creates a new chat based on an existing chat up to a specific message
     * 
     * @param event The chat branched event
     */
    private handleChatBranched(event: BotanikaServerEvent & { type: "chatBranched" }) {
        try {
            const userId = event.userId;
            const timestamp = event.timestamp || Date.now();

            // First, we need to read the original chat
            ChatStorage.readChatContext(userId, event.branchedFromChatId).then(originalChat => {
                if (!originalChat) {
                    CLI.error(`Original chat ${event.branchedFromChatId} not found for branching`);
                    return;
                }

                // Find the message to branch from
                const message = originalChat.history.find(m => m.id === event.messageId);
                if (!message) {
                    CLI.error(`Message ${event.messageId} not found in chat ${event.branchedFromChatId}`);
                    return;
                }

                // Create a new chat context
                const newChat = {
                    ...originalChat,
                    id: event.chatId,
                    branched_from_chat_id: event.branchedFromChatId,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    // Filter history to only include messages up to the specified message
                    history: originalChat.history
                        .filter(m => m.time <= message.time)
                        .map(msg => ({
                            ...msg,
                            id: crypto.randomUUID() // Generate new IDs for all messages
                        }))
                };

                // Create a new chat increment
                const userIncrement = this.getOrCreateUserIncrement(userId, timestamp);
                const chatIncrement: ChatIncrement = {
                    type: "newChat",
                    chat: newChat,
                    earliestUpdateTimestamp: timestamp,
                    latestUpdateTimestamp: timestamp
                };

                userIncrement.chatIncrements.set(event.chatId, chatIncrement);
                userIncrement.latestUpdateTimestamp = timestamp;
            }).catch(error => {
                CLI.error(`Error handling chat branched event: ${error}`);
            });
        } catch (error) {
            CLI.error(`Error handling chat branched event: ${error}`);
        }
    }

    /**
     * Main event handler function that routes events to specific handlers
     * 
     * @param event The event to handle
     */
    public handleEvent(event: ChatEvent) {
        const userIncrement = this.getOrCreateUserIncrement(event.userId, event.timestamp ?? Date.now());

        const additionalSize = IncrementProjector.calculateSize(event);

        userIncrement.size += additionalSize;
        this.size += additionalSize;

        switch (event.type) {
            case "messageTextAdded":
                this.handleMessagesTextAdded(event);
                break;
            case "chatCreated":
                this.handleChatCreated(event);
                break;
            case "chatNameSet":
                this.handleChatNameSet(event);
                break;
            case "audioGenerated":
                this.handleAudioGenerated(event);
                break;
            case "updateReferences":
                this.handleUpdateReferences(event);
                break;
            case "updateFiles":
                this.handleUpdateFiles(event);
                break;
            case "messageCreated":
                this.handleMessageCreated(event);
                break;
            case "messageTextCompleted":
                this.handleMessageTextCompleted(event);
                break;
            case "messageCompleted":
                this.handleMessageCompleted(event);
                break;
            case "reasoningFinished":
                this.handleReasoningFinished(event);
                break;
            case "toolCallStarted":
                this.handleToolCallStarted(event);
                break;
            case "toolCallFinished":
                this.handleToolCallFinished(event);
                break;
            case "usageCreated":
                this.handleUsageCreated(event);
                break;
            case "chatDeleted":
                this.handleChatDeleted(event);
                break;
            case "chatDeletedAfterMessage":
                this.handleChatDeletedAfterMessage(event);
                break;
            case "chatBranched":
                this.handleChatBranched(event);
                break;
        }

        return userIncrement;
    }
}

export function registerIncrementProjectorEventHandler(): () => void {

    // Default 100MB cleanup size
    const cleanupSize = parseInt(process.env.DATABASE_PROJECTOR_GARBAGE_CLEANUP_SIZE || "104857600", 10);

    // Default 512KB per user cleanup size
    const perUserCleanupSize = parseInt(process.env.DATABASE_PROJECTOR_PER_USER_GARBAGE_CLEANUP_SIZE || "524288", 10);

    const userIncrementMap: Map<string, Increment & { size: number }> = new Map();
    let totalSize = 0;
    return eventStore.subscribe(ChatEventTypes, async event => {
        let userIncrement = userIncrementMap.get(event.userId)

        if (!userIncrement) {
            userIncrement = {
                size: 0,
                latestUpdateTimestamp: event.timestamp,
                earliestUpdateTimestamp: event.timestamp
            };

            setTimeout(() => {
                executeIncrement(event.userId).catch(error => {
                    CLI.error(`Error executing increment for user ${event.userId}: ${error}`);
                });
            }, 5000)

            userIncrementMap.set(event.userId, userIncrement);
        }

        const additionalSize = IncrementProjector.calculateSize(event);
        userIncrement.size += additionalSize;
        userIncrement.latestUpdateTimestamp = event.timestamp;

        if (userIncrement.size > perUserCleanupSize || event.type === "messageCompleted") {
            const incrementProjector = new IncrementProjector();
            const consumedEvents = await eventStore.consume({ chatId: event.chatId }, event => {
                incrementProjector.handleEvent(event);
            });
            CLI.debug(`Consumed ${consumedEvents} events for user ${event.userId} to handle increment projection.`);

            await ChatStorage.applyIncrements(event.userId, incrementProjector.userIncrementMap[event.userId]);
        }else{
            totalSize += additionalSize;
        }

        if (totalSize > cleanupSize) {
            CLI.debug(`Total size exceeded ${cleanupSize} bytes, cleaning up user increments...`);

            const biggestUser = [...userIncrementMap.entries()].sort((a, b) => b[1].size - a[1].size);
            while (totalSize > cleanupSize / 2) {
                const [userId, userIncrement] = (biggestUser.pop() ?? []);
                if (!userIncrement || !userId) break;

                totalSize -= userIncrement.size;
                userIncrementMap.delete(userId);

                const incrementProjector = new IncrementProjector();
                const consumedEvents = await eventStore.consume({ chatId: event.chatId }, event => {
                    incrementProjector.handleEvent(event);
                });
                CLI.debug(`Consumed ${consumedEvents} events for user ${event.userId} to handle increment projection.`);

                await ChatStorage.applyIncrements(event.userId, incrementProjector.userIncrementMap[event.userId]);
            }
        }
    });

    async function executeIncrement(userId: string){
        const userIncrement = userIncrementMap.get(userId);
        if (!userIncrement) {
            CLI.debug(`No increment found for user ${userId}`);
            return;
        }

        totalSize -= userIncrement.size;
        userIncrementMap.delete(userId);

        const incrementProjector = new IncrementProjector();
        const consumedEvents = eventStore.consume({ userId }, event => {
            if ("chatId" in event){
                incrementProjector.handleEvent(event);
            }
        });

        CLI.debug(`Consumed ${consumedEvents} events for user ${userId} to handle increment projection.`);

        return ChatStorage.applyIncrements(userId, incrementProjector.userIncrementMap[userId]);
    }
}
