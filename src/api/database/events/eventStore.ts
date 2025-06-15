import {
    BotanikaServerEvent,
    BotanikaServerEventType,
    BotanikaServerEventWithTimestamp
} from "../../../models/websocket/serverEvents/botanikaServerEvent.ts";
import { CLI } from "../../CLI.ts";

// Type for event handlers
export type EventHandler<T extends BotanikaServerEventWithTimestamp = BotanikaServerEventWithTimestamp> = (event: T) => Promise<void> | void;

// Type mapping from event type strings to their corresponding event types
export type EventTypeMap = {
    [K in BotanikaServerEventType]: Extract<BotanikaServerEventWithTimestamp, { type: K }>;
};

// Interface for event subscription
interface EventSubscription {
    eventType: BotanikaServerEventType | BotanikaServerEventType[] | '*';
    handler: EventHandler;
    userId?: string; // Optional: only handle events for a specific user
}

export class EventStore {
    private static instance: EventStore;
    private subscriptions: EventSubscription[] = [];
    private eventHistory: BotanikaServerEvent[] = [];

    private constructor() {}

    /**
     * Get the singleton instance of the EventStore
     */
    public static getInstance(): EventStore {
        if (!EventStore.instance) {
            EventStore.instance = new EventStore();
        }
        return EventStore.instance;
    }

    /**
     * Publish an event to the event store
     * This will:
     * 1. Add the event to the event history
     * 2. Notify all subscribers that match the event type and user ID
     * 
     * @param event The event to publish
     */
    public async publish(event: BotanikaServerEvent): Promise<void> {
        event.timestamp ??= Date.now();
        const eventWithTimestamp = event as BotanikaServerEventWithTimestamp;

        this.eventHistory.push(eventWithTimestamp);

        const matchingSubscriptions = this.subscriptions.filter(sub => {
            const typeMatches =
                sub.eventType === '*' || 
                sub.eventType === event.type || 
                (Array.isArray(sub.eventType) && sub.eventType.includes(event.type as BotanikaServerEventType));

            const userMatches = !sub.userId || sub.userId === event.userId;

            return typeMatches && userMatches;
        });

        for (const subscription of matchingSubscriptions) {
            try {
                await subscription.handler(eventWithTimestamp);
            } catch (error) {
                CLI.error(`Error in event handler for event type ${event.type}: ${error}`);
            }
        }
    }

    /**
     * Subscribe to events of a specific type
     * 
     * @param eventType The type of event to subscribe to, or '*' for all events
     * @param handler The handler function to call when an event of the specified type is published
     * @param userId Optional: only handle events for a specific user
     * @returns A function that can be called to unsubscribe
     */
    public subscribe<T extends BotanikaServerEventType>(
        eventType: T,
        handler: EventHandler<EventTypeMap[T]>,
        userId?: string
    ): () => void;

    /**
     * Subscribe to multiple event types
     * 
     * @param eventType Array of event types to subscribe to
     * @param handler The handler function to call when any of the specified event types is published
     * @param userId Optional: only handle events for a specific user
     * @returns A function that can be called to unsubscribe
     */
    public subscribe<T extends BotanikaServerEventType[]>(
        eventType: [...T],
        handler: EventHandler<EventTypeMap[T[number]]>,
        userId?: string
    ): () => void;

    /**
     * Subscribe to all events
     * 
     * @param eventType '*' to subscribe to all events
     * @param handler The handler function to call when any event is published
     * @param userId Optional: only handle events for a specific user
     * @returns A function that can be called to unsubscribe
     */
    public subscribe(
        eventType: '*',
        handler: EventHandler,
        userId?: string
    ): () => void;

    /**
     * Implementation of the subscribe method
     */
    public subscribe(
        eventType: BotanikaServerEventType | BotanikaServerEventType[] | '*',
        handler: EventHandler,
        userId?: string
    ): () => void {
        const subscription: EventSubscription = { eventType, handler, userId };
        this.subscriptions.push(subscription);

        // Return unsubscribe function
        return () => {
            const index = this.subscriptions.indexOf(subscription);
            if (index !== -1) {
                this.subscriptions.splice(index, 1);
            }
        };
    }

    /**
     * Clear all events from the history
     */
    public clearEvents(): void {
        this.eventHistory = [];
    }

    /**
     * Consume all events in the store by processing them with the provided handler
     * and then clearing the event history
     * 
     * @param handler The handler function to process each event
     * @returns The number of events processed
     */
    public async consume(handler: EventHandler): Promise<number>;

    /**
     * Consume events in the store that match the specified criteria by processing them
     * with the provided handler and then clearing those events from the history
     * 
     * @template T Type of events to consume, inferred from the filter properties
     * @param filter An object with properties to filter events by (e.g., { userId: "123", chatId: "456" })
     * @param handler The handler function to process each filtered event
     * @returns The number of events processed
     */
    public async consume<
        F extends Record<string, unknown>,
        T extends BotanikaServerEventWithTimestamp = Extract<
            BotanikaServerEventWithTimestamp,
            { [K in keyof F]: F[K] }
        >
    >(filter: F, handler: EventHandler<T>): Promise<number>;

    public async consume<
        F extends Record<string, unknown> = Record<string, never>,
        T extends BotanikaServerEventWithTimestamp = Extract<
            BotanikaServerEventWithTimestamp,
            { [K in keyof F]: F[K] }
        >
    >(filterOrHandler: F | EventHandler, handlerOrNothing?: EventHandler<T>): Promise<number> {
        // Determine if this is the overload with filter or without
        const hasFilter = handlerOrNothing !== undefined;
        const handler = hasFilter ? handlerOrNothing : filterOrHandler as EventHandler;
        const filter = hasFilter ? filterOrHandler as F : {};

        // Get all events from the history
        const allEvents = [...this.eventHistory];

        // Filter events if a filter is provided
        const events = hasFilter 
            ? allEvents.filter(event => {
                // Check if the event matches all filter criteria
                return Object.entries(filter).every(([key, value]) => 
                    event[key] === value
                );
            }) 
            : allEvents;

        // If we're consuming all events, clear the entire history
        if (!hasFilter) {
            this.clearEvents();
        } 
        // Otherwise, only remove the filtered events
        else if (events.length > 0) {
            this.eventHistory = this.eventHistory.filter(event => 
                !events.includes(event)
            );
        }

        const eventCount = events.length;

        // Process each event with the handler
        for (const event of events) {
            try {
                await handler(event as T);
            } catch (error) {
                CLI.error(`Error in consume handler for event type ${event.type}: ${error}`);
            }
        }

        // Return the number of events processed
        return eventCount;
    }
}

// Export a singleton instance
export const eventStore = EventStore.getInstance();
