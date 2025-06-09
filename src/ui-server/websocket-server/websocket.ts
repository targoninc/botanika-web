import {IncomingMessage, Server} from "http";
import {WebSocketServer} from "ws";
import {CLI} from "../../api/CLI.ts";
import {userWebsocketMap} from "../ui-server.ts";
import {URL} from "url";
import {BotanikaEvent} from "../../models/websocket/botanikaEvent.ts";
import {BotanikaEventType} from "../../models/websocket/botanikaEventType.ts";

function handleMessage(message: BotanikaEvent<any>) {
    switch (message.type) {
        case BotanikaEventType.message:
            break;
        case BotanikaEventType.chatUpdate:
            break;
        case BotanikaEventType.error:
            CLI.error(`Error from user: ${JSON.stringify(message.data)}`);
            break;
        case BotanikaEventType.log:
            CLI.log(`Log from user: ${JSON.stringify(message.data)}`);
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

        ws.on('message', (message: BotanikaEvent<any>) => {
            CLI.log(`Event: u-${ws.userId}\tt-${message.type}`);
            handleMessage(message);
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
