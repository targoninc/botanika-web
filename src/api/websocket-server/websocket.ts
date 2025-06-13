import {IncomingMessage, Server} from "http";
import {WebSocketServer} from "ws";
import {CLI} from "../CLI.ts";
import {URL} from "url";
import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {BotanikaClientEventType} from "../../models/websocket/clientEvents/botanikaClientEventType.ts";
import {BotanikaServerEvent} from "../../models/websocket/serverEvents/botanikaServerEvent.ts";
import {newMessageEventHandler} from "./newMessageEventHandler.ts";
import {BotanikaServerEventType} from "../../models/websocket/serverEvents/botanikaServerEventType.ts";
import {ServerErrorEvent} from "../../models/websocket/serverEvents/serverErrorEvent.ts";
import {ChatUpdate} from "../../models/chat/ChatUpdate.ts";
import {ServerWarningEvent} from "../../models/websocket/serverEvents/serverWarningEvent.ts";
import {signingKey} from "../../index.ts";
import {chatNameChangedEventHandler} from "./chatNameChangedEventHandler.ts";

// Map to store active connections for each user
const userConnections: Map<string, Set<WebsocketConnection>> = new Map();
export const UPDATE_LIMIT = 100;

// Map to store ongoing conversations for each chat
// Key: chatId, Value: { userId: string, updates: ChatUpdate[], lastUpdated: number, isGenerating: boolean }
interface OngoingConversation {
    userId: string;
    updates: ChatUpdate[];
    lastUpdated: number;
    isGenerating: boolean;
}
export const ongoingConversations: Map<string, OngoingConversation> = new Map();

/**
 * Removes a chat from the ongoingConversations map
 * @param chatId The chat ID to remove
 * @param userId The user ID who owns the chat
 * @returns true if the chat was removed, false otherwise
 */
export function removeOngoingConversation(chatId: string, userId: string): boolean {
    const conversation = ongoingConversations.get(chatId);
    if (conversation && conversation.userId === userId) {
        CLI.debug(`Removing conversation ${chatId} for user ${userId} due to chat deletion`);
        ongoingConversations.delete(chatId);
        return true;
    }
    return false;
}

/**
 * Cleans up old conversations from the ongoingConversations map
 * Conversations older than 1 hour are removed
 */
function cleanupOldConversations() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

    for (const [chatId, conversation] of ongoingConversations.entries()) {
        if (now - conversation.lastUpdated > oneHour) {
            CLI.debug(`Removing old conversation ${chatId} for user ${conversation.userId}`);
            ongoingConversations.delete(chatId);
        }
    }
}

setInterval(cleanupOldConversations, 60 * 60 * 1000);

export function send(ws: WebsocketConnection, message: BotanikaServerEvent<any>) {
    ws.send(JSON.stringify(message));
}

/**
 * Broadcasts a message to all connections for a user
 * @param userId The user ID to broadcast to
 * @param message The message to broadcast
 */
export function broadcastToUser(userId: string, message: BotanikaServerEvent<any>) {
    const connections = userConnections.get(userId);
    if (connections) {
        const connectionsArray = Array.from(connections);
        let closedConnections = false;

        for (let i = 0; i < connectionsArray.length; i++) {
            const connection = connectionsArray[i];
            if (connection.readyState === 1) {
                try {
                    CLI.debug(`Broadcasting to conn ${i + 1} for user ${connection.userId}`);
                    connection.send(JSON.stringify(message));
                } catch (e) {
                    CLI.error(`Error sending message to connection: ${e}`);
                    connections.delete(connection);
                    closedConnections = true;
                }
            } else {
                CLI.debug(`Removing closed connection for user ${connection.userId}`);
                connections.delete(connection);
                closedConnections = true;
            }
        }

        if (closedConnections && connections.size === 0) {
            userConnections.delete(userId);
            CLI.debug(`Removed user ${userId} from connections map due to all connections being closed`);
        }
    }
}

/**
 * Sends all updates for a specific chat to a connection
 * @param ws The WebSocket connection to send updates to
 * @param chatId The chat ID to get updates for
 */
export function sendChatHistory(ws: WebsocketConnection, chatId: string) {
    const conversation = ongoingConversations.get(chatId);
    if (conversation && conversation.userId === ws.userId) {
        CLI.debug(`Sending ${conversation.updates.length} updates for chat ${chatId} to user ${ws.userId}`);
        for (const update of conversation.updates) {
            send(ws, {
                type: BotanikaServerEventType.chatUpdate,
                data: update
            });
        }
    }
}

/**
 * Sends all ongoing conversations for a user to a connection
 * @param ws The WebSocket connection to send updates to
 */
export function sendAllOngoingConversations(ws: WebsocketConnection) {
    CLI.debug(`Checking for ongoing conversations for user ${ws.userId}`);
    for (const [chatId, conversation] of ongoingConversations.entries()) {
        if (conversation.userId === ws.userId) {
            sendChatHistory(ws, chatId);

            // If the conversation is still being generated, send a special message
            if (conversation.isGenerating) {
                CLI.debug(`Chat ${chatId} is still generating, sending status to client`);
                send(ws, {
                    type: BotanikaServerEventType.chatUpdate,
                    data: {
                        chatId,
                        timestamp: Date.now(),
                        messages: conversation.updates[conversation.updates.length - 1]?.messages || []
                    }
                });
            }
        }
    }
}

export function sendError(ws: WebsocketConnection, message: string) {
    CLI.error(`Error in realtime: ${message}`);
    const errorEvent = {
        type: BotanikaServerEventType.error,
        data: <ServerErrorEvent>{
            error: message
        }
    };
    broadcastToUser(ws.userId, errorEvent);
}

export function sendWarning(ws: WebsocketConnection, message: string) {
    CLI.warning(`Warning in realtime: ${message}`);
    const warningEvent = {
        type: BotanikaServerEventType.warning,
        data: <ServerWarningEvent>{
            warning: message
        }
    };
    broadcastToUser(ws.userId, warningEvent);
}

export function sendChatUpdate(ws: WebsocketConnection, update: ChatUpdate) {
    const chatUpdateEvent = {
        type: BotanikaServerEventType.chatUpdate,
        data: update
    };

    if (update.chatId) {
        if (!ongoingConversations.has(update.chatId)) {
            ongoingConversations.set(update.chatId, {
                userId: ws.userId,
                updates: [],
                lastUpdated: Date.now(),
                isGenerating: false
            });
        }

        const conversation = ongoingConversations.get(update.chatId);

        if (conversation.userId === ws.userId) {
            if (update.messages) {
                conversation.updates.push(update);

                if (update.messages.some(m => !m.finished)) {
                    conversation.isGenerating = true;
                    CLI.debug(`Chat ${update.chatId} is now generating`);
                } else {
                    conversation.isGenerating = false;
                    CLI.debug(`Chat ${update.chatId} is no longer generating`);
                }
            } else if (update.name) {
                for (const prevUpdate of conversation.updates) {
                    if (!prevUpdate.name) {
                        prevUpdate.name = update.name;
                    }
                }
                conversation.updates.push(update);
            }

            conversation.lastUpdated = Date.now();

            if (conversation.updates.length > UPDATE_LIMIT) {
                conversation.updates = conversation.updates.slice(-UPDATE_LIMIT);
            }
        }
    }

    broadcastToUser(ws.userId, chatUpdateEvent);
}

async function handleMessage(message: BotanikaClientEvent<any>, ws: WebsocketConnection) {
    switch (message.type) {
        case BotanikaClientEventType.message:
            await newMessageEventHandler(ws, message);
            break;
        case BotanikaClientEventType.chatNameChanged:
            await chatNameChangedEventHandler(ws, message);
            break;
    }
}

export function addWebsocketServer(server: Server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws',
        verifyClient: async (info: any, callback) => {
            const url = new URL(info.req.url, info.req.headers.origin);
            const tokenString = url.searchParams.get('token');

            const token = JSON.parse(atob(tokenString)) as {
                payload: string;
                signature: string;
            }

            if (!token || !token.payload || !token.signature) {
                CLI.error("Invalid token received in WebSocket connection");
                callback(false, 400, "Invalid token received in WebSocket connection");
                return;
            }

            const validToken = await crypto.subtle.verify("Ed25519", signingKey.publicKey, Buffer.from(token.signature, 'base64'), new TextEncoder().encode(token.payload));
            if (validToken){
                info.req.userId = JSON.parse(token.payload).id;
            } else {
                CLI.error("Invalid token signature in WebSocket connection");
                callback(false, 401, "Invalid token signature in WebSocket connection");
                return;
            }

            callback(true, 200);
        }
    });

    wss.on('connection', (ws: WebsocketConnection, req: CustomIncomingMessage) => {
        const userId = req.userId;
        CLI.log(`Client connected to WebSocket with userId: ${userId}`);
        ws.userId = userId;

        if (!userConnections.has(userId)) {
            userConnections.set(userId, new Set());
        }
        userConnections.get(userId).add(ws);
        CLI.debug(`User ${userId} now has ${userConnections.get(userId).size} active connections`);

        sendAllOngoingConversations(ws);

        ws.on("message", async (msg: string) => {
            const message = JSON.parse(msg);
            CLI.log(`Event: u-${ws.userId}\tt-${message.type}`);
            try {
                await handleMessage(message, ws);
            } catch (e) {
                CLI.error(e);
                sendError(ws, e);
            }
        });

        ws.on("close", () => {
            CLI.log(`Client disconnected from WebSocket: ${ws.userId}`);

            const userConnectionSet = userConnections.get(userId);
            if (userConnectionSet) {
                userConnectionSet.delete(ws);
                CLI.debug(`User ${userId} now has ${userConnectionSet.size} active connections`);

                if (userConnectionSet.size === 0) {
                    userConnections.delete(userId);
                    CLI.debug(`Removed user ${userId} from connections map`);
                }
            }
        });

        ws.on("error", (err: Error) => {
            CLI.error(`Websocket error: ` + err.message);
        });
    });
}

export interface CustomIncomingMessage extends IncomingMessage {
    userId: string;
}


export interface WebsocketConnection extends WebSocket {
    userId: string;
    on: (event: "message" | "close" | "error", listener:
        ((data: string) => void) |
        (() => void) |
        ((error: Error) => void)
    ) => this;
}
