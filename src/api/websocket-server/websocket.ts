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

export function send(ws: WebsocketConnection, message: BotanikaServerEvent<any>) {
    ws.send(JSON.stringify(message));
}

export function sendError(ws: WebsocketConnection, message: string) {
    CLI.error(`Error in realtime: ${message}`);
    send(ws, {
        type: BotanikaServerEventType.error,
        data: <ServerErrorEvent>{
            error: message
        }
    });
}

export function sendWarning(ws: WebsocketConnection, message: string) {
    CLI.warning(`Warning in realtime: ${message}`);
    send(ws, {
        type: BotanikaServerEventType.warning,
        data: <ServerWarningEvent>{
            warning: message
        }
    });
}

export function sendChatUpdate(ws: WebsocketConnection, update: ChatUpdate) {
    send(ws, {
        type: BotanikaServerEventType.chatUpdate,
        data: update
    });
}

async function handleMessage(message: BotanikaClientEvent<any>, ws: WebsocketConnection) {
    switch (message.type) {
        case BotanikaClientEventType.message:
            await newMessageEventHandler(ws, message);
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
