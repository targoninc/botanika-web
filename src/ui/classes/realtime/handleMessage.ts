import {BotanikaServerEvent} from "../../../models/websocket/serverEvents/botanikaServerEvent.ts";
import {BotanikaServerEventType} from "../../../models/websocket/serverEvents/botanikaServerEventType.ts";
import {ChatUpdate} from "../../../models/chat/ChatUpdate.ts";
import {toast} from "../ui.ts";
import {ServerErrorEvent} from "../../../models/websocket/serverEvents/serverErrorEvent.ts";
import {ToastType} from "../../enums/ToastType.ts";
import {ServerWarningEvent} from "../../../models/websocket/serverEvents/serverWarningEvent.ts";
import {activateNextUpdate, chats, currentChatId, updateChats} from "../state/store.ts";
import {updateContext} from "../updateContext.ts";
import {INITIAL_CONTEXT} from "../../../models/chat/initialContext.ts";
import {playAudio} from "../audio/audio.ts";

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

export async function processUpdate(update: ChatUpdate) {
    const chatExists = chats.value.some(c => c.id === update.chatId);

    if (!chatExists) {
        const newChat = updateContext(INITIAL_CONTEXT, update);
        updateChats([...chats.value, newChat]);

        const isFirstUserMessage = update.messages?.length === 1 && update.messages[0].type === "user";
        if (activateNextUpdate.value && isFirstUserMessage) {
            currentChatId.value = update.chatId;
        }
    } else {
        updateChats(chats.value.map(c =>
            c.id === update.chatId ? updateContext(c, update) : c
        ));
    }

    const playableMessage = update.messages?.find(m => m.hasAudio);
    const isLast = playableMessage && update.messages.length > 0 && update.messages[update.messages.length - 1].id === playableMessage.id;
    if (playableMessage && isLast) {
        playAudio(playableMessage.id).then();
    }
}
