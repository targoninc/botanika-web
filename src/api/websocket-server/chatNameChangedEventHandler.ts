import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {WebsocketConnection} from "./websocket.ts";
import {eventStore} from "../database/events/eventStore.ts";

export async function chatNameChangedEventHandler(ws: WebsocketConnection, request: BotanikaClientEvent & { type: "chatNameChanged" }) {
    if (!request.chatId || !request.name) {
        throw new Error("Invalid request");
    }

    eventStore.publish({
        userId: ws.userId,
        type: "chatNameSet",
        chatId: request.chatId,
        name: request.name
    });
}