import {CLI} from "../../CLI";
import {ToolExecutionOptions} from "ai";
import {eventStore} from "../../database/events/eventStore.ts";

export function wrapTool<TParams, TResult>(toolName: string, execute: (input: TParams) => Promise<TResult>, userId: string, chatId: string, messageId: string) {
    return async (input: TParams, options: ToolExecutionOptions) => {
        eventStore.publish({
            userId,
            type: "toolCallStarted",
            chatId: chatId,
            toolName: toolName,
            messageId,
            toolCallId: options.toolCallId,
            args: input
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
            chatId: chatId,
            messageId,
            toolName: toolName,
            toolCallId: options.toolCallId,
            toolResult: result
        }).then();

        return result;
    }
}
