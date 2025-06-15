import {ChatToolResult} from "./ChatToolResult.ts";

export type ToolCall = {
    toolCallId: string;
    toolName: string;
    args: any;
}

export type PartialToolCall = ToolCall & {
    state: "partial-call";
}

export type ToolCallResult = ToolCall & {
    state: "result";
    result: ChatToolResult;
}

export type ToolCallCall = ToolCall & {
    state: "call";
}