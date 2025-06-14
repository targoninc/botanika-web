import {googleSearchTool} from "./google-search/google-search.tool.ts";
import {Configuration} from "../../../../models/Configuration.ts";
import {WebsocketConnection} from "../../../websocket-server/websocket.ts";
import {BotanikaFeature} from "../../../../models/features/BotanikaFeature.ts";
import {ChatContext} from "../../../../models/chat/ChatContext.ts";
import {Signal} from "@targoninc/jess";
import {ChatMessage} from "../../../../models/chat/ChatMessage.ts";

function featureOption(config: Configuration, option: BotanikaFeature): any {
    return (config.featureOptions ?? {})[option] ?? {};
}

export function getBuiltInTools(userConfig: Configuration, message: Signal<ChatMessage>) {
    let tools = [];

    if (featureOption(userConfig, BotanikaFeature.GoogleSearch).apiKey && featureOption(userConfig, BotanikaFeature.GoogleSearch).searchEngineId) {
        tools.push(googleSearchTool(userConfig, message));
    }

    /*if (userConfig.featureOptions[BotanikaFeature.Spotify].clientSecret && userConfig.featureOptions[BotanikaFeature.Spotify].clientId) {
        tools = tools.concat(
            spotifyAddToSavedAlbumsTool(userConfig, message),
            spotifySearchTool(userConfig, message),
            spotifyGetDevicesTool(userConfig, message),
            spotifyPlayTool(userConfig, message),
            spotifyPauseTool(userConfig, message),
            spotifyGetCurrentPlaybackTool(userConfig, message),
            spotifyGetProfileTool(userConfig, message),
            spotifyAddToQueueTool(userConfig, message),
            spotifyAddToSavedTracksTool(userConfig, message),
            spotifyGetArtistTopTracksTool(userConfig, message),
        );
    }*/

    return tools;
}