import { CLI } from "../../CLI.ts";
import { registerWebsocketEventHandler } from "../../websocket-server/websocketEventHandler.ts";
import { registerIncrementProjectorEventHandler } from "./incrementProjector.ts";

/**
 * Initializes all event handlers by registering them with the event store
 * This should be called when the application starts
 */
export function initializeEventHandlers(): () => void {
    CLI.log("Initializing event handlers...");

    // Register the WebSocket event handler
    const unsubscribeWebsocket = registerWebsocketEventHandler();
    CLI.log("WebSocket event handler registered");

    // Register the increment projector event handler
    const unsubscribeIncrementProjector = registerIncrementProjectorEventHandler();
    CLI.log("Increment projector event handler registered");

    // Return a function to unregister all handlers if needed
    return () => {
        unsubscribeWebsocket();
        unsubscribeIncrementProjector();
        CLI.log("Event handlers unregistered");
    };
}
