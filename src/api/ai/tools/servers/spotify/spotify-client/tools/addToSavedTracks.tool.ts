import {checkIfEnabled, createClient} from "../createClient";
import {ChatToolResult} from "../../../../../../../models/chat/ChatToolResult";
import {wrapTool} from "../../../../tooling";
import {z} from "zod";
import { Configuration } from "src/models/Configuration";
import { WebsocketConnection } from "src/api/websocket-server/websocket";

async function addToSavedTracks(userConfig: Configuration, trackIds: string[]): Promise<SpotifyApi.SaveTracksForUserResponse> {
    const api = await createClient(userConfig);
    try {
        const response = await api.addToMySavedTracks(trackIds);

        return response.body;
    } catch (error: any) {
        console.error("Error occurred while adding to library:", error.message);
        throw new Error(`Adding to library failed: ${error.message}`);
    }
}

async function addToSavedTracksToolCall(input: any, userConfig: Configuration) {
    if (!checkIfEnabled(userConfig)) {
        throw new Error("Spotify is not configured");
    }
    await addToSavedTracks(userConfig, input.trackIds);

    return <ChatToolResult>{
        text: "Added tracks to Spotify library",
        references: []
    };
}

export function spotifyAddToSavedTracksTool(userConfig: Configuration, ws: WebsocketConnection, chatId: string) {
    return {
        id: "spotify-addToSavedTracks",
        description: "Add a list of Spotify tracks to the library",
        parameters: z.object({
            trackIds: z.array(z.string()).describe("List of Spotify track IDs")
        }),
        execute: wrapTool("spotify-addToSavedTracks", input => addToSavedTracksToolCall(input, userConfig)),
    };
}