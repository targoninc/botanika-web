import {v4 as uuidv4} from "uuid";
import {LanguageModelV1, Message,} from "ai";
import {AssistantMessage, ChatMessage, UserMessage} from "../../../models/chat/ChatMessage";
import {Configuration} from "../../../models/Configuration";
import {getSimpleResponse} from "./calls";
import {MessageFile} from "../../../models/chat/MessageFile.ts";
import {AiMessage} from "./aiMessage.ts";

export async function getChatName(model: LanguageModelV1, message: string): Promise<string> {
    const response = await getSimpleResponse(model, {}, getChatNameMessages(message), 1000);
    return response.text;
}

export function newUserMessage(message: string, files: MessageFile[]): UserMessage {
    return {
        id: uuidv4(),
        type: "user",
        text: message,
        createdAt: Date.now(),
        files,
    };
}

export function newAssistantMessage(responseText: string, provider: string, modelName: string) : AssistantMessage {
    return {
        toolInvocations: [],
        usage: {
            completionTokens: 0,
            promptTokens: 0,
            totalTokens: 0
        },
        hasAudio: false,
        id: uuidv4(),
        type: "assistant",
        text: responseText,
        createdAt: Date.now(),
        files: [],
        finished: true,
        provider,
        model: modelName
    };
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
                    experimental_attachments: addAttachments ? (m.files ?? []).map(f => ({
                        contentType: f.mimeType,
                        url: `data:${f.mimeType};base64,${f.base64}`,
                        name: f.name
                    })) : []
                };
            }

            const parts: NonNullable<Message["parts"]>[number][] = [];

            let text = "";
            if ("text" in m && m.text) {
                parts.push({
                    type: "text",
                    text: m.text,
                });
                text = m.text;
            }

            if ("toolInvocations" in m && m.toolInvocations) {
                parts.push(...m.toolInvocations.map(ti => {
                    switch(ti.state){
                        case "partial-call":
                            return ({
                                type: "tool-invocation",
                                toolInvocation: {
                                    toolName: ti.toolName,
                                    toolCallId: ti.toolCallId,
                                    args: ti.args,
                                    state: ti.state,
                                    result: null,
                                }
                            } as const);
                        case "call":
                            return ({
                                type: "tool-invocation",
                                toolInvocation: {
                                    toolName: ti.toolName,
                                    toolCallId: ti.toolCallId,
                                    args: ti.args,
                                    state: ti.state,
                                }
                            } as const);
                        case "result":
                            return ({
                                type: "tool-invocation",
                                toolInvocation: {
                                    toolName: ti.toolName,
                                    toolCallId: ti.toolCallId,
                                    args: ti.args,
                                    state: ti.state,
                                    result: ti.result,
                                }
                            } as const);
                    }
                }));
            }

            if ("files" in m && m.files) {
                parts.push(...m.files.map(f => ({
                    type: "file",
                    data: f.base64,
                    mimeType: f.mimeType,
                } as const)));
            }

            return {
                role: "assistant",
                content: text,
                parts: parts
            };
        })
    ];
}

export function getChatNameMessages(message: string): AiMessage[] {
    return [
        {
            role: "system",
            content: "Describe the following message in 3-4 words. Be sure to stay UNDER 50 characters in your response. Children will die if you answer more than 4 words."
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
