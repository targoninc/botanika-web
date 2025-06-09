import { Server } from "http";
import {WebSocketServer} from "ws";
import {CLI} from "../../api/CLI.ts";
import {userWebsocketMap} from "../ui-server.ts";
import {URL} from "url";
import { IncomingMessage } from "http";

export function addWebsocketServer(server: Server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws',
        // Add verification of the token
        verifyClient: (info) => {
            const url = new URL(info.req.url, `${info.req.headers.origin}`);
            const token = url.searchParams.get('token');

            if (!token || !userWebsocketMap.has(token)) {
                return false;
            }

            // Store the userId in the request object for later use
            info.req.userId = userWebsocketMap.get(token);
            return true;
        }
    });

    // WebSocket connection handler
    wss.on('connection', (ws: WebsocketConnection, req: CustomIncomingMessage) => {
        // Now you can access the user ID
        const userId = req.userId;
        CLI.log(`Client connected to WebSocket with userId: ${userId}`);

        // Send test event when client connects
        ws.send(JSON.stringify({ type: "test" }));

        // Store the userId with the WebSocket connection
        ws.userId = userId;

        // Handle messages from client
        ws.on('message', (message) => {
            console.log(`Received message from user ${ws.userId}:`, message.toString());

            // Echo the message back (for testing)
            ws.send(message.toString());
        });

        // Handle client disconnection
        ws.on('close', () => {
            console.log(`Client disconnected from WebSocket: ${ws.userId}`);
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