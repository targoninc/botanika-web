import {ResourceReference} from "./ResourceReference";
import {ToolResultUnion, ToolSet} from "ai";
import {MessageFile} from "./MessageFile.ts";

export interface ChatMessage {
    type: "system" | "user" | "assistant" | "tool";
    references: ResourceReference[];
    files: MessageFile[];
    toolResult?: ToolResultUnion<ToolSet>;
    text: string;
    time: number;
    id: string;
    finished: boolean;
    hasAudio?: boolean;
    provider?: string;
    model?: string;
}

