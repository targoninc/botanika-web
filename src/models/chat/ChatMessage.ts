import {MessageFile} from "./MessageFile.ts";
import {ReasoningDetail} from "../../api/ai/llms/aiMessage.ts";
import {ToolCall} from "./ToolCall.ts";

export interface ChatMessage {
    type: "system" | "user" | "assistant";
    toolInvocations?: ToolCall[];
    files: MessageFile[];
    reasoning?: ReasoningDetail[];
    text: string;
    time: number;
    id: string;
    finished: boolean;
    hasAudio?: boolean;
    provider?: string;
    model?: string;
}

