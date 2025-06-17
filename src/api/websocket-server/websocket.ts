import {IncomingMessage, Server} from "http";
import {WebSocketServer} from "ws";
import {CLI} from "../CLI.ts";
import {URL} from "url";
import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {newMessageEventHandler} from "./newMessageEventHandler.ts";
import {signingKey} from "../../index.ts";
import {base64Decode} from "../authentication/base64Decode.ts";
import { eventStore } from "../database/events/eventStore.ts";
import { registerConnection, unregisterConnection } from "./websocketEventHandler.ts";
import {chatNameChangedEventHandler} from "./chatNameChangedEventHandler.ts";
import {sharedChangedEventHandler} from "./sharedChangedEventHandler.ts";
import {ChatStorage} from "../storage/ChatStorage.ts";

export function sendError(ws: WebsocketConnection, message: string) {
    CLI.error(`Error in realtime: ${message}`);
    eventStore.publish({
        type: "error",
        userId: ws.userId,
        error: message,
    });
}

export function sendWarning(ws: WebsocketConnection, message: string) {
    CLI.warning(`Warning in realtime: ${message}`);
    eventStore.publish({
        type: "warning",
        userId: ws.userId,
        warning: message,
    });
}

async function handleMessage(event: BotanikaClientEvent & { direction: "toServer" }, ws: WebsocketConnection) {
    if ("chatId" in event && event.chatId) {
        const chatExists = await ChatStorage.chatExists(ws.userId, event.chatId);
        if (!chatExists) {
            throw new Error("Chat not found");
        }
    }

    switch (event.type) {
        case "newMessage":
            await newMessageEventHandler(ws, event);
            break;
        case "chatNameChanged":
            await chatNameChangedEventHandler(ws, event);
            break;
        case "sharedChanged":
            await sharedChangedEventHandler(ws, event);
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
                const parsedPayload = JSON.parse(token.payload);
                info.req.userId = parsedPayload.id;
                info.req.newestEventTimestamp = parsedPayload.newestEventTimestamp;
            } else {
                callback(false, 401, "Invalid token signature in WebSocket connection");
                return;
            }

            callback(true, 200);
        }
    });

    wss.on('connection', async (ws: WebsocketConnection, req: CustomIncomingMessage) => {
        const userId = req.userId;
        CLI.log(`Client connected to WebSocket with userId: ${userId}`);
        ws.userId = userId;

        await catchupUserChats(userId, req.newestEventTimestamp, ws);
        registerConnection(userId, ws);

        ws.on("message", async (msg: string) => {
            const message = JSON.parse(msg) as BotanikaClientEvent;
            CLI.log(`Event: u-${ws.userId}\tt-${message.type}`);
            try {
                if (message.direction === "toServer") {
                    await handleMessage(message, ws);
                }
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

async function catchupUserChats(userId: string, newestEventTimestamp: number | undefined, ws: WebsocketConnection) {
    const fromDate = newestEventTimestamp ? new Date(newestEventTimestamp) : null;

    const chats = await ChatStorage.getUserChats(userId, fromDate);

    await Promise.allSettled(chats.map(async chat => {
        const newestMessage = await ChatStorage.getNewestMessages(chat.id, fromDate);

        ws.send(JSON.stringify({
            type: "newMessages",
            messages: newestMessage,
            chatId: chat.id
        }));
    }));
}

export interface CustomIncomingMessage extends IncomingMessage {
    userId: string;
    newestEventTimestamp?: number;
}


export interface WebsocketConnection extends WebSocket {
    userId: string;
    on: (event: "message" | "close" | "error", listener:
        ((data: string) => void) |
        (() => void) |
        ((error: Error) => void)
    ) => this;
}
