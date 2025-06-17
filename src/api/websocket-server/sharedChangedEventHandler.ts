import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {WebsocketConnection} from "./websocket.ts";
import {eventStore} from "../database/events/eventStore.ts";

export async function sharedChangedEventHandler(ws: WebsocketConnection, request: BotanikaClientEvent & { type: "sharedChanged" }) {
    if (!request.chatId || request.newValue === undefined) {
        throw new Error("Invalid request");
    }
    eventStore.publish({
        type: "chatSharedSet",
        userId: ws.userId,
        chatId: request.chatId,
        shared: request.newValue,
    });
}