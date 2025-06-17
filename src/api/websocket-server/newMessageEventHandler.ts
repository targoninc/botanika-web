import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {NewMessageEventData} from "../../models/websocket/clientEvents/newMessageEventData.ts";
import {sendWarning, WebsocketConnection} from "./websocket.ts";
import {getAvailableModels, getModel} from "../ai/llms/models.ts";
import {getConfig} from "../configuration.ts";
import {CLI} from "../CLI.ts";
import {
    getChatName,
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
import {sendAudioAndStop} from "../ai/endpoints.ts";
import {v4 as uuidv4} from "uuid";
import { ModelDefinition } from "../../models/llms/ModelDefinition.ts";
import {LlmProvider} from "../../models/llms/llmProvider.ts";
import {eventStore} from "../database/events/eventStore.ts";

async function createNewChat(ws: WebsocketConnection, request: NewMessageEventData, model: LanguageModelV1) {
    CLI.debug(`Creating chat for user ${ws.userId}`);
    const chatId = uuidv4();
    const chatMsg = newUserMessage(request.message, request.files);
    eventStore.publish({
        userId: ws.userId,
        type: "chatCreated",
        chatId: chatId,
        userMessage: chatMsg
    }).then();

    try {

        getChatName(model, chatMsg.text).then(name => {
            const newLineIndex = name.indexOf("\n");
            name = name.substring(0, newLineIndex === -1 ? 100 : newLineIndex).substring(0, 100);
            eventStore.publish({
                userId: ws.userId,
                type: "chatNameSet",
                chatId: chatId,
                name,
            });
        });
    } catch (e) {
        throw new Error("An error occurred while creating the chat", {
            cause: e
        });
    }

    CLI.debug(`Chat created for user ${ws.userId}`);

    return chatId;
}

async function getOrCreateChatWithMessage(ws: WebsocketConnection, request: NewMessageEventData, model: LanguageModelV1) {
    if (!request.chatId) {
        return await createNewChat(ws, request, model);
    } else {
        eventStore.publish({
            userId: ws.userId,
            type: "userMessageCreated",
            chatId: request.chatId,
            message: {
                id: uuidv4(),
                text: request.message,
                time: Date.now(),
                type: "user",
                files: [],
            }
        });
    }

    return request.chatId;
}

async function getTools(modelDefinition: ModelDefinition, userConfig: Configuration, ws: WebsocketConnection, chat: ChatContext) {
    const mcpInfo = await getMcpTools(ws.userId);
    if (!modelDefinition.capabilities.includes(ModelCapability.tools)) {
        mcpInfo.tools = {};
    }
    const builtInTools = getBuiltInTools(userConfig, ws, chat);
    return {
        mcpInfo,
        tools: Object.assign(builtInTools, mcpInfo.tools)
    };
}

/**
 * Requests another assistant message without tools just to have a summary or description of what happened
 */
async function requestSimpleIfOnlyToolCalls(
    ws: WebsocketConnection,
    userConfig: Configuration,
    steps: Promise<Array<StepResult<ToolSet>>>,
    maxSteps: number,
    model: LanguageModelV1,
    chat: ChatContext,
    worldContext: Record<string, any>,
    request: NewMessageEventData
) {
    const toolResults = (await steps).flatMap(s => s.toolResults)
    if (toolResults.length === maxSteps) {
        const response = await getSimpleResponse(model, {}, getPromptMessages(chat.history, worldContext, userConfig, true));
        const message = newAssistantMessage(response.text, request.provider, request.model);

        // Set the message as finished
        message.time = Date.now();
        message.finished = true;

        eventStore.publish({
            userId: ws.userId,
            type: "messageCreated",
            chatId: chat.id,
            message: message
        }).then();

        // Send audio if enabled
        if (userConfig.enableTts && message.text.length > 0) {
            await sendAudioAndStop(ws, chat.id, message);
        }
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
        request.files = [];
    }

    const userConfig = await getConfig(ws.userId);
    const model = getModel(request.provider, request.model, userConfig);

    const chat = await getOrCreateChatWithMessage(ws, request, model);
    const toolInfo = await getTools(modelDefinition, userConfig, ws, chat);

    const worldContext = getWorldContext();
    const promptMessages = getPromptMessages(chat.history, worldContext, userConfig, modelSupportsFiles);
    const maxSteps = userConfig.maxSteps ?? 5;
    const streamResponse = streamResponseAsMessage(ws, maxSteps, model, toolInfo.tools, promptMessages, chat.id);

    await requestSimpleIfOnlyToolCalls(ws, userConfig, streamResponse.steps, maxSteps, model, chat, worldContext, request);
    toolInfo.mcpInfo.onClose();

    await streamResponse.all();
}
