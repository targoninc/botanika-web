import {BotanikaServerEvent} from "../serverEvents/botanikaServerEvent.ts";
import {ChatContext} from "../../chat/ChatContext.ts";
import {ChatMessage} from "../../chat/ChatMessage.ts";
import {LlmProvider} from "../../llms/llmProvider.ts";
import {MessageFile} from "../../chat/MessageFile.ts";

export type BotanikaClientEvent = {
    type: "serverEvent",
    direction: "toClient",
    event: BotanikaServerEvent
} | {
    type: "updateChats",
    direction: "toClient",
    chats: Omit<ChatContext, "history">[]
} | {
    type: "newMessages",
    direction: "toClient",
    messages: ChatMessage[],
    chatId: string
} | {
    type: "newMessage",
    direction: "toServer",
    chatId?: string,
    message: string;
    provider: LlmProvider;
    model: string;
    files: Omit<MessageFile, "id">[],
} | {
    type: "chatNameChanged",
    direction: "toServer",
    name: string,
    chatId: string
} | {
    type: "sharedChanged",
    direction: "toServer",
    newValue: boolean,
    chatId: string
}