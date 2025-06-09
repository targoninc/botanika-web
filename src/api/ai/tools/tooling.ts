import {CLI} from "../../CLI";
import {ChatMessage} from "../../../models/chat/ChatMessage";
import {v4 as uuidv4} from "uuid";
import {currentChatContext} from "../endpoints";
import {ToolResultUnion, ToolSet} from "ai";
import {ChatToolResult} from "../../../models/chat/ChatToolResult";
import {sendChatUpdate, WebsocketConnection} from "src/ui-server/websocket-server/websocket";

export function wrapTool(id: string, execute: (input: any) => Promise<any>, ws: WebsocketConnection, chatId: string) {
    return async (input: any, ...args: any[]) => {
        const newMessage = <ChatMessage>{
            type: "tool",
            text: `Calling tool ${id}`,
            toolResult: <ToolResultUnion<ToolSet>>{
                toolName: id,
                text: null,
                references: [],
            },
            finished: false,
            time: Date.now(),
            references: [],
            id: uuidv4()
        };
        sendChatUpdate(ws, {
            chatId,
            timestamp: Date.now(),
            messages: [newMessage]
        });
        const start = performance.now();
        CLI.debug(`Calling tool ${id}`);
        let result;
        try {
            result = await execute(input);
        } catch (e) {
            result = <ChatToolResult>{
                text: `Tool ${id} failed: ${e.toString()}`,
            };
        }
        const diff = performance.now() - start;
        CLI.success(`Tool ${id} took ${diff.toFixed()} ms to execute`);
        result.messageId = newMessage.id;

        sendChatUpdate(ws, {
            chatId,
            timestamp: Date.now(),
            messages: [{
                ...newMessage,
                time: Date.now(),
                finished: true,
                text: result.text,
                references: result.references,
                // @ts-ignore
                toolResult: {
                    toolName: id,
                    toolCallId: uuidv4(),
                    result,
                    type: "tool-result",
                    args: input
                }
            }]
        });
        return result;
    }
}
