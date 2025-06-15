import {AssistantMessage, ChatMessage, ToolMessage, UserMessage} from "../../chat/ChatMessage.ts";
import {MessageFile} from "../../chat/MessageFile.ts";
import {ResourceReference} from "../../chat/ResourceReference.ts";

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
    userMessage: UserMessage;
    chatId: string;
}

export type UpdateFilesEvent = {
    type: "updateFiles";
    chatId: string;
    messageId: string;
    files: Omit<MessageFile, "id">[];
}

export type UpdateReferencesEvent = {
    type: "updateReferences";
    chatId: string;
    messageId: string;
    references: ResourceReference[];
}

export type ChatNameSetEvent = {
    type: "chatNameSet";
    chatId: string;
    name: string;
}

export type MessageTextAddedEvent = {
    type: "messageTextAdded";
    chatId: string;
    messageId: string;
    messageChunk: string;
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
    audioUrl: string;
}

export type ToolCallStartedEvent = {
    type: "toolCallStarted";
    chatId: string;
    toolName: string;
    messageId: string;
    toolCallId: string;
}

export type ToolCallFinishedEvent = {
    type: "toolCallFinished";
    chatId: string;
    messageId: string;
    toolName: string;
    toolResult: unknown;
    toolCallId: string;
}

export type MessageCreatedEvent = {
    type: "messageCreated";
    chatId: string;
    message: UserMessage | AssistantMessage | ToolMessage;
}

export type BotanikaServerEventWithTimestamp = BotanikaServerEvent & { timestamp: number };
export type BotanikaServerEvent = {
    userId: string,
    timestamp?: number;
} & (
    ChatCreatedEvent
    | MessageTextAddedEvent
    | MessageCompletedEvent
    | ErrorEvent
    | LogEvent
    | WarningEvent
    | AudioGeneratedEvent
    | ChatNameSetEvent
    | UpdateReferencesEvent
    | MessageTextCompletedEvent
    | UpdateFilesEvent
    | ToolCallStartedEvent
    | ToolCallFinishedEvent
    | MessageCreatedEvent
);

export type BotanikaServerEventType = Extract<BotanikaServerEvent, { type: string }>["type"];

export type ChatEvent = Extract<BotanikaServerEvent, { chatId: string }>;

// Hacky way to getting the types as an array of strings. This object will cause a compiler error until all keys are defined
const chatEventKeys: {
    [K in ChatEvent["type"]]: true
} = {
    chatCreated: true,
    messageTextAdded: true,
    messageCompleted: true,
    audioGenerated: true,
    chatNameSet: true,
    updateReferences: true,
    messageTextCompleted: true,
    updateFiles: true,
    toolCallStarted: true,
    toolCallFinished: true,
    messageCreated: true
}

export type MessageEvents = Extract<BotanikaServerEvent, { messageId: string }>;
// Hacky way to getting the types as an array of strings. This object will cause a compiler error until all keys are defined
const messageEventKeys: {
    [K in MessageEvents["type"]]: true
} = {
    audioGenerated: true,
    updateReferences: true,
    messageTextCompleted: true,
    updateFiles: true,
    toolCallStarted: true,
    toolCallFinished: true,
    messageTextAdded: true
}

export const ChatEventTypes = Object.keys(chatEventKeys) as ChatEvent["type"][];
export const MessageEventTypes = Object.keys(messageEventKeys) as MessageEvents["type"][];
