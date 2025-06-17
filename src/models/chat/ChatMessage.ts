import {MessageFile} from "./MessageFile.ts";
import {ReasoningDetail} from "../../api/ai/llms/aiMessage.ts";
import {ToolCall} from "./ToolCall.ts";
import {LanguageModelUsage} from "ai";

type BaseMessage = {
    id: string;
    createdAt: number;
}

export type UserMessage = BaseMessage & {
    type: "user";
    text: string;
    files: Omit<MessageFile, "id">[];
}

export type AssistantMessage = BaseMessage & {
    type: "assistant";
    text: string;
    model: string;
    finished: boolean;
    provider: string;
    hasAudio: boolean;
    toolInvocations: ToolCall[];
    files: Omit<MessageFile, "id">[];
    reasoning?: ReasoningDetail[];
    usage: LanguageModelUsage;
}

export type ChatMessage = (UserMessage | AssistantMessage);

