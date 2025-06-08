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

export function getBuiltInTools(userConfig: Configuration) {
    return [
        googleSearchTool(userConfig),
        spotifyAddToSavedAlbumsTool(userConfig),
        spotifySearchTool(userConfig),
        spotifyGetDevicesTool(userConfig),
        spotifyPlayTool(userConfig),
        spotifyPauseTool(userConfig),
        spotifyGetCurrentPlaybackTool(userConfig),
        spotifyGetProfileTool(userConfig),
        spotifyAddToQueueTool(userConfig),
        spotifyAddToSavedTracksTool(userConfig),
        spotifyGetArtistTopTracksTool(userConfig),
    ]
}