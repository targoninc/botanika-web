import {CoreMessage, GeneratedFile, generateText, LanguageModelV1, StepResult, streamText, ToolSet} from "ai";
import {ChatMessage} from "../../../models/chat/ChatMessage";
import {CLI} from "../../CLI";
import {v4 as uuidv4} from "uuid";
import {updateMessageFromStream} from "./functions";
import {LanguageModelSourceV1} from "./models/LanguageModelSourceV1";
import {signal, Signal} from "@targoninc/jess";
import {NewMessageEventData} from "../../../models/websocket/clientEvents/newMessageEventData.ts";
import {broadcastToUser, sendError, WebsocketConnection} from "../../websocket-server/websocket.ts";
import {MessageFile} from "../../../models/chat/MessageFile.ts";
import {browserEmail} from "zod/dist/types/v4/core/regexes";

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

export async function streamResponseAsMessage(ws: WebsocketConnection, maxSteps: number, request: NewMessageEventData, model: LanguageModelV1, tools: ToolSet, messages: CoreMessage[], chatId: string): Promise<Signal<ChatMessage>> {
    CLI.debug("Streaming response...");

    const {
        textStream,
        files,
        steps,
        text,
        sources
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
                store: true
            }
        },
        onError: event => sendError(ws, event?.error?.toString() ?? event.toString()),
    });

    const messageId = uuidv4();
    const message = signal<ChatMessage>({
        id: messageId,
        type: "assistant",
        text: "",
        time: Date.now(),
        finished: false,
        provider: request.provider,
        model: request.model
    });

    const updateMessages = updateMessageFromStream(messageId, textStream, chatId, ws.userId);

    const updateFiles = files.then((f: GeneratedFile[]) => {
        CLI.debug(`Generated ${f.length} files`);
        message.value = {
            ...message.value,
            files: f.map(file => ({
                base64: file.base64,
                mimeType: file.mimeType,
            }))
        };

        broadcastToUser(ws.userId, {
            type: "updateFiles",
            chatId: chatId,
            messageId: message.value.id,
            files: f.map(file => ({
                base64: file.base64,
                mimeType: file.mimeType,
            }))
        });
    }).catch((err) => {
        console.error(err);
    });

    const updateSources = sources.then((sources: LanguageModelSourceV1[]) => {
        CLI.debug(`Got ${sources.length} sources`);
        message.value = {
            ...message.value,
            references: sources.map(source => ({
                name: source.title ?? source.id,
                link: source.url,
                type: "resource-reference",
                snippet: source.id
            }))
        }

        broadcastToUser(ws.userId, {
            type: "updateSources",
            chatId: chatId,
            messageId: messageId,
            sources
        });
    }).catch((err) => {
        console.error(err);
    });

    const updateText = text.then((text: string) => {
        broadcastToUser(ws.userId, {
            type: "messageTextCompleted",
            chatId: chatId,
            messageId: message.value.id,
            text
        });
    }).catch((err) => {
        console.error(err);
    });

    const updateSteps = steps.then((steps: Array<StepResult<ToolSet>>) => {
        /* TODO: Maybe send out a message to the client, but this might be too much data. We want to keep the traffic low.
        broadcastToUser(ws.userId, {
            type: "updateSteps",
            chatId: chatId,
            messageId: message.value.id,
            steps: steps
        });
        */
    }).catch((err) => {
        console.error(err);
    });

    await Promise.allSettled([updateMessages, updateFiles, updateSources, updateSteps, updateText]);

    return message;
}