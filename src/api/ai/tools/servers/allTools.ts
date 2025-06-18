import {googleSearchTool} from "./google-search/google-search.tool.ts";
import {extractContentFromWebpageTool, extractImagesFromWebpageTool} from "./web-browser/web-browser.tool.ts";
import {Configuration} from "../../../../models-shared/configuration/Configuration.ts";
import {BotanikaFeature} from "../../../../models-shared/configuration/BotanikaFeature.ts";
import {Signal} from "@targoninc/jess";
import {ChatMessage} from "../../../../models-shared/chat/ChatMessage.ts";
import {Tool, ToolSet} from "ai";
import {getFeatureOption} from "../../../../models-shared/configuration/getFeatureOption.ts";

function addTool(toolSet: ToolSet, tool: Tool & { id: string }) {
    toolSet[tool.id] = tool;
}

export function getBuiltInTools(userConfig: Configuration, message: Signal<ChatMessage>) {
    const tools = {};

    if (getFeatureOption(userConfig, BotanikaFeature.GoogleSearch).apiKey && getFeatureOption(userConfig, BotanikaFeature.GoogleSearch).searchEngineId) {
        addTool(tools, googleSearchTool(userConfig, message));
    }

    addTool(tools, extractImagesFromWebpageTool(message));
    addTool(tools, extractContentFromWebpageTool(message));

    return tools;
}
