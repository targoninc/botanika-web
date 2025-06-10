import {CLI} from "../../CLI";
import {ChatMessage} from "../../../models/chat/ChatMessage";
import {v4 as uuidv4} from "uuid";
import {ToolResultUnion, ToolSet} from "ai";
import {ChatToolResult} from "../../../models/chat/ChatToolResult";
import {ChatContext} from "../../../models/chat/ChatContext.ts";
import {sendChatUpdate, WebsocketConnection} from "../../../ui-server/websocket-server/websocket.ts";

export function wrapTool(id: string, execute: (input: any) => Promise<any>, ws: WebsocketConnection, chat: ChatContext) {
    return async (input: any, ...args: any[]) => {
        let newMessage = <ChatMessage>{
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
            chatId: chat.id,
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

        newMessage = {
            id: newMessage.id,
            type: "tool",
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
        };
        sendChatUpdate(ws, {
            chatId: chat.id,
            timestamp: Date.now(),
            messages: [newMessage]
        });
        chat.history.push(newMessage);
        return result;
    }
}
