import {googleSearchTool} from "./google-search/google-search.tool.ts";
import {spotifySearchTool} from "./spotify/spotify-client/tools/search.tool.ts";
import {spotifyGetDevicesTool} from "./spotify/spotify-client/tools/getDevices.tool.ts";
import {spotifyPlayTool} from "./spotify/spotify-client/tools/play.tool.ts";
import {spotifyPauseTool} from "./spotify/spotify-client/tools/pause.tool.ts";
import {spotifyGetCurrentPlaybackTool} from "./spotify/spotify-client/tools/getCurrentPlayback.tool.ts";
import {spotifyGetProfileTool} from "./spotify/spotify-client/tools/getProfile.tool.ts";
import {spotifyAddToQueueTool} from "./spotify/spotify-client/tools/addToQueue.tool.ts";
import {spotifyAddToSavedTracksTool} from "./spotify/spotify-client/tools/addToSavedTracks.tool.ts";
import {spotifyGetArtistTopTracksTool} from "./spotify/spotify-client/tools/getArtistTopTracks.tool.ts";
import {Configuration} from "../../../../models/Configuration.ts";
import {spotifyAddToSavedAlbumsTool} from "./spotify/spotify-client/tools/addToSavedAlbums.tool.ts";
import {WebsocketConnection} from "src/ui-server/websocket-server/websocket.ts";
import {BotanikaFeature} from "../../../../models/features/BotanikaFeature.ts";
import {ChatContext} from "../../../../models/chat/ChatContext.ts";

export function getBuiltInTools(userConfig: Configuration, ws: WebsocketConnection, chat: ChatContext) {
    let tools = [];

    if (userConfig.featureOptions[BotanikaFeature.GoogleSearch].apiKey && userConfig.featureOptions[BotanikaFeature.GoogleSearch].searchEngineId) {
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