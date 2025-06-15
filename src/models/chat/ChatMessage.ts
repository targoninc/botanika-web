import {MessageFile} from "./MessageFile.ts";
import {ResourceReference} from "./ResourceReference.ts";
import {ReasoningDetail} from "../../api/ai/llms/aiMessage.ts";
import {ToolCall} from "./ToolCall.ts";
import {ToolInvocation} from "@ai-sdk/ui-utils";

type BaseMessage = {
    id: string;
    time: number;
}

export type ToolMessage = BaseMessage & {
    type: "tool";
    toolInvocations: ToolCall[];
}

export type UserMessage = BaseMessage & {
    type: "user";
    text: string;
    files: Omit<MessageFile, "id">[];
}

export type SystemMessage = BaseMessage & {
    type: "system";
    text: string;
}

export type AssistantMessage = BaseMessage & {
    type: "assistant";
    text: string;
    model: string;
    finished: boolean;
    provider: string;
    hasAudio: boolean;
    references: ResourceReference[];
    files: Omit<MessageFile, "id">[];
    reasoning?: ReasoningDetail[];
}

export type ChatMessage = (ToolMessage | UserMessage | SystemMessage | AssistantMessage);

