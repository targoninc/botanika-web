import {CoreMessage, GeneratedFile, generateText, LanguageModelV1, StepResult, streamText, ToolSet} from "ai";
import {ChatMessage} from "../../../models/chat/ChatMessage";
import {CLI} from "../../CLI";
import {updateMessageFromStream} from "./functions";
import {LanguageModelSourceV1} from "./models/LanguageModelSourceV1";
import {signal, Signal} from "@targoninc/jess";
import {sendError, WebsocketConnection} from "../../websocket-server/websocket.ts";
import {MessageFile} from "../../../models/chat/MessageFile.ts";
import {AiMessage} from "./aiMessage.ts";

export async function getSimpleResponse(model: LanguageModelV1, tools: ToolSet, messages: AiMessage[], maxTokens: number = 1000): Promise<{
    thoughts: string;
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
            thoughts: undefined,
            text: "",
            steps: []
        };
    }

    const thoughts = res.text.match(/<think>(.*?)<\/think>/gms);
    return {
        thoughts: thoughts ? thoughts[0].trim() : undefined,
        text: res.text.replace(/<think>(.*?)<\/think>/gms, "").trim(),
        steps: res.steps
    };
}

export async function streamResponseAsMessage(ws: WebsocketConnection, maxSteps: number, message: Signal<ChatMessage>, model: LanguageModelV1, tools: ToolSet, messages: AiMessage[], chatId: string, abortSignal: AbortSignal): Promise<{
    steps: Promise<Array<StepResult<ToolSet>>>
}> {
    CLI.debug("Streaming response...");
    const {
        textStream,
        files,
        steps,
        text,
        reasoningDetails,
        usage
    } = streamText({
        model,
        messages,
        tools,
        presencePenalty: 0.6,
        frequencyPenalty: 0.6,
        maxSteps,
        maxRetries: 0,
        abortSignal,
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

    updateMessageFromStream(message, textStream, text, chatId, ws.userId).then();

    files.then((f: GeneratedFile[]) => {
        CLI.debug(`Generated ${f.length} files`);
        message.value = {
            ...message.value,
            files: f.map(file => <MessageFile>{
                base64: file.base64,
                mimeType: file.mimeType,
            })
        };
    }).catch((err) => {
        console.error(err);
    });

    reasoningDetails.then(r => {
        message.value = {
            ...message.value,
            reasoning: r
        };
    });

    usage.then(u => {
        message.value = {
            ...message.value,
            usage: u
        };
    })

    return {
        steps
    };
}
