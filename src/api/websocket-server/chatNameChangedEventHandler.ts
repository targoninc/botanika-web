import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {sendChatUpdate, WebsocketConnection} from "./websocket.ts";
import {ChatNameChangedEventData} from "../../models/websocket/clientEvents/chatNameChangedEventData.ts";
import {ChatStorage} from "../storage/ChatStorage.ts";

export async function chatNameChangedEventHandler(ws: WebsocketConnection, message: BotanikaClientEvent<ChatNameChangedEventData>) {
    const request = message.data;
    if (!request.chatId || !request.name) {
        throw new Error("Invalid request");
    }

    const chat = await ChatStorage.readChatContext(ws.userId, request.chatId);
    chat.name = request.name;
    await ChatStorage.writeChatContext(ws.userId, chat);

    sendChatUpdate(ws, {
        chatId: request.chatId,
        timestamp: Date.now(),
        name: request.name.substring(0, 100),
    });
}