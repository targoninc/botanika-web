import {ChatMessage} from "../../chat/ChatMessage.ts";
import {LanguageModelSourceV1} from "../../../api/ai/llms/models/LanguageModelSourceV1.ts";
import {MessageFile} from "../../chat/MessageFile.ts";
import {ChatToolResult} from "../../chat/ChatToolResult.ts";
import {ToolResultPart, ToolSet} from "ai";
import {ErrorToolResult} from "../../chat/ErrorToolResult.ts";
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
    userMessage: ChatMessage;
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
}

export type ToolCallFinishedEvent = {
    type: "toolCallFinished";
    chatId: string;
    messageId: string;
    toolName: string;
    toolResult: unknown;
}

export type MessageCreatedEvent = {
    type: "messageCreated";
    chatId: string;
    message: ChatMessage;
}

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

export type ChatEvents = Extract<BotanikaServerEvent, { chatId: string }>;
export type MessageEvents = Extract<BotanikaServerEvent, { messageId: string }>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
        k: infer I
    ) => void
    ? I
    : never;

// Converts union to overloaded function
type UnionToOvlds<U> = UnionToIntersection<
    U extends any ? (f: U) => void : never
>;

type PopUnion<U> = UnionToOvlds<U> extends (a: infer A) => void ? A : never;

type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

// Finally me)
type UnionToArray<T, A extends unknown[] = []> = IsUnion<T> extends true
    ? UnionToArray<Exclude<T, PopUnion<T>>, [PopUnion<T>, ...A]>
    : [T, ...A];

type Join<Texts extends string[], SplitCharacter extends string> = Texts extends [string]
    ? Texts[0]
    : Texts extends [infer Item]
        ? Item
    : Texts extends [infer Head extends string, ...infer Tail extends string[]]
        ? `${Head}${SplitCharacter}${Join<Tail, SplitCharacter>}`
        : never

type ChatEventTypes = UnionToArray<ChatEvents["type"]>;
export type ChatEventsString = Join<ChatEventTypes, ",">;
