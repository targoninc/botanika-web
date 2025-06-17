import {sendWarning, WebsocketConnection} from "./websocket.ts";
import {getAvailableModels, getModel} from "../ai/llms/models.ts";
import {getConfig} from "../configuration.ts";
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
import {ChatStorage} from "../storage/ChatStorage.ts";
import {AiMessage} from "../ai/llms/aiMessage.ts";
import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";

async function getOrCreateChatWithMessage(ws: WebsocketConnection, request: BotanikaClientEvent & { type: "newMessage" }, model: LanguageModelV1) {
    const chatId = request.chatId ?? uuidv4();
    const chatMsg = newUserMessage(request.message, request.files);
    if (!request.chatId) {
        eventStore.publish({
            userId: ws.userId,
            type: "chatCreated",
            chatId: chatId,
            userMessage: chatMsg
        }).then();

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
    }else{
        eventStore.publish({
            userId: ws.userId,
            type: "userMessageCreated",
            chatId: request.chatId,
            message: chatMsg
        }).then();
    }

    return chatId;
}

async function getTools(modelDefinition: ModelDefinition, userConfig: Configuration, ws: WebsocketConnection, chat: string, messageId: string) {
    const mcpInfo = await getMcpTools(ws.userId);
    if (!modelDefinition.capabilities.includes(ModelCapability.tools)) {
        mcpInfo.tools = {};
    }
    const builtInTools = getBuiltInTools(userConfig, ws, chat, messageId);
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
    request: BotanikaClientEvent & { type: "newMessage" },
    promptMessages: AiMessage[]
) {
    const toolResults = (await steps).flatMap(s => s.toolResults)
    if (toolResults.length === maxSteps) {
        const response = await getSimpleResponse(model, {}, promptMessages);
        const message = newAssistantMessage(response.text, request.provider, request.model);

        // Set the message as finished
        message.createdAt = Date.now();
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

export async function newMessageEventHandler(ws: WebsocketConnection, request: BotanikaClientEvent & { type: "newMessage" }) {
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

    const chatId = await getOrCreateChatWithMessage(ws, request, model);

    const chat = await ChatStorage.readChatContext(ws.userId, chatId);
    if (!chat) {
        throw new Error("Something went wrong");
    }

    const toolInfo = await getTools(modelDefinition, userConfig, ws, chatId, chat.history[chat.history.length - 1].id);

    const worldContext = getWorldContext();
    const promptMessages = getPromptMessages(chat.history, worldContext, userConfig, modelSupportsFiles);
    const maxSteps = userConfig.maxSteps ?? 5;
    const streamResponse = streamResponseAsMessage(ws, maxSteps, model, toolInfo.tools, promptMessages, chatId);

    await requestSimpleIfOnlyToolCalls(ws, userConfig, streamResponse.steps, maxSteps, model, chat, request, promptMessages);
    toolInfo.mcpInfo.onClose();

    await streamResponse.all();
}
