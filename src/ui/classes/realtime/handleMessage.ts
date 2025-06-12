import {BotanikaServerEvent} from "../../../models/websocket/serverEvents/botanikaServerEvent.ts";
import {BotanikaServerEventType} from "../../../models/websocket/serverEvents/botanikaServerEventType.ts";
import {ChatUpdate} from "../../../models/chat/ChatUpdate.ts";
import {toast} from "../ui.ts";
import {ServerErrorEvent} from "../../../models/websocket/serverEvents/serverErrorEvent.ts";
import {ToastType} from "../../enums/ToastType.ts";
import {ServerWarningEvent} from "../../../models/websocket/serverEvents/serverWarningEvent.ts";
import {processUpdate} from "../state/store.ts";

export async function handleMessage(event: BotanikaServerEvent<any>) {
    switch (event.type) {
        case BotanikaServerEventType.chatUpdate:
            await processUpdate(event.data as ChatUpdate);
            break;
        case BotanikaServerEventType.error:
            console.error(`Error from server`, event.data);
            toast(`Error from server: ${(event.data as ServerErrorEvent).error}`, null, ToastType.negative);
            break;
        case BotanikaServerEventType.warning:
            console.warn(`Warning from server`, event.data);
            toast(`Warning from server: ${(event.data as ServerWarningEvent).warning}`, null, ToastType.sensitive);
            break;
        case BotanikaServerEventType.log:
            console.log(`Log from server`, event.data);
            break;
        default:
            console.warn(`Don't know what to do with websocket message`, event);
            break;
    }
}