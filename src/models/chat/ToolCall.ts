import {ChatToolResult} from "./ChatToolResult.ts";

export interface ToolCall {
    toolCallId: string;
    toolName: string;
    args: any;
    state: "result" | "call" | "partial-call";
    result?: ChatToolResult | null;
}