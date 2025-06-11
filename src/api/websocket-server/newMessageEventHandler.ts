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
import {Signal} from "@targoninc/jess";
import {ChatStorage} from "../storage/ChatStorage.ts";
import {v4 as uuidv4} from "uuid";
import { ModelDefinition } from "../../models/llms/ModelDefinition.ts";
import {LlmProvider} from "../../models/llms/llmProvider.ts";

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

async function getTools(modelDefinition: ModelDefinition, userConfig: Configuration, ws: WebsocketConnection, chat: ChatContext) {
    const mcpInfo = await getMcpTools();
    if (!modelDefinition.capabilities.includes(ModelCapability.tools)) {
        mcpInfo.tools = {};
    }
    const builtInTools = getBuiltInTools(userConfig, ws, chat);
    return {
        mcpInfo,
        tools: Object.assign(builtInTools, mcpInfo.tools) as ToolSet
    };
}

async function finishMessage(m: ChatMessage, ws: WebsocketConnection, chat: ChatContext, userConfig: Configuration) {
    if (m.finished) {
        m.time = Date.now();
        sendChatUpdate(ws, {
            chatId: chat.id,
            timestamp: Date.now(),
            messages: [m]
        });
        chat.history.push(m);
        if (userConfig.enableTts && m.text.length > 0) {
            await sendAudioAndStop(ws, chat.id, m);
        }
    }
}

/**
 * Requests another assistant message without tools just to have a summary or description of what happened
 */
async function requestSimpleIfOnlyToolCalls(ws: WebsocketConnection, userConfig: Configuration,
                               streamResponse: {
                                   message: Signal<ChatMessage>;
                                   steps: Promise<Array<StepResult<ToolSet>>>
                               }, maxSteps: number, model: LanguageModelV1, chat: ChatContext, worldContext: Record<string, any>, request: NewMessageEventData) {
    const steps = await streamResponse.steps;
    const toolResults = steps.flatMap(s => s.toolResults);
    if (toolResults.length === maxSteps) {
        const response = await getSimpleResponse(model, {}, getPromptMessages(chat.history, worldContext, userConfig, true));
        const m = newAssistantMessage(response.text, request.provider, request.model);
        await finishMessage(m, ws, chat, userConfig);
    }
}

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
    }

    const userConfig = await getConfig(ws.userId);
    const model = getModel(request.provider, request.model, userConfig);
    const chat = await getOrCreateChat(ws, request, model, modelSupportsFiles);
    const toolInfo = await getTools(modelDefinition, userConfig, ws, chat);

    /*if (!modelDefinition.capabilities.includes(ModelCapability.tools)) {
        sendWarning(ws, `Model ${request.model} might not support tool calls`);
        toolInfo.tools = {};
    }*/

    const worldContext = getWorldContext();
    const promptMessages = getPromptMessages(chat.history, worldContext, userConfig, modelSupportsFiles);
    const maxSteps = userConfig.maxSteps ?? 5;
    const streamResponse = await streamResponseAsMessage(ws, maxSteps, request, model, toolInfo.tools, promptMessages);

    const streamPromise = new Promise<void>((resolve) => {
        streamResponse.message.subscribe(async (m: ChatMessage) => {
            sendChatUpdate(ws, {
                chatId: chat.id,
                timestamp: Date.now(),
                messages: [m]
            });
            await finishMessage(m, ws, chat, userConfig);
            resolve();
        });
    });
    await requestSimpleIfOnlyToolCalls(ws, userConfig, streamResponse, maxSteps, model, chat, worldContext, request);
    await streamPromise;
    toolInfo.mcpInfo.onClose();

    await ChatStorage.writeChatContext(ws.userId, chat);
}