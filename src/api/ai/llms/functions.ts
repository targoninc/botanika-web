import {ChatMessage} from "../../../models/chat/ChatMessage";
import {Signal} from "@targoninc/jess";
import {sendEvent} from "../../websocket-server/websocket.ts";
import {eventStore} from "../../database/events/eventStore.ts";

export async function updateMessageFromStream(
    messageId: string,
    stream: AsyncIterable<string> & ReadableStream<string>,
    chatId: string,
    userId: string
) {
    const reader = stream.getReader();

    while (true) {
        const {value, done} = await reader.read();
        if (!value && done) {
            break;
        }

        eventStore.publish({
            userId,
            type: "messageTextAdded",
            messageChunk: value,
            chatId: chatId,
            messageId: messageId
        }).then();

        if (done) {
            break;
        }
    }
}