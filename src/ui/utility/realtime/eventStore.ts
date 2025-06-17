import {BotanikaServerEvent} from "../../../models-shared/websocket/serverEvents/botanikaServerEvent.ts";

type EventListener = (event: BotanikaServerEvent<any>) => void;

export class EventStore {
    private listeners: EventListener[] = [];

    public publish(event: BotanikaServerEvent<any>) {
        this.listeners.forEach(listener => listener(event));
    }

    public subscribe(listener: EventListener) {
        this.listeners.push(listener);
    }

    public unsubscribe(listener: EventListener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }
}