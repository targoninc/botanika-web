import {IncomingMessage, Server} from "http";
import {WebSocketServer} from "ws";
import {CLI} from "../CLI.ts";
import {URL} from "url";
import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {BotanikaClientEventType} from "../../models/websocket/clientEvents/botanikaClientEventType.ts";
import {BotanikaServerEvent} from "../../models/websocket/serverEvents/botanikaServerEvent.ts";
import {newMessageEventHandler} from "./newMessageEventHandler.ts";
import {signingKey} from "../../index.ts";
import {chatNameChangedEventHandler} from "./chatNameChangedEventHandler.ts";

// Map to store active connections for each user
const userConnections: Map<string, Set<WebsocketConnection>> = new Map();
export const UPDATE_LIMIT = 100;

export function send(ws: WebsocketConnection, message: BotanikaServerEvent) {
    ws.send(JSON.stringify(message));
}

/**
 * Broadcasts a message to all connections for a user
 * @param userId The user ID to broadcast to
 * @param message The message to broadcast
 */
export function broadcastToUser(userId: string, message: BotanikaServerEvent) {
    message.timestamp = message.timestamp ?? Date.now();

    const connections = userConnections.get(userId);
    if (connections) {
        const connectionsArray = Array.from(connections);
        let closedConnections = false;

        for (let i = 0; i < connectionsArray.length; i++) {
            const connection = connectionsArray[i];
            if (connection.readyState === 1) {
                try {
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

export function sendError(ws: WebsocketConnection, message: string) {
    CLI.error(`Error in realtime: ${message}`);
    broadcastToUser(ws.userId, {
        type: "error",
        error: message,
    });
}

export function sendWarning(ws: WebsocketConnection, message: string) {
    CLI.warning(`Warning in realtime: ${message}`);
    broadcastToUser(ws.userId, {
        type: "warning",
        warning: message,
    });
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
                console.error(e);
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
