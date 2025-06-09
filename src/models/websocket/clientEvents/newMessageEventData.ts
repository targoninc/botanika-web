import {LlmProvider} from "../../llms/llmProvider.ts";

export interface NewMessageEventData {
    message: string;
    provider: LlmProvider;
    model: string;
    chatId?: string;
}