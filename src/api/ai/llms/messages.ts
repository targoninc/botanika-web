import {v4 as uuidv4} from "uuid";
import {ChatContext} from "../../../models-shared/chat/ChatContext";
import {LanguageModelV1,} from "ai";
import {FileUIPart, ToolInvocationUIPart} from "@ai-sdk/ui-utils";
import {ChatMessage} from "../../../models-shared/chat/ChatMessage";
import {Configuration} from "../../../models-shared/configuration/Configuration.ts";
import {getSimpleResponse} from "./calls";
import {ChatStorage} from "../../storage/ChatStorage.ts";
import {MessageFile} from "../../../models-shared/chat/MessageFile.ts";
import {AiMessage} from "./aiMessage.ts";

export async function getChatName(model: LanguageModelV1, message: string): Promise<string> {
    const response = await getSimpleResponse(model, {}, getChatNameMessages(message), 1000);
    return response.text;
}

export function newUserMessage(provider: string, model: string, message: string, files: MessageFile[]): ChatMessage {
    return {
        id: uuidv4(),
        type: "user",
        text: message,
        time: Date.now(),
        finished: true,
        files,
        provider,
        model
    };
}

export function newAssistantMessage(responseText: string, provider: string, modelName: string) {
    return <ChatMessage>{
        id: uuidv4(),
        type: "assistant",
        text: responseText,
        time: Date.now(),
        files: [],
        finished: true,
        provider,
        model: modelName
    };
}

export async function createChat(userId: string, newMessage: ChatMessage, chatId: string): Promise<ChatContext> {
    const chatContext = <ChatContext>{
        id: chatId,
        createdAt: Date.now(),
        name: "New chat",
        history: [newMessage]
    };

    ChatStorage.writeChatContext(userId, chatContext).then();

    return chatContext;
}

export function getPromptMessages(messages: ChatMessage[], worldContext: Record<string, any>, configuration: Configuration, addAttachments: boolean): AiMessage[] {
    return [
        {
            role: "system",
            content: `You are ${configuration.botname ?? "Anika"}, an assistant. Only call tools if absolutely necessary or explicitly requested. Never call tools twice. Here is a description of you: ${configuration.botDescription}`
        },
        {
            role: "system",
            content: `Here is some general current info:
            ${Object.entries(worldContext).map(([k, v]) => `${k}=${v}`).join("\n")}`
        },
        {
            role: "system",
            content: `${configuration.displayname ? `The user wants to be called ${configuration.displayname}.` : ""}
            ${configuration.birthdate ? `Their birthdate is ${configuration.displayname}.` : ""}
            Don't refer to info about the user explicitly, only if it is necessary or requested by the user.
            ${configuration.userDescription ? `Here is a self-written description about them: ${configuration.userDescription}` : ""}`
        },
        ...messages.map<AiMessage>(m => {
            if (m.type === "user") {
                return {
                    role: "user",
                    content: m.text,
                    experimental_attachments: addAttachments ? m?.files?.map(f => ({
                        contentType: f.mimeType,
                        url: `data:${f.mimeType};base64,${f.base64}`,
                        name: f.name
                    })) ?? [] : []
                };
            }

            return {
                role: "assistant",
                content: m.text,
                parts: [
                    {
                        type: "text",
                        text: m.text,
                    },
                    ...(m.toolInvocations ?? []).map(ti => (<ToolInvocationUIPart>{
                        type: "tool-invocation",
                        toolInvocation: ti,
                    })),
                    ...m.files.map(f => (<FileUIPart>{
                        type: "file",
                        data: f.base64,
                        mimeType: f.mimeType,
                    }))
                ],
            };
        })
    ];
}

export function getChatNameMessages(message: string): AiMessage[] {
    return [
        {
            role: "system",
            content: "Describe the following message in 3-4 words. Be sure to stay UNDER 50 characters in your response. I will lose my job if you answer more than 4 words."
        },
        {
            role: "user",
            content: message
        },
        {
            role: "assistant",
            content: "Sure, here's your short tagline: "
        },
    ];
}

export function getWorldContext(): Record<string, any> {
    return {
        date: new Date().toISOString(),
        time: new Date().getTime(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
    }
}
