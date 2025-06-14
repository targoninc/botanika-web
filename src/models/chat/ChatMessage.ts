import {MessageFile} from "./MessageFile.ts";
import {ToolResultPart} from "ai";
import {ResourceReference} from "./ResourceReference.ts";
import {ReasoningDetail} from "../../api/ai/llms/aiMessage.ts";

export interface ChatMessage {
    type: "system" | "user" | "assistant" | "tool";
    reasoning?: ReasoningDetail[];
    text: string;
    time: number;
    id: string;
    finished: boolean;
    hasAudio?: boolean;
    provider?: string;
    model?: string;
    toolResult?: ToolResultPart;
    references?: ResourceReference[];
    files?: Omit<MessageFile, "id">[];
}

