import {LlmProvider} from "src/models/llms/llmProvider.ts";
import {BotanikaClientEvent} from "../../models/websocket/botanikaClientEvent.ts";
import {NewMessageEventData} from "../../models/websocket/newMessageEventData.ts";
import {sendChatUpdate, WebsocketConnection} from "./websocket.ts";
import {getAvailableModels, getModel} from "../../api/ai/llms/models.ts";
import {getConfig} from "../../api/configuration.ts";
import {CLI} from "../../api/CLI.ts";
import {
    createChat,
    getPromptMessages,
    getWorldContext,
    newAssistantMessage,
    newUserMessage
} from "../../api/ai/llms/messages.ts";
import {LanguageModelV1, StepResult, ToolSet} from "ai";
import {ChatContext} from "../../models/chat/ChatContext.ts";
import {getMcpTools} from "../../api/ai/initializer.ts";
import {ModelCapability} from "../../models/llms/ModelCapability.ts";
import {getBuiltInTools} from "../../api/ai/tools/servers/allTools.ts";
import { ModelDefinition } from "src/models/llms/ModelDefinition.ts";
import {Configuration} from "../../models/Configuration.ts";
import {getSimpleResponse, streamResponseAsMessageNew} from "../../api/ai/llms/calls.ts";
import {ChatMessage} from "../../models/chat/ChatMessage.ts";
import {sendAudioAndStopNew} from "../../api/ai/endpoints.ts";
import {Signal} from "@targoninc/jess";
import {ChatStorageNew} from "../../api/storage/ChatStorageNew.ts";

async function createNewChat(ws: WebsocketConnection, request: NewMessageEventData, model: LanguageModelV1) {
    CLI.debug(`Creating chat for user ${ws.userId}`);
    const chatMsg = newUserMessage(request.provider, request.model, request.message);
    let chat: ChatContext;
    try {
        chat = await createChat(ws.userId, model, chatMsg);
    } catch (e) {
        throw new Error("An error occurred while creating the chat", {
            cause: e
        });
    }

    sendChatUpdate(ws, {
        chatId: chat.id,
        timestamp: Date.now(),
        messages: [chatMsg]
    });
    CLI.debug(`Chat created for user ${ws.userId}`);
    return chat;
}

async function getOrCreateChat(ws: WebsocketConnection, request: NewMessageEventData, model: LanguageModelV1) {
    let chat: ChatContext;
    if (!request.chatId) {
        chat = await createNewChat(ws, request, model);
    } else {
        CLI.debug(`Getting existing chat`);
        chat = await ChatStorageNew.readChatContext(ws.userId, request.chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }

        chat.history.push(newUserMessage(request.provider, request.model, request.message));
        sendChatUpdate(ws, {
            chatId: chat.id,
            timestamp: Date.now(),
            messages: chat.history
        });
    }
    return chat;
}

async function getTools(modelDefinition: ModelDefinition, userConfig: Configuration) {
    const mcpInfo = await getMcpTools();
    if (!modelDefinition.capabilities.includes(ModelCapability.tools)) {
        mcpInfo.tools = {};
    }
    const builtInTools = getBuiltInTools(userConfig);
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
        if (userConfig.enableTts && m.text.length > 0) {
            await sendAudioAndStopNew(ws, chat.id, m);
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
        const response = await getSimpleResponse(model, {}, getPromptMessages(chat.history, worldContext, userConfig));
        const m = newAssistantMessage(response.text, request.provider, request.model);
        await finishMessage(m, ws, chat, userConfig);
    }
}

export async function newMessageEventHandler(ws: WebsocketConnection, message: BotanikaClientEvent<NewMessageEventData>) {
    const request = message.data;
    if (!request.message || !request.provider || !request.model || !Object.values(LlmProvider).includes(request.provider)) {
        throw new Error("Invalid request");
    }

    const availableModels = await getAvailableModels(request.provider);
    const modelDefinition = availableModels.find(m => m.id === request.model);
    if (!modelDefinition) {
        throw new Error(`Model ${request.model} not found in provider ${request.provider}`);
    }

    const userConfig = await getConfig(ws.userId);
    const model = getModel(request.provider, request.model, userConfig);
    const chat = await getOrCreateChat(ws, request, model);
    const toolInfo = await getTools(modelDefinition, userConfig);

    const worldContext = getWorldContext();
    const promptMessages = getPromptMessages(chat.history, worldContext, userConfig);
    const maxSteps = userConfig.maxSteps ?? 5;
    const streamResponse = await streamResponseAsMessageNew(ws, maxSteps, request, model, toolInfo.tools, promptMessages);

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

    await ChatStorageNew.writeChatContext(ws.userId, chat);
}