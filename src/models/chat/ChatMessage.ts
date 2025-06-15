import {MessageFile} from "./MessageFile.ts";
import {ReasoningDetail} from "../../api/ai/llms/aiMessage.ts";
import {ToolCall} from "./ToolCall.ts";
import {LanguageModelUsage} from "ai";

export interface ChatMessage {
    type: "system" | "user" | "assistant";
    toolInvocations?: ToolCall[];
    files: MessageFile[];
    text: string;
    time: number;
    id: string;
    finished: boolean;
    hasAudio?: boolean;
    provider?: string;
    model?: string;
    reasoning?: ReasoningDetail[];
    usage?: LanguageModelUsage;
}

