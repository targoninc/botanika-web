import {CLI} from "../../CLI";
import {v4 as uuidv4} from "uuid";
import {ChatContext} from "../../../models/chat/ChatContext.ts";
import {ToolExecutionOptions} from "ai";
import {eventStore} from "../../database/events/eventStore.ts";

export function wrapTool<TParams, TResult>(toolName: string, execute: (input: TParams) => Promise<TResult>, userId: string, chat: ChatContext) {
    return async (input: TParams, options: ToolExecutionOptions) => {
        const messageId = uuidv4();
        eventStore.publish({
            userId,
            type: "toolCallStarted",
            chatId: chat.id,
            toolName: toolName,
            messageId,
            toolCallId: options.toolCallId,
        }).then();
        const start = performance.now();
        CLI.debug(`Calling tool ${toolName}`);

        const result = await execute(input)
            .catch(e => ({
                error: `Tool ${toolName} failed: ${e.toString()}`,
            }));

        const diff = performance.now() - start;
        CLI.success(`Tool ${toolName} took ${diff.toFixed()} ms to execute`);

        eventStore.publish({
            userId,
            type: "toolCallFinished",
            chatId: chat.id,
            messageId,
            toolName: toolName,
            toolCallId: options.toolCallId,
            toolResult: result
        }).then();

        return result;
    }
}
