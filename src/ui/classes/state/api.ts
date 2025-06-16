import { ApiBase } from "./api.base";
import {Configuration} from "../../../models/Configuration.ts";
import {ApiEndpoint} from "../../../models/ApiEndpoints.ts";
import {ChatContext} from "../../../models/chat/ChatContext.ts";
import {ProviderDefinition} from "../../../models/llms/ProviderDefinition.ts";
import {McpServerConfig} from "../../../models/mcp/McpServerConfig.ts";
import {ShortcutConfiguration} from "../../../models/shortcuts/ShortcutConfiguration.ts";
import {UserinfoResponse} from "openid-client";
import {User} from "@prisma/client";

export class Api extends ApiBase {
    static getConfig() {
        return this.get<Configuration>(ApiEndpoint.CONFIG);
    }

    static setConfig(config: Configuration) {
        return this.put(ApiEndpoint.CONFIG, config);
    }

    static getConfigKey<T>(key: string) {
        return this.get<T>(`${ApiEndpoint.CONFIG_KEY}${key}`);
    }

    static setConfigKey(key: string, value: any) {
        return this.put(`${ApiEndpoint.CONFIG_KEY}${key}`, { value });
    }

    static sendMessage(message: string, provider: string, model: string, chatId: string = null) {
        return this.stream(ApiEndpoint.CHAT, {
            message,
            provider,
            model,
            chatId
        });
    }

    static getNewestChats(from?: Date) {
        return this.get<ChatContext[]>(`${ApiEndpoint.CHATS}?from=${from?.toISOString() ?? ""}`);
    }

    static getChat(chatId: string, shared?: boolean) {
        return this.get<ChatContext>(`${ApiEndpoint.CHAT_BY_ID}${chatId}?shared=${shared}`);
    }

    static deleteChat(chatId: string) {
        return this.delete(`${ApiEndpoint.CHAT_BY_ID}${chatId}`);
    }

    static getModels() {
        return this.get<Record<string, ProviderDefinition>>(ApiEndpoint.MODELS);
    }

    static getMcpConfig() {
        return this.get<McpServerConfig[]>(ApiEndpoint.MCP_CONFIG);
    }

    static setMcpConfig(config: McpServerConfig[]) {
        return this.post(ApiEndpoint.MCP_CONFIG, { config });
    }

    static getShortcutConfig() {
        return this.get<ShortcutConfiguration>(ApiEndpoint.SHORTCUT_CONFIG);
    }

    static setShortcutConfig(sc: ShortcutConfiguration) {
        return this.post(ApiEndpoint.SHORTCUT_CONFIG, sc);
    }

    static openAppDataPath() {
        return this.post(ApiEndpoint.OPEN_APP_DATA_PATH);
    }

    static getOpenAiKey() {
        return this.get<string>(ApiEndpoint.OPENAI_KEY);
    }

    static transcribe(formData: FormData) {
        return this.streamWithFormData(ApiEndpoint.TRANSCRIBE, formData, true);
    }

    static deleteAfterMessage(chatId: string, messageId: string, exclusive: boolean = false) {
        return this.post(ApiEndpoint.DELETE_AFTER_MESSAGE, {
            chatId,
            messageId,
            exclusive,
        });
    }

    static branchFromMessage(chatId: string, messageId: string) {
        return this.post(ApiEndpoint.BRANCH_CHAT, {
            chatId,
            messageId,
        });
    }

    static getUser() {
        return this.get<User & UserinfoResponse>(ApiEndpoint.GET_USER);
    }

    static getDeletedChats(ids: string[]) {
        return this.post<string[]>(ApiEndpoint.GET_DELETED_CHATS, {
            ids
        });
    }
}
