import {IncomingMessage, Server} from "http";
import {WebSocketServer} from "ws";
import {CLI} from "../../api/CLI.ts";
import {userWebsocketMap} from "../ui-server.ts";
import {URL} from "url";
import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {BotanikaClientEventType} from "../../models/websocket/clientEvents/botanikaClientEventType.ts";
import {BotanikaServerEvent} from "../../models/websocket/serverEvents/botanikaServerEvent.ts";
import {newMessageEventHandler} from "./newMessageEventHandler.ts";
import {BotanikaServerEventType} from "../../models/websocket/serverEvents/botanikaServerEventType.ts";
import {ServerErrorEvent} from "../../models/websocket/serverEvents/serverErrorEvent.ts";
import {ChatUpdate} from "../../models/chat/ChatUpdate.ts";
import {ServerWarningEvent} from "../../models/websocket/serverEvents/serverWarningEvent.ts";

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
    console.log(message.type);

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
        verifyClient: (info: any) => {
            const url = new URL(info.req.url, info.req.headers.origin);
            const token = url.searchParams.get('token');

            if (!token || !userWebsocketMap.has(token)) {
                return false;
            }

            info.req.userId = userWebsocketMap.get(token);
            return true;
        }
    });

    wss.on('connection', (ws: WebsocketConnection, req: CustomIncomingMessage) => {
        const userId = req.userId;
        CLI.log(`Client connected to WebSocket with userId: ${userId}`);
        ws.userId = userId;

        ws.on('message', async (msg: string) => {
            const message = JSON.parse(msg);
            CLI.log(`Event: u-${ws.userId}\tt-${message.type}`);
            try {
                await handleMessage(message, ws);
            } catch (e) {
                CLI.error(e);
                sendError(ws, e);
            }
        });

        ws.on('close', () => {
            CLI.log(`Client disconnected from WebSocket: ${ws.userId}`);
        });

        ws.on('error', (err: Error) => {
            CLI.error(`Websocket error: ` + err.message);
        });
    });
}

export interface CustomIncomingMessage extends IncomingMessage {
    userId: string;
}

export interface WebsocketConnection extends WebSocket {
    userId: string;
    on: (eventName: string, handler: Function) => void;
}
