import {googleSearchTool} from "./google-search/google-search.tool.ts";
import {extractImagesFromWebpageTool, extractContentFromWebpageTool} from "./web-browser/web-browser.tool.ts";
import {Configuration} from "../../../../models/Configuration.ts";
import {BotanikaFeature} from "../../../../models/features/BotanikaFeature.ts";
import {ChatContext} from "../../../../models/chat/ChatContext.ts";
import {Tool} from "ai";
import {WebsocketConnection} from "../../../websocket-server/websocket.ts";

export function featureOption(config: Configuration, option: BotanikaFeature): any {
    return (config.featureOptions ?? {})[option] ?? {};
}

export type BuiltInTools = {
    ["google.search-engine"]?: ReturnType<typeof googleSearchTool>;
    ["web-browser.extract-images"]: ReturnType<typeof extractImagesFromWebpageTool>;
    ["web-browser.extract-content"]: ReturnType<typeof extractContentFromWebpageTool>;
} & Record<string, Tool>;

export function getBuiltInTools(
    userConfig: Configuration,
    ws: WebsocketConnection,
    chatId: string,
    messageId: string
) : BuiltInTools {
    const tools: BuiltInTools = {
        "web-browser.extract-images": extractImagesFromWebpageTool(ws.userId, chatId, messageId),
        "web-browser.extract-content": extractContentFromWebpageTool(ws.userId, chatId, messageId),
    };

    if (featureOption(userConfig, BotanikaFeature.GoogleSearch).apiKey && featureOption(userConfig, BotanikaFeature.GoogleSearch).searchEngineId) {
        tools["google.search-engine"] = googleSearchTool(userConfig, ws, chatId, messageId);
    }

    return tools
}
