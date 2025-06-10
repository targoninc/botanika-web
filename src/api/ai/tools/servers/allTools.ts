import {googleSearchTool} from "./google-search/google-search.tool.ts";
import {Configuration} from "../../../../models/Configuration.ts";
import {WebsocketConnection} from "../../../../ui-server/websocket-server/websocket.ts";
import {BotanikaFeature} from "../../../../models/features/BotanikaFeature.ts";
import {ChatContext} from "../../../../models/chat/ChatContext.ts";

function featureOption(config: Configuration, option: BotanikaFeature): any {
    return (config.featureOptions ?? {})[option] ?? {};
}

export function getBuiltInTools(userConfig: Configuration, ws: WebsocketConnection, chat: ChatContext) {
    let tools = [];

    if (featureOption(userConfig, BotanikaFeature.GoogleSearch).apiKey && featureOption(userConfig, BotanikaFeature.GoogleSearch).searchEngineId) {
        tools.push(googleSearchTool(userConfig, ws, chat));
    }

    /*if (userConfig.featureOptions[BotanikaFeature.Spotify].clientSecret && userConfig.featureOptions[BotanikaFeature.Spotify].clientId) {
        tools = tools.concat(
            spotifyAddToSavedAlbumsTool(userConfig, ws, chatId),
            spotifySearchTool(userConfig, ws, chatId),
            spotifyGetDevicesTool(userConfig, ws, chatId),
            spotifyPlayTool(userConfig, ws, chatId),
            spotifyPauseTool(userConfig, ws, chatId),
            spotifyGetCurrentPlaybackTool(userConfig, ws, chatId),
            spotifyGetProfileTool(userConfig, ws, chatId),
            spotifyAddToQueueTool(userConfig, ws, chatId),
            spotifyAddToSavedTracksTool(userConfig, ws, chatId),
            spotifyGetArtistTopTracksTool(userConfig, ws, chatId),
        );
    }*/

    return tools;
}