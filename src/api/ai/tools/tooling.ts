import {CLI} from "../../CLI";
import {ChatMessage} from "../../../models/chat/ChatMessage";
import {v4 as uuidv4} from "uuid";
import {ToolResultUnion, ToolSet} from "ai";
import {ChatToolResult} from "../../../models/chat/ChatToolResult";
import {ChatContext} from "../../../models/chat/ChatContext.ts";
import {sendChatUpdate, WebsocketConnection} from "../../websocket-server/websocket.ts";
import {Signal} from "@targoninc/jess";

async function getToolResult(id: string, execute: (input: any) => Promise<any>, input: any) {
    const start = performance.now();
    CLI.debug(`Calling tool ${id}`);
    let result: ChatToolResult;
    try {
        result = await execute(input);
    } catch (e) {
        result = <ChatToolResult>{
            text: `Tool ${id} failed: ${e.toString()}`,
        };
    }
    const diff = performance.now() - start;
    CLI.success(`Tool ${id} took ${diff.toFixed()} ms to execute`);
    return result;
}

export function wrapTool(id: string, execute: (input: any) => Promise<any>, message: Signal<ChatMessage>) {
    return async (input: any, ...args: any[]) => {
        const assMsg = structuredClone(message.value);
        const callId = uuidv4();
        assMsg.toolInvocations.push({
            toolCallId: callId,
            args: input,
            toolName: id,
            state: "call"
        });
        message.value = assMsg;

        let result = await getToolResult(id, execute, input);

        assMsg.toolInvocations.map(ti => {
            if (ti.toolCallId === callId) {
                return {
                    ...ti,
                    state: "result",
                    result
                };
            }
            return ti;
        });
        message.value = assMsg;
        return result;
    }
}
