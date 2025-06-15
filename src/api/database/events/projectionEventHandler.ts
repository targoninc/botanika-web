import { BotanikaServerEvent, BotanikaServerEventType } from "../../../models/websocket/serverEvents/botanikaServerEvent.ts";
import { CLI } from "../../CLI.ts";
import { eventStore, EventHandler } from "./eventStore.ts";
import { db } from "../db.ts";

/**
 * Projection event handler that stores entities to the database based on events
 * This handler processes events and updates the database accordingly
 */
export class ProjectionEventHandler {
    /**
     * Handle a chat created event
     * Creates a new chat in the database
     * 
     * @param event The chat created event
     */
    private static async handleChatCreated(event: BotanikaServerEvent & { type: "chatCreated" }): Promise<void> {
        try {
            await db.chat.upsert({
                where: { id: event.chatId },
                update: {
                    updatedAt: new Date(event.timestamp)
                },
                create: {
                    id: event.chatId,
                    name: "New Chat", // Default name, will be updated later
                    createdAt: new Date(event.timestamp),
                    updatedAt: new Date(event.timestamp),
                    user: {
                        connect: { id: event.userId }
                    }
                }
            });

            // Create the user message
            await db.message.create({
                data: {
                    id: event.userMessage.id,
                    chat: {
                        connect: { id: event.chatId }
                    },
                    provider: event.userMessage.provider,
                    model: event.userMessage.model,
                    createdAt: new Date(event.userMessage.time),
                    finished: event.userMessage.finished,
                    text: event.userMessage.text,
                    type: event.userMessage.type as MessageType,
                    hasAudio: event.userMessage.hasAudio || false,
                    references: event.userMessage.references as any,
                    files: event.userMessage.files as any
                }
            });

            CLI.debug(`Created chat ${event.chatId} for user ${event.userId}`);
        } catch (error) {
            CLI.error(`Error handling chat created event: ${error}`);
        }
    }

    /**
     * Handle a chat name set event
     * Updates the name of a chat in the database
     * 
     * @param event The chat name set event
     */
    private static async handleChatNameSet(event: BotanikaServerEvent & { type: "chatNameSet" }): Promise<void> {
        try {
            await db.chat.update({
                where: { id: event.chatId },
                data: {
                    name: event.name,
                    updatedAt: new Date(event.timestamp)
                }
            });

            CLI.debug(`Updated chat name for ${event.chatId} to "${event.name}"`);
        } catch (error) {
            CLI.error(`Error handling chat name set event: ${error}`);
        }
    }

    /**
     * Handle a message created event
     * Creates a new message in the database
     * 
     * @param event The message created event
     */
    private static async handleMessageCreated(event: BotanikaServerEvent & { type: "messageCreated" }): Promise<void> {
        try {
            const message = event.message;
            
            await db.message.create({
                data: {
                    id: message.id,
                    chat: {
                        connect: { id: event.chatId }
                    },
                    provider: message.provider,
                    model: message.model,
                    createdAt: new Date(message.time),
                    finished: message.finished,
                    text: message.text,
                    type: message.type as MessageType,
                    hasAudio: message.hasAudio || false,
                    references: message.references as any,
                    files: message.files as any
                }
            });

            // Update the chat's updatedAt timestamp
            await db.chat.update({
                where: { id: event.chatId },
                data: {
                    updatedAt: new Date(event.timestamp)
                }
            });

            CLI.debug(`Created message ${message.id} for chat ${event.chatId}`);
        } catch (error) {
            CLI.error(`Error handling message created event: ${error}`);
        }
    }

    /**
     * Handle a message text completed event
     * Updates the text of a message in the database
     * 
     * @param event The message text completed event
     */
    private static async handleMessageTextCompleted(event: BotanikaServerEvent & { type: "messageTextCompleted" }): Promise<void> {
        try {
            await db.message.update({
                where: { id: event.messageId },
                data: {
                    text: event.text,
                    finished: true
                }
            });

            CLI.debug(`Updated message text for ${event.messageId}`);
        } catch (error) {
            CLI.error(`Error handling message text completed event: ${error}`);
        }
    }

    /**
     * Handle an update files event
     * Updates the files of a message in the database
     * 
     * @param event The update files event
     */
    private static async handleUpdateFiles(event: BotanikaServerEvent & { type: "updateFiles" }): Promise<void> {
        try {
            const message = await db.message.findUnique({
                where: { id: event.messageId }
            });

            if (!message) {
                CLI.error(`Message ${event.messageId} not found for update files event`);
                return;
            }

            // Add IDs to the files
            const files = event.files.map((file, index) => ({
                ...file,
                id: `${event.messageId}-file-${index}`
            }));

            await db.message.update({
                where: { id: event.messageId },
                data: {
                    files: files as any
                }
            });

            CLI.debug(`Updated files for message ${event.messageId}`);
        } catch (error) {
            CLI.error(`Error handling update files event: ${error}`);
        }
    }

    /**
     * Handle an update references event
     * Updates the references of a message in the database
     * 
     * @param event The update references event
     */
    private static async handleUpdateReferences(event: BotanikaServerEvent & { type: "updateReferences" }): Promise<void> {
        try {
            await db.message.update({
                where: { id: event.messageId },
                data: {
                    references: event.references as any
                }
            });

            CLI.debug(`Updated references for message ${event.messageId}`);
        } catch (error) {
            CLI.error(`Error handling update references event: ${error}`);
        }
    }

    /**
     * Handle an audio generated event
     * Updates the audio status of a message in the database
     * 
     * @param event The audio generated event
     */
    private static async handleAudioGenerated(event: BotanikaServerEvent & { type: "audioGenerated" }): Promise<void> {
        try {
            await db.message.update({
                where: { id: event.messageId },
                data: {
                    hasAudio: true
                }
            });

            CLI.debug(`Updated audio status for message ${event.messageId}`);
        } catch (error) {
            CLI.error(`Error handling audio generated event: ${error}`);
        }
    }

    /**
     * Main event handler function that routes events to specific handlers
     * 
     * @param event The event to handle
     */
    public static async handleEvent(event: BotanikaServerEvent): Promise<void> {
        try {
            switch (event.type) {
                case "chatCreated":
                    await ProjectionEventHandler.handleChatCreated(event as BotanikaServerEvent & { type: "chatCreated" });
                    break;
                case "chatNameSet":
                    await ProjectionEventHandler.handleChatNameSet(event as BotanikaServerEvent & { type: "chatNameSet" });
                    break;
                case "messageCreated":
                    await ProjectionEventHandler.handleMessageCreated(event as BotanikaServerEvent & { type: "messageCreated" });
                    break;
                case "messageTextCompleted":
                    await ProjectionEventHandler.handleMessageTextCompleted(event as BotanikaServerEvent & { type: "messageTextCompleted" });
                    break;
                case "updateFiles":
                    await ProjectionEventHandler.handleUpdateFiles(event as BotanikaServerEvent & { type: "updateFiles" });
                    break;
                case "updateReferences":
                    await ProjectionEventHandler.handleUpdateReferences(event as BotanikaServerEvent & { type: "updateReferences" });
                    break;
                case "audioGenerated":
                    await ProjectionEventHandler.handleAudioGenerated(event as BotanikaServerEvent & { type: "audioGenerated" });
                    break;
                // Add more handlers for other event types as needed
                default:
                    // Ignore other event types
                    break;
            }
        } catch (error) {
            CLI.error(`Error in projection event handler: ${error}`);
        }
    }
}

// Event handler function that can be registered with the event store
export const projectionEventHandler: EventHandler = ProjectionEventHandler.handleEvent;

// Register the projection event handler with the event store
export function registerProjectionEventHandler(): () => void {
    return eventStore.subscribe('*', projectionEventHandler);
}