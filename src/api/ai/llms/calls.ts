import {CoreMessage, GeneratedFile, generateText, LanguageModelV1, StepResult, streamText, ToolSet} from "ai";
import {ChatMessage} from "../../../models/chat/ChatMessage";
import {CLI} from "../../CLI";
import {updateMessageFromStream} from "./functions";
import {LanguageModelSourceV1} from "./models/LanguageModelSourceV1";
import {signal, Signal} from "@targoninc/jess";
import {NewMessageEventData} from "../../../models/websocket/clientEvents/newMessageEventData.ts";
import {sendEvent, sendError, WebsocketConnection} from "../../websocket-server/websocket.ts";
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

export async function streamResponseAsMessage(ws: WebsocketConnection, maxSteps: number, message: Signal<ChatMessage>, model: LanguageModelV1, tools: ToolSet, messages: AiMessage[], chatId: string): Promise<{
    steps: Promise<Array<StepResult<ToolSet>>>
}> {
export async function streamResponseAsMessage(
    ws: WebsocketConnection,
    maxSteps: number,
    request: NewMessageEventData,
    model: LanguageModelV1,
    tools: ToolSet,
    messages: CoreMessage[],
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
        onError: event => sendError(ws, event?.error?.toString() ?? event.toString()),
    });

    const messageId = uuidv4();

    sendEvent({
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
    });

    const updateMessages = updateMessageFromStream(messageId, textStream, chatId, ws.userId);

    const updateFiles = files.then((f: GeneratedFile[]) => {
        CLI.debug(`Generated ${f.length} files`);

        const files = f.map(file => ({
            base64: file.base64,
            mimeType: file.mimeType,
        }));

        sendEvent({
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

    const updateSources = sources.then((sources: LanguageModelSourceV1[]) => {
        CLI.debug(`Got ${sources.length} sources`);
        const references = sources.map(source => ({
            name: source.title ?? source.id,
            link: source.url,
            type: "resource-reference",
            snippet: source.id
        } as const));

        sendEvent({
            type: "updateReferences",
            userId: ws.userId,
            chatId: chatId,
            messageId: messageId,
            references
        });

        return references;
    }).catch((err) => {
        console.error(err);
        return [];
    });

    const updateText = text.then((text: string) => {
        sendEvent(ws.userId, {
            type: "messageTextCompleted",
            chatId: chatId,
            messageId,
            text
        });

        return text;
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