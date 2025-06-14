import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {sendEvent, WebsocketConnection} from "./websocket.ts";
import {ChatNameChangedEventData} from "../../models/websocket/clientEvents/chatNameChangedEventData.ts";
import {ChatStorage} from "../storage/ChatStorage.ts";

export async function chatNameChangedEventHandler(ws: WebsocketConnection, message: BotanikaClientEvent<ChatNameChangedEventData>) {
    const request = message.data;
    if (!request.chatId || !request.name) {
        throw new Error("Invalid request");
    }

    const chat = await ChatStorage.readChatContext(ws.userId, request.chatId);
    if (!chat) {
        throw new Error(`Chat ${request.chatId} not found for user ${ws.userId}`);
    }

    chat.name = request.name;
    await ChatStorage.writeChatContext(ws.userId, chat);

    sendEvent({
        userId: ws.userId,
        type: "chatNameSet",
        chatId: request.chatId,
        name: request.name
    });
}