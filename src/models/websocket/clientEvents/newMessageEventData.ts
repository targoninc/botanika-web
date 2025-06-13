import {LlmProvider} from "../../llms/llmProvider.ts";
import {MessageFile} from "../../chat/MessageFile.ts";

export interface NewMessageEventData {
    message: string;
    provider: LlmProvider;
    model: string;
    chatId?: string;
    files: MessageFile[],
}