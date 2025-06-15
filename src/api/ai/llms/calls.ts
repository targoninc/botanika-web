import {CoreMessage, GeneratedFile, generateText, LanguageModelV1, StepResult, streamText, ToolSet} from "ai";
import {ChatMessage} from "../../../models/chat/ChatMessage";
import {CLI} from "../../CLI";
import {v4 as uuidv4} from "uuid";
import {updateMessageFromStream} from "./functions";
import {LanguageModelSourceV1} from "./models/LanguageModelSourceV1";
import {signal, Signal} from "@targoninc/jess";
import {NewMessageEventData} from "../../../models/websocket/clientEvents/newMessageEventData.ts";
import {sendError, WebsocketConnection} from "../../websocket-server/websocket.ts";
import {AiMessage} from "./aiMessage.ts";
import {eventStore} from "../../database/events/eventStore.ts";

export async function getSimpleResponse(model: LanguageModelV1, tools: ToolSet, messages: CoreMessage[], maxTokens: number = 1000): Promise<{
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

export async function streamResponseAsMessage(
    maxSteps: number,
    model: LanguageModelV1,
    tools: ToolSet,
    messages: AiMessage[],
    chatId: string
): Promise<Signal<{ type: "assistant" } & ChatMessage>> {
    CLI.debug("Streaming response...");

    const {
        textStream,
        files,
        steps,
        text,
        reasoningDetails
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
            time: Date.now(),
            type: "assistant",
            model: request.model,
            provider: request.provider,
            hasAudio: false,
            files: [],
            references: [],
            finished: false
        }
    }).then();

    const updateMessages = updateMessageFromStream(messageId, textStream, chatId, ws.userId);

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

        return text;
    });

    await steps.then((steps: Array<StepResult<ToolSet>>) => {
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

    return signal<ChatMessage>({
        id: messageId,
        type: "assistant",
        text: await updateText,
        time: Date.now(),
        finished: false,
        provider: request.provider,
        model: request.model,
        files: await updateFiles,
        references: await updateSources
    });
}