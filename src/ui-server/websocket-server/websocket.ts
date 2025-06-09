import { Server } from "http";
import {WebSocketServer} from "ws";
import {CLI} from "../../api/CLI.ts";

export function addWebsocketServer(server: Server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws'
    });

    // WebSocket connection handler
    wss.on('connection', (ws) => {
        CLI.log('Client connected to WebSocket');

        // Send test event when client connects
        ws.send(JSON.stringify({ type: "test" }));

        // Handle messages from client
        ws.on('message', (message) => {
            console.log('Received message:', message.toString());

            // Echo the message back (for testing)
            ws.send(message.toString());
        });

        // Handle client disconnection
        ws.on('close', () => {
            console.log('Client disconnected from WebSocket');
        });
    });
}