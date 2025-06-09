import {BotanikaServerEvent} from "../../../models/websocket/botanikaServerEvent.ts";
import {BotanikaServerEventType} from "../../../models/websocket/botanikaServerEventType.ts";
import {processUpdate} from "../store.ts";
import {ChatUpdate} from "../../../models/chat/ChatUpdate.ts";

export async function handleMessage(event: BotanikaServerEvent<any>) {
    switch (event.type) {
        case BotanikaServerEventType.chatUpdate:
            await processUpdate(event.data as ChatUpdate);
            break;
        case BotanikaServerEventType.error:
            console.error(`Error from server`, event.data);
            break;
        case BotanikaServerEventType.log:
            console.log(`Log from server`, event.data);
            break;
    }
}