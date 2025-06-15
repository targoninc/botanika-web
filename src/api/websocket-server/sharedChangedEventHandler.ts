import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {WebsocketConnection} from "./websocket.ts";
import {ChatStorage} from "../storage/ChatStorage.ts";
import {SharedChangedEventData} from "../../models/websocket/clientEvents/sharedChangedEventData.ts";
import {eventStore} from "../database/events/eventStore.ts";

export async function sharedChangedEventHandler(ws: WebsocketConnection, message: BotanikaClientEvent<SharedChangedEventData>) {
    const request = message.data;
    if (!request.chatId || request.newValue === undefined) {
        throw new Error("Invalid request");
    }

    const chat = await ChatStorage.readChatContext(ws.userId, request.chatId);
    if (!chat) {
        throw new Error("Chat not found");
    }
    chat.shared = request.newValue;
    eventStore.publish({
        type: "chatSharedSet",
        userId: ws.userId,
        chatId: chat.id,
        shared: chat.shared,
    });
}