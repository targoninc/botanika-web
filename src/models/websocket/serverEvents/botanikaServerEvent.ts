import {AssistantMessage, ChatMessage, UserMessage} from "../../chat/ChatMessage.ts";
import {MessageFile} from "../../chat/MessageFile.ts";
import {ResourceReference} from "../../chat/ResourceReference.ts";
import {ReasoningDetail} from "../../../api/ai/llms/aiMessage.ts";
import {LanguageModelUsage} from "ai";
import {ToolInvocation} from "@ai-sdk/ui-utils";

export type UserMessageCreatedEvent = {
    type: "userMessageCreatedEvent";
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

export type ChatDeletedEvent = {
    type: "chatDeleted";
    chatId: string;
}

export type UsageCreatedEvent = {
    type: "usageCreated";
    chatId: string;
    messageId: string;
    usage: LanguageModelUsage;
}

export type ReasoningFinishedEvent = {
    type: "reasoningFinished";
    chatId: string;
    messageId: string;
    reasoningDetails: ReasoningDetail[];
}

export type UpdateFilesEvent = {
    type: "updateFiles";
    chatId: string;
    messageId: string;
    files: MessageFile[];
}

export type UpdateToolInvocationsEvent = {
    type: "updateToolInvocations";
    chatId: string;
    messageId: string;
    toolInvocations: ToolInvocation[];
}

export type ChatNameSetEvent = {
    type: "chatNameSet";
    chatId: string;
    name: string;
}

export type ChatSharedSetEvent = {
    type: "chatSharedSet";
    chatId: string;
    shared: boolean;
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
    message: UserMessage | AssistantMessage;
}

export type BotanikaServerEventWithTimestamp = BotanikaServerEvent & { timestamp: number };
export type ChatBranchedEvent = {
    type: "chatBranched";
    chatId: string;
    messageId: string;
    branchedFromChatId: string;
}

export type ChatDeletedAfterMessageEvent = {
    type: "chatDeletedAfterMessage";
    chatId: string;
    afterMessageId: string;
    exclusive: boolean;
}

export type BotanikaServerEvent = {
    userId: string,
    timestamp?: number;
} & (
    ChatCreatedEvent
    | UserMessageCreatedEvent
    | MessageTextAddedEvent
    | MessageCompletedEvent
    | ErrorEvent
    | LogEvent
    | WarningEvent
    | AudioGeneratedEvent
    | ChatNameSetEvent
    | ChatSharedSetEvent
    | UpdateToolInvocationsEvent
    | MessageTextCompletedEvent
    | UpdateFilesEvent
    | ToolCallStartedEvent
    | ToolCallFinishedEvent
    | MessageCreatedEvent
    | ReasoningFinishedEvent
    | UsageCreatedEvent
    | ChatDeletedEvent
    | ChatBranchedEvent
    | ChatDeletedAfterMessageEvent
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
    chatSharedSet: true,
    updateToolInvocations: true,
    messageTextCompleted: true,
    updateFiles: true,
    toolCallStarted: true,
    toolCallFinished: true,
    messageCreated: true,
    reasoningFinished: true,
    userMessageCreatedEvent: true,
    usageCreated: true,
    chatDeleted: true,
    chatBranched: true,
    chatDeletedAfterMessage: true
}

export type MessageEvents = Extract<BotanikaServerEvent, { messageId: string }>;
// Hacky way to getting the types as an array of strings. This object will cause a compiler error until all keys are defined
const messageEventKeys: {
    [K in MessageEvents["type"]]: true
} = {
    audioGenerated: true,
    updateToolInvocations: true,
    messageTextCompleted: true,
    updateFiles: true,
    toolCallStarted: true,
    toolCallFinished: true,
    messageTextAdded: true,
    reasoningFinished: true,
    usageCreated: true,
    chatBranched: true
}

export const ChatEventTypes = Object.keys(chatEventKeys) as ChatEvent["type"][];
export const MessageEventTypes = Object.keys(messageEventKeys) as MessageEvents["type"][];
