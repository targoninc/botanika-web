import {checkIfEnabled, createClient} from "../createClient";
import {ChatToolResult} from "../../../../../../../models/chat/ChatToolResult";
import {wrapTool} from "../../../../tooling";
import {z} from "zod";
import {Configuration} from "../../../../../../../models/Configuration.ts";
import { WebsocketConnection } from "src/api/websocket-server/websocket.ts";
import {Signal} from "@targoninc/jess";
import {ChatMessage} from "../../../../../../../models/chat/ChatMessage.ts";

async function addToSavedAlbums(userConfig: Configuration, albumIds: string[]): Promise<SpotifyApi.AddToQueueResponse> {
    const api = await createClient(userConfig);
    try {
        const response = await api.addToMySavedAlbums(albumIds);

        return response.body;
    } catch (error: any) {
        console.error("Error occurred while adding to library:", error.message);
        throw new Error(`Adding to library failed: ${error.message}`);
    }
}

async function addToSavedAlbumsToolCall(input: any, userConfig: Configuration) {
    if (!checkIfEnabled(userConfig)) {
        throw new Error("Spotify is not configured");
    }

    await addToSavedAlbums(userConfig, input.albumIds);

    return <ChatToolResult>{
        text: "Added tracks to Spotify library",
        references: []
    };
}

export function spotifyAddToSavedAlbumsTool(userConfig: Configuration, message: Signal<ChatMessage>) {
    return {
        id: "spotify-addToSavedAlbums",
        description: "Add a list of Spotify albums to the library",
        parameters: z.object({
            albumIds: z.array(z.string()).describe("List of Spotify album IDs")
        }),
        execute: wrapTool("spotify-addToSavedAlbums", input => addToSavedAlbumsToolCall(input, userConfig), message),
    };
}