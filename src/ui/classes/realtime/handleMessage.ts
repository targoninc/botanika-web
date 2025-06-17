import {BotanikaServerEvent} from "../../../models-shared/websocket/serverEvents/botanikaServerEvent.ts";
import {BotanikaServerEventType} from "../../../models-shared/websocket/serverEvents/botanikaServerEventType.ts";
import {ChatUpdate} from "../../../models-shared/chat/ChatUpdate.ts";
import {toast} from "../ui.ts";
import {ServerErrorEvent} from "../../../models-shared/websocket/serverEvents/serverErrorEvent.ts";
import {ToastType} from "../../enums/ToastType.ts";
import {ServerWarningEvent} from "../../../models-shared/websocket/serverEvents/serverWarningEvent.ts";
import {
    activateNextUpdate,
    chats,
    currentChatId,
    eventStore,
    ttsEnabled,
    updateChats
} from "../state/store.ts";
import {updateContext} from "../updateContext.ts";
import {INITIAL_CONTEXT} from "../../../models-shared/chat/initialContext.ts";
import {playAudio} from "../audio/audio.ts";

export async function handleMessage(event: BotanikaServerEvent<any>) {
    eventStore.publish(event);

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
        let updatedMsgs = [], forceUpdate = false;
        if (update.messages && update.messages.length > 0) {
            forceUpdate = update.messages.at(-1).finished;

            const updatedIds = update.messages.map(m => m.id);
            updatedMsgs = chats.value.flatMap(c => c.history.filter(m => updatedIds.includes(m.id)));
        }

        if (currentChatId.value !== update.chatId || updatedMsgs.length === 0 || forceUpdate) {
            updateChats(chats.value.map(c =>
                c.id === update.chatId ? updateContext(c, update) : c
            ));
        }
    }

    if (update.messages?.length > 0) {
        const lastMessage = update.messages.at(-1);

        if (lastMessage.finished && lastMessage.type === "assistant" && ttsEnabled()) {
            setTimeout(() => {
                playAudio(lastMessage.id).then();
            }, 500);
        }
    }
}
