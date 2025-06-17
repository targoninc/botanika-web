import { BotanikaServerEvent } from "../../models/websocket/serverEvents/botanikaServerEvent.ts";
import { CLI } from "../CLI.ts";
import { eventStore, EventHandler } from "../database/events/eventStore.ts";
import { WebsocketConnection } from "./websocket.ts";
import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";

const userConnections: Map<string, Set<WebsocketConnection>> = new Map();

/**
 * Register a WebSocket connection for a user
 * 
 * @param userId The user ID
 * @param connection The WebSocket connection
 */
export function registerConnection(userId: string, connection: WebsocketConnection): void {
    let userConnectionSet = userConnections.get(userId);
    if (!userConnectionSet) {
        userConnectionSet = new Set();
        userConnections.set(userId, userConnectionSet);
    }

    userConnectionSet.add(connection);
    CLI.debug(`User ${userId} now has ${userConnectionSet.size} active connections`);
}

/**
 * Unregister a WebSocket connection for a user
 * 
 * @param userId The user ID
 * @param connection The WebSocket connection
 */
export function unregisterConnection(userId: string, connection: WebsocketConnection): void {
    const userConnectionSet = userConnections.get(userId);
    if (userConnectionSet) {
        userConnectionSet.delete(connection);
        CLI.debug(`User ${userId} now has ${userConnectionSet.size} active connections`);

        if (userConnectionSet.size === 0) {
            userConnections.delete(userId);
            CLI.debug(`Removed user ${userId} from connections map`);
        }
    }
}

/**
 * Send a message to a specific WebSocket connection
 *
 * @param connection The WebSocket connection
 * @param message The message to send
 */
export function sendToConnection(connection: WebsocketConnection, message: BotanikaClientEvent): void {
    if (connection.readyState === 1) { // OPEN
        try {
            connection.send(JSON.stringify(message));
        } catch (e) {
            CLI.error(`Error sending message to connection: ${e}`);
            unregisterConnection(connection.userId, connection);
        }
    } else {
        CLI.debug(`Removing closed connection for user ${connection.userId}`);
        unregisterConnection(connection.userId, connection);
    }
}

/**
 * WebSocket event handler that sends events to connected clients
 * 
 * @param event The event to handle
 */
export const websocketEventHandler: EventHandler = (event: BotanikaServerEvent): void => {
    const connections = userConnections.get(event.userId);
    if (connections) {
        const connectionsArray = Array.from(connections);

        for (let i = 0; i < connectionsArray.length; i++) {
            const connection = connectionsArray[i];
            sendToConnection(connection, {
                type: "serverEvent",
                event: event
            });
        }
    }
};

export function registerWebsocketEventHandler() {
    return eventStore.subscribe('*', websocketEventHandler);
}