import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {NewMessageEventData} from "../../models/websocket/clientEvents/newMessageEventData.ts";
import {sendEvent, sendWarning, WebsocketConnection} from "./websocket.ts";
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

async function createNewChat(ws: WebsocketConnection, request: NewMessageEventData, model: LanguageModelV1) {
    CLI.debug(`Creating chat for user ${ws.userId}`);
    const chatId = uuidv4();
    const chatMsg = newUserMessage(request.provider, request.model, request.message, request.files);
    eventStore.publish({
        userId: ws.userId,
        type: "chatCreated",
        chatId: chatId,
        userMessage: chatMsg
    });

    let chat: ChatContext;
    try {
        chat = await createChat(ws.userId, chatMsg, chatId);
        getChatName(model, chatMsg.text).then(name => {
            const newLineIndex = name.indexOf("\n");
            name = name.substring(0, newLineIndex === -1 ? 100 : newLineIndex).substring(0, 100);
            eventStore.publish({
                userId: ws.userId,
                type: "chatNameSet",
                chatId: chat.id,
                name,
            });
            chat.name = name;
        });
    } catch (e) {
        throw new Error("An error occurred while creating the chat", {
            cause: e
        });
    }

    CLI.debug(`Chat created for user ${ws.userId}`);
    return chat;
}

async function getOrCreateChatWithMessage(ws: WebsocketConnection, request: NewMessageEventData, model: LanguageModelV1) {
    let chat: ChatContext;
    if (!request.chatId) {
        chat = await createNewChat(ws, request, model);
    } else {
        CLI.debug(`Getting existing chat`);
        chat = await ChatStorage.readChatContext(ws.userId, request.chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }


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
        tools: Object.assign(builtInTools, mcpInfo.tools)
    };
}

/**
 * Requests another assistant message without tools just to have a summary or description of what happened
 */
async function requestSimpleIfOnlyToolCalls(ws: WebsocketConnection, userConfig: Configuration,
                               streamResponse: {
                                   steps: Promise<Array<StepResult<ToolSet>>>
                               }, maxSteps: number, model: LanguageModelV1, chat: ChatContext, worldContext: Record<string, any>, request: NewMessageEventData) {
    const steps = await streamResponse.steps;
    const toolResults = steps.flatMap(s => s.toolResults);
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
        })

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

    if (request.chatId) {
        CLI.debug(`${chat.history.length} existing messages`);
        chat.history.push(newUserMessage(request.provider, request.model, request.message, request.files));
    }

    /*if (!modelDefinition.capabilities.includes(ModelCapability.tools)) {
        sendWarning(ws, `Model ${request.model} might not support tool calls`);
        toolInfo.tools = {};
    }*/

    const worldContext = getWorldContext();
    const promptMessages = getPromptMessages(chat.history, worldContext, userConfig, modelSupportsFiles);
    const maxSteps = userConfig.maxSteps ?? 5;
    const streamResponse = await streamResponseAsMessage(ws, maxSteps, assMessage, model, toolInfo.tools, promptMessages, chat.id);

    // Wait for the message to be finished
    const waitForMessageFinished = new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
            if (streamResponse.value.finished) {
                clearInterval(checkInterval);
                // Add the finished message to the chat history
                chat.history.push(streamResponse.value);
                // Send audio if enabled
                if (userConfig.enableTts && streamResponse.value.text.length > 0) {
                    sendAudioAndStop(ws, chat.id, streamResponse.value).then(() => {
                        resolve();
                    });
                } else {
                    resolve();
                }
            }
        }, 100);
    });

    await requestSimpleIfOnlyToolCalls(ws, userConfig, streamResponse, maxSteps, model, chat, worldContext, request);
    await waitForMessageFinished;
    toolInfo.mcpInfo.onClose();

    chat.history.map(m => {
        if (m.id === assMessage.value.id) {
            return assMessage.value;
        }
        return m;
    });

    await ChatStorage.writeChatContext(ws.userId, chat);
}
