import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {NewMessageEventData} from "../../models/websocket/clientEvents/newMessageEventData.ts";
import {sendChatUpdate, sendWarning, WebsocketConnection} from "./websocket.ts";
import {getAvailableModels, getModel} from "../ai/llms/models.ts";
import {getConfig} from "../configuration.ts";
import {CLI} from "../CLI.ts";
import {
    createChat, getChatName,
    getPromptMessages,
    getWorldContext,
    newAssistantMessage,
    newUserMessage
} from "../ai/llms/messages.ts";
import {LanguageModelV1, StepResult, ToolSet} from "ai";
import {ChatContext} from "../../models/chat/ChatContext.ts";
import {getMcpTools} from "../ai/initializer.ts";
import {ModelCapability} from "../../models/llms/ModelCapability.ts";
import {getBuiltInTools} from "../ai/tools/servers/allTools.ts";
import {Configuration} from "../../models/Configuration.ts";
import {getSimpleResponse, streamResponseAsMessage} from "../ai/llms/calls.ts";
import {ChatMessage} from "../../models/chat/ChatMessage.ts";
import {sendAudioAndStop} from "../ai/endpoints.ts";
import {signal, Signal} from "@targoninc/jess";
import {ChatStorage} from "../storage/ChatStorage.ts";
import {v4 as uuidv4} from "uuid";
import { ModelDefinition } from "../../models/llms/ModelDefinition.ts";
import {LlmProvider} from "../../models/llms/llmProvider.ts";
import {updateConversation} from "../ai/llms/functions.ts";

async function createNewChat(ws: WebsocketConnection, request: NewMessageEventData, model: LanguageModelV1) {
    CLI.debug(`Creating chat for user ${ws.userId}`);
    const chatId = uuidv4();
    const chatMsg = newUserMessage(request.provider, request.model, request.message, request.files);
    sendChatUpdate(ws, {
        chatId: chatId,
        timestamp: Date.now(),
        messages: [chatMsg]
    });

    let chat: ChatContext;
    try {
        chat = await createChat(ws.userId, chatMsg, chatId);
        getChatName(model, chatMsg.text).then(name => {
            const newLineIndex = name.indexOf("\n");
            name = name.substring(0, newLineIndex === -1 ? 100 : newLineIndex).substring(0, 100);
            sendChatUpdate(ws, {
                chatId: chat.id,
                timestamp: Date.now(),
                name,
            });
            chat.name = name;
        });
    } catch (e) {
        throw new Error("An error occurred while creating the chat", {
            cause: e
        });
    }

    sendChatUpdate(ws, {
        chatId: chatId,
        timestamp: Date.now(),
        name: chat.name
    });

    CLI.debug(`Chat created for user ${ws.userId}`);
    return chat;
}

async function getOrCreateChat(ws: WebsocketConnection, request: NewMessageEventData, model: LanguageModelV1, modelSupportsFiles: boolean) {
    let chat: ChatContext;
    if (!request.chatId) {
        chat = await createNewChat(ws, request, model);
    } else {
        CLI.debug(`Getting existing chat`);
        chat = await ChatStorage.readChatContext(ws.userId, request.chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }

        CLI.debug(`${chat.history.length} existing messages`);
        chat.history.push(newUserMessage(request.provider, request.model, request.message, modelSupportsFiles ? request.files : []));
        sendChatUpdate(ws, {
            chatId: chat.id,
            timestamp: Date.now(),
            messages: chat.history
        });
    }
    return chat;
}

async function getTools(modelDefinition: ModelDefinition, userConfig: Configuration, ws: WebsocketConnection, message: Signal<ChatMessage>) {
    const mcpInfo = await getMcpTools(ws.userId);
    if (!modelDefinition.capabilities.includes(ModelCapability.tools)) {
        mcpInfo.tools = {};
    }
    const builtInTools = getBuiltInTools(userConfig, message);
    return {
        mcpInfo,
        tools: Object.assign(builtInTools, mcpInfo.tools) as ToolSet
    };
}

/**
 * Requests another assistant message without tools just to have a summary or description of what happened
 */
async function requestSimpleIfOnlyToolCalls(ws: WebsocketConnection, message: Signal<ChatMessage>, userConfig: Configuration,
                               streamResponse: {
                                   steps: Promise<Array<StepResult<ToolSet>>>
                               }, maxSteps: number, model: LanguageModelV1, chat: ChatContext, worldContext: Record<string, any>) {
    const steps = await streamResponse.steps;
    const toolResults = steps.flatMap(s => s.toolResults);
    if (toolResults.length === maxSteps) {
        const response = await getSimpleResponse(model, {}, getPromptMessages(chat.history, worldContext, userConfig, true), 10000);

        const m = structuredClone(message.value);

        m.time = Date.now();
        m.finished = true;
        m.text = response.text;

        message.value = m;

        if (userConfig.enableTts && m.text.length > 0) {
            await sendAudioAndStop(ws, chat.id, m);
        }
    }
}

// Map to store active abort controllers for each chat
export const activeAbortControllers = new Map<string, AbortController>();

export async function newMessageEventHandler(ws: WebsocketConnection, message: BotanikaClientEvent<NewMessageEventData>) {
    const request = message.data;
    if (!request.message || !request.provider || !request.model || !Object.values(LlmProvider).includes(request.provider)) {
        throw new Error("Invalid request");
    }

    const availableModels = getAvailableModels(request.provider);
    const modelDefinition = availableModels.find(m => m.id === request.model);
    if (!modelDefinition) {
        throw new Error(`Model ${request.model} not found in provider ${request.provider}`);
    }
    const modelSupportsFiles = modelDefinition.capabilities.includes(ModelCapability.fileInput);
    if (!modelSupportsFiles && request.files.length > 0) {
        sendWarning(ws, "Model does not support file input, files will be ignored");
        request.files = [];
    }

    const userConfig = await getConfig(ws.userId);
    const model = getModel(request.provider, request.model, userConfig);
    const chat = await getOrCreateChat(ws, request, model, modelSupportsFiles);
    const messageId = uuidv4();
    const assMessage = signal<ChatMessage>({
        id: messageId,
        type: "assistant",
        text: "",
        time: Date.now(),
        files: [],
        finished: false,
        provider: request.provider,
        model: request.model
    });
    const toolInfo = await getTools(modelDefinition, userConfig, ws, assMessage);

    /*if (!modelDefinition.capabilities.includes(ModelCapability.tools)) {
        sendWarning(ws, `Model ${request.model} might not support tool calls`);
        toolInfo.tools = {};
    }*/

    const worldContext = getWorldContext();
    const promptMessages = getPromptMessages(chat.history, worldContext, userConfig, modelSupportsFiles);
    const maxSteps = userConfig.maxSteps ?? 5;

    // Create a new AbortController for this chat
    const abortController = new AbortController();
    activeAbortControllers.set(chat.id, abortController);


    function getListener(chatId: string, userId: string, message: Signal<ChatMessage>) {
        return () => {
            updateConversation(chatId, userId, message.value, true);
        }
    }

    const listener = getListener(chat.id, ws.userId, assMessage);
    assMessage.subscribe(listener);

    const streamResponse = await streamResponseAsMessage(ws, maxSteps, assMessage, model, toolInfo.tools, promptMessages, chat.id, abortController.signal);

    // Wait for the steps to complete
    await streamResponse.steps;

    // Wait for the message to be finished
    const waitForMessageFinished = new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
            if (assMessage.value.finished) {
                clearInterval(checkInterval);
                chat.history.push(assMessage.value);
                if (userConfig.enableTts && assMessage.value.text.length > 0) {
                    sendAudioAndStop(ws, chat.id, assMessage.value).then(() => {
                        resolve();
                    });
                } else {
                    resolve();
                }
            }
        }, 100);
    });

    await requestSimpleIfOnlyToolCalls(ws, assMessage, userConfig, streamResponse, maxSteps, model, chat, worldContext);
    await waitForMessageFinished;

    // Cleanup
    assMessage.unsubscribe(listener);
    toolInfo.mcpInfo.onClose();
    activeAbortControllers.delete(chat.id);

    chat.history.map(m => {
        if (m.id === assMessage.value.id) {
            return assMessage.value;
        }
        return m;
    });

    await ChatStorage.writeChatContext(ws.userId, chat);

    CLI.success("Request finished successfully");
}
