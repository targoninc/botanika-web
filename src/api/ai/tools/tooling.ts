import {CLI} from "../../CLI";
import {v4 as uuidv4} from "uuid";
import {ChatContext} from "../../../models/chat/ChatContext.ts";
import {broadcastToUser, WebsocketConnection} from "../../websocket-server/websocket.ts";
import {ToolExecutionOptions} from "ai";

export function wrapTool<TParams, TResult>(toolName: string, execute: (input: TParams) => Promise<TResult>, ws: WebsocketConnection, chat: ChatContext) {
    return async (input: TParams, options: ToolExecutionOptions) => {
        const messageId = uuidv4();
        broadcastToUser(ws.userId, {
            type: "toolCallStarted",
            chatId: chat.id,
            toolName: toolName,
            messageId
        });
        const start = performance.now();
        CLI.debug(`Calling tool ${toolName}`);

        const result = await execute(input)
            .catch(e => ({
                error: `Tool ${toolName} failed: ${e.toString()}`,
            }));

        const diff = performance.now() - start;
        CLI.success(`Tool ${toolName} took ${diff.toFixed()} ms to execute`);

        broadcastToUser(ws.userId, {
            type: "toolCallFinished",
            chatId: chat.id,
            messageId,
            toolName: toolName,
            toolResult: result
        });

        chat.history.push({
            toolResult: {
                type: "tool-result",
                toolName: toolName,
                toolCallId: options.toolCallId,
                result,
                isError: false,
            },
            finished: true,
            text: `Tool ${toolName} finished`,
            time: Date.now(),
            type: "tool",
            id: messageId,
        });
        return result;
    }
}
