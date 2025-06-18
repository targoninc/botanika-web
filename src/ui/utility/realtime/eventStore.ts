import {BotanikaServerEvent} from "../../../models-shared/websocket/serverEvents/botanikaServerEvent.ts";

type EventListener = (event: BotanikaServerEvent<any>) => void;

interface ContextualListener {
    entityId: string | null;
    contextType: string;
    listener: EventListener;
}

export class EventStore {
    private listeners: EventListener[] = [];
    private contextualListeners: Map<string, ContextualListener> = new Map();

    public publish(event: BotanikaServerEvent<any>) {
        this.listeners.forEach(listener => listener(event));

        // Also publish to contextual listeners
        this.contextualListeners.forEach(contextualListener => {
            contextualListener.listener(event);
        });
    }

    /**
     * Subscribe to events
     * @param listener The event listener function
     * @param entityId Optional entity ID to associate with this listener
     * @param contextType Optional context type to associate with this listener
     */
    public subscribe(listener: EventListener, entityId?: string | null, contextType?: string) {
        // If no entityId or contextType is provided, add to general listeners
        if (entityId === undefined || contextType === undefined) {
            this.listeners.push(listener);
            return;
        }

        // Create a unique key for this entity and context
        const key = `${entityId || 'null'}-${contextType}`;

        // Store the contextual listener
        this.contextualListeners.set(key, {
            entityId,
            contextType,
            listener
        });
    }

    /**
     * Unsubscribe from events
     * @param listener The event listener function to remove
     * @param entityId Optional entity ID associated with this listener
     * @param contextType Optional context type associated with this listener
     */
    public unsubscribe(listener: EventListener, entityId?: string | null, contextType?: string) {
        // If no entityId or contextType is provided, remove from general listeners
        if (entityId === undefined || contextType === undefined) {
            this.listeners = this.listeners.filter(l => l !== listener);
            return;
        }

        // Create a unique key for this entity and context
        const key = `${entityId || 'null'}-${contextType}`;

        // Remove the contextual listener if it exists
        this.contextualListeners.delete(key);
    }
}
