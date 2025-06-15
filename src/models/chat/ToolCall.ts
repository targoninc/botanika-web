import {ChatToolResult} from "./ChatToolResult.ts";

export type BaseToolCall = {
    toolCallId: string;
    toolName: string;
    args: any;
}

export type PartialToolCall = BaseToolCall & {
    state: "partial-call";
}

export type ToolCallResult = BaseToolCall & {
    state: "result";
    result: ChatToolResult;
}

export type ToolCallCall = BaseToolCall & {
    state: "call";
}

export type ToolCall = PartialToolCall | ToolCallResult | ToolCallCall;