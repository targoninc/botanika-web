import {MessageFile} from "./MessageFile.ts";
import {ToolInvocation} from "@ai-sdk/ui-utils";
import {ReasoningDetail} from "../../api/ai/llms/aiMessage.ts";

export interface ChatMessage {
    type: "system" | "user" | "assistant";
    toolInvocations?: ToolInvocation[];
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

