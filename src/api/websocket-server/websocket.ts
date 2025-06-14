import {IncomingMessage, Server} from "http";
import {WebSocketServer} from "ws";
import {CLI} from "../CLI.ts";
import {URL} from "url";
import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {BotanikaClientEventType} from "../../models/websocket/clientEvents/botanikaClientEventType.ts";
import {BotanikaServerEvent} from "../../models/websocket/serverEvents/botanikaServerEvent.ts";
import {newMessageEventHandler} from "./newMessageEventHandler.ts";
import {signingKey} from "../../index.ts";
import {base64Decode} from "../authentication/base64Decode.ts";
import { eventStore } from "../database/events/eventStore.ts";
import { registerConnection, sendToConnection, unregisterConnection } from "./websocketEventHandler.ts";
import {chatNameChangedEventHandler} from "./chatNameChangedEventHandler.ts";

export const UPDATE_LIMIT = 100;

export function send(ws: WebsocketConnection, message: BotanikaServerEvent) {
    sendToConnection(ws, message);
}

/**
 * Publishes an event to the event store
 * @param message The event to publish
 */
export function sendEvent(message: BotanikaServerEvent) {
    message.timestamp = message.timestamp ?? Date.now();
    eventStore.publish(message);
}

export function sendError(ws: WebsocketConnection, message: string) {
    CLI.error(`Error in realtime: ${message}`);
    sendEvent({
        type: "error",
        userId: ws.userId,
        error: message,
    });
}

export function sendWarning(ws: WebsocketConnection, message: string) {
    CLI.warning(`Warning in realtime: ${message}`);
    sendEvent({
        type: "warning",
        userId: ws.userId,
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
            if (!tokenString) {
                callback(false, 400, "No token received in WebSocket connection");
                return;
            }

            const token = JSON.parse(base64Decode(tokenString)) as {
                payload: string;
                signature: string;
            }

            if (!token || !token.payload || !token.signature) {
                callback(false, 400, "Invalid token received in WebSocket connection");
                return;
            }

            const validToken = await crypto.subtle.verify("Ed25519", signingKey.publicKey, Buffer.from(token.signature, 'base64'), new TextEncoder().encode(token.payload));
            if (validToken){
                info.req.userId = JSON.parse(token.payload).id;
            } else {
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

        catchupUserChats(userId, req.newestEventTimestamp, ws);
        registerConnection(userId, ws);

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
            unregisterConnection(userId, ws);
        });

        ws.on("error", (err: Error) => {
            CLI.error(`Websocket error: ` + err.message);
        });
    });
}

export interface CustomIncomingMessage extends IncomingMessage {
    userId: string;
    newestEventTimestamp: number;
}


export interface WebsocketConnection extends WebSocket {
    userId: string;
    on: (event: "message" | "close" | "error", listener:
        ((data: string) => void) |
        (() => void) |
        ((error: Error) => void)
    ) => this;
}
