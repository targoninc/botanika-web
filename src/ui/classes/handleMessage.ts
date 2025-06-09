import {BotanikaServerEvent} from "../../models/websocket/botanikaServerEvent.ts";
import {BotanikaServerEventType} from "../../models/websocket/botanikaServerEventType.ts";

export function handleMessage(event: BotanikaServerEvent<any>) {
    switch (event.type) {
        case BotanikaServerEventType.chatUpdate:
            // TODO
            break;
        case BotanikaServerEventType.error:
            console.error(`Error from server`, event.data);
            break;
        case BotanikaServerEventType.log:
            console.log(`Log from server`, event.data);
            break;
    }
}