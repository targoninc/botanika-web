import {BotanikaServerEvent} from "../../../models/websocket/botanikaServerEvent.ts";
import {BotanikaServerEventType} from "../../../models/websocket/botanikaServerEventType.ts";
import {processUpdate} from "../store.ts";
import {ChatUpdate} from "../../../models/chat/ChatUpdate.ts";
import {toast} from "../ui.ts";
import {ServerErrorEvent} from "../../../ui-server/websocket-server/serverErrorEvent.ts";
import {ToastType} from "../../enums/ToastType.ts";
import {ServerWarningEvent} from "../../../ui-server/websocket-server/serverWarningEvent.ts";

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
    }
}