import {GeneratedFile, generateText, LanguageModelV1, StepResult, streamText, ToolSet} from "ai";
import {CLI} from "../../CLI";
import {v4 as uuidv4} from "uuid";
import {updateMessageFromStream} from "./functions";
import {sendError, WebsocketConnection} from "../../websocket-server/websocket.ts";
import {AiMessage} from "./aiMessage.ts";
import {eventStore} from "../../database/events/eventStore.ts";

export async function getSimpleResponse(model: LanguageModelV1, tools: ToolSet, messages: AiMessage[], maxTokens: number = 1000): Promise<{
    thoughts: string | null;
    text: string;
    steps: Array<StepResult<ToolSet>>
}> {
    const res = await generateText({
        model,
        messages,
        maxTokens,
        presencePenalty: 0.6,
        frequencyPenalty: 0.6,
        tools
    });
    if (res.finishReason !== "stop") {
        CLI.warning(`Got finish reason ${res.finishReason}`);
    }

    if (res.text.length === 0) {
        CLI.warning("Got empty response");
        return {
            thoughts: null,
            text: "",
            steps: []
        };
    }

    const thoughts = res.text.match(/<think>(.*?)<\/think>/gms);
    return {
        thoughts: thoughts ? thoughts[0].trim() : null,
        text: res.text.replace(/<think>(.*?)<\/think>/gms, "").trim(),
        steps: res.steps
    };
}

export function streamResponseAsMessage(
    ws: WebsocketConnection,
    maxSteps: number,
    model: LanguageModelV1,
    tools: ToolSet,
    messages: AiMessage[],
    chatId: string
) {
    CLI.debug("Streaming response...");

    const {
        textStream,
        files,
        steps: stepsStream,
        text,
        reasoningDetails,
        usage: usageStream
    } = streamText({
        model,
        messages,
        tools,
        presencePenalty: 0.6,
        frequencyPenalty: 0.6,
        maxSteps,
        maxRetries: 0,
        providerOptions: {
            openai: {
                store: true,
                reasoningSummary: 'detailed',
                reasoning: {
                    effort: "medium"
                }
            }
        },
        onError: event => sendError(ws, JSON.stringify(event.error)),
    });

    const messageId = uuidv4();

    eventStore.publish({
        userId: ws.userId,
        type: "messageCreated",
        chatId: chatId,
        message: {
            id: messageId,
            text: "",
            createdAt: Date.now(),
            type: "assistant",
            model: model.modelId,
            provider: model.provider,
            hasAudio: false,
            files: [],
            finished: false,
            toolInvocations: [],
            usage: {
                completionTokens: 0,
                promptTokens: 0,
                totalTokens: 0
            }
        }
    }).then();

    const updateMessage = updateMessageFromStream(messageId, textStream, chatId, ws.userId);

    const updateFiles = files.then((f: GeneratedFile[]) => {
        CLI.debug(`Generated ${f.length} files`);

        const files = f.map(file => ({
            base64: file.base64,
            mimeType: file.mimeType,
        }));

        eventStore.publish({
            type: "updateFiles",
            userId: ws.userId,
            chatId,
            messageId,
            files
        });

        return files;
    }).catch((err) => {
        console.error(err);
        return [];
    });

    const updateText = text.then((text: string) => {
        eventStore.publish({
            userId: ws.userId,
            type: "messageTextCompleted",
            chatId: chatId,
            messageId,
            text
        });
    }).catch((err) => {
        console.error(err);
        return "";
    });

    const updateReasoning = reasoningDetails.then(r => {
        if (r.length > 0) {
            eventStore.publish({
                userId: ws.userId,
                type: "reasoningFinished",
                chatId: chatId,
                messageId: messageId,
                reasoningDetails: r
            });
        }
        return r;
    }).catch((err) => {
        console.error(err);
        return [];
    });

    const usage = usageStream.then(usage => {
        eventStore.publish({
            userId: ws.userId,
            type: "usageCreated",
            chatId: chatId,
            messageId: messageId,
            usage
        });

        return usage
    }).catch((err) => {
        console.error(err);
        return null;
    });

    const reasoningData = updateReasoning.then(reasoning => {
        if (reasoning.length > 0) {
            eventStore.publish({
                userId: ws.userId,
                type: "reasoningFinished",
                chatId: chatId,
                messageId: messageId,
                reasoningDetails: reasoning
            });
        }

        return reasoning;
    }).catch((err) => {
        console.error(err);
        return [];
    });

    const steps = stepsStream.then((steps: Array<StepResult<ToolSet>>) => {
        /* TODO: Maybe send out a message to the client, but this might be too much data. We want to keep the traffic low.
        broadcastToUser(ws.userId, {
            type: "updateSteps",
            chatId: chatId,
            messageId: message.value.id,
            steps: steps
        });
        */

        return steps;
    }).catch((err) => {
        console.error(err);
        return [];
    });

    return {
        reasoningData,
        steps,
        updateMessage,
        usage,
        updateFiles,
        updateText,
        all() {
            return Promise.allSettled(Object.values(this).filter(x => x instanceof Promise))
        }
    };
}