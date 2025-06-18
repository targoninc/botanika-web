import {BotanikaClientEvent} from "../../models-shared/websocket/clientEvents/botanikaClientEvent.ts";
import {sendChatUpdate, WebsocketConnection} from "./websocket.ts";
import {ChatStorage} from "../storage/ChatStorage.ts";
import {SharedChangedEventData} from "../../models-shared/websocket/clientEvents/sharedChangedEventData.ts";

export async function sharedChangedEventHandler(ws: WebsocketConnection, message: BotanikaClientEvent<SharedChangedEventData>) {
    const request = message.data;
    if (!request.chatId || request.newValue === undefined) {
        throw new Error("Invalid request");
    }

    const chat = await ChatStorage.readChatContext(ws.userId, request.chatId);
    if (!chat) {
        throw new Error("Chat not found");
    }

    const newValue = request.newValue === true;
    if (newValue === chat.shared) {
        return;
    }

    chat.shared = newValue;
    await ChatStorage.writeChatContext(ws.userId, chat);

    sendChatUpdate(ws, {
        chatId: request.chatId,
        timestamp: Date.now(),
        shared: chat.shared
    });
}