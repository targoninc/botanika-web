import {ChatMessage} from "../../../models/chat/ChatMessage";
import {Signal} from "@targoninc/jess";
import {broadcastToUser} from "../../websocket-server/websocket.ts";

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

        broadcastToUser(userId, {
            type: "chatUpdate",
            messageChunk: value,
            chatId: chatId,
            messageId: messageId
        });

        if (done) {
            break;
        }
        }
}