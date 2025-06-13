import {ResourceReference} from "./ResourceReference";
import {ErrorToolResult} from "./ErrorToolResult.ts";

export type ChatToolResult = {
    references: ResourceReference[];
    text: string;
    metadata?: any;
} | ErrorToolResult;

