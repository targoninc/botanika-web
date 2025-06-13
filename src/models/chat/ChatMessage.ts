import {ToolResultPart} from "ai";
import {ResourceReference} from "./ResourceReference.ts";
import {MessageFile} from "./MessageFile.ts";

export interface ChatMessage {
    type: "system" | "user" | "assistant" | "tool";
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

