import {ChatMessage} from "../../chat/ChatMessage.ts";
import {LanguageModelSourceV1} from "../../../api/ai/llms/models/LanguageModelSourceV1.ts";
import {MessageFile} from "../../chat/MessageFile.ts";
import {ChatToolResult} from "../../chat/ChatToolResult.ts";
import {ToolResultPart, ToolSet} from "ai";
import {ErrorToolResult} from "../../chat/ErrorToolResult.ts";

export type NewMessageEvent = {
    type: "newMessage";
    userMessage: ChatMessage;
    chatId: string;
}

export type MessageTextCompletedEvent = {
    type: "messageTextCompleted";
    chatId: string;
    messageId: string;
    text: string;
}

export type ChatCreatedEvent = {
    type: "chatCreated";
    userMessage: ChatMessage;
    chatId: string;
}

export type UpdateFilesEvent = {
    type: "updateFiles";
    chatId: string;
    messageId: string;
    files: Omit<MessageFile, "id">[];
}

export type UpdateSourcesEvent = {
    type: "updateSources";
    chatId: string;
    messageId: string;
    sources: LanguageModelSourceV1[];
}

export type ChatNameSetEvent = {
    type: "chatNameSet";
    chatId: string;
    name: string;
}

export type ChatUpdateEvent = {
    type: "chatUpdate";
    chatId: string;
    messageChunk: string;
    messageId: string;
}

export type MessageCompletedEvent = {
    type: "messageCompleted";
    chatId: string;
}

export type ErrorEvent = {
    type: "error";
    error: string;
}

export type LogEvent = {
    type: "log";
    log: string;
}

export type WarningEvent = {
    type: "warning";
    warning: string;
}

export type AudioGeneratedEvent = {
    type: "audioGenerated";
    chatId: string;
    messageId: string;
}

export type ToolCallStartedEvent = {
    type: "toolCallStarted";
    chatId: string;
    toolName: string;
    messageId: string;
}

export type ToolCallFinishedEvent = {
    type: "toolCallFinished";
    chatId: string;
    messageId: string;
    toolName: string;
    toolResult: unknown;
}

export type BotanikaServerEvent = {
    timestamp?: number;
} & (
    ChatCreatedEvent
    | ChatUpdateEvent
    | MessageCompletedEvent
    | ErrorEvent
    | LogEvent
    | WarningEvent
    | AudioGeneratedEvent
    | ChatNameSetEvent
    | UpdateSourcesEvent
    | MessageTextCompletedEvent
    | UpdateFilesEvent
    | ToolCallStartedEvent
    | ToolCallFinishedEvent
);

export type BotanikaServerEventType = Extract<BotanikaServerEvent, { type: string }>["type"];