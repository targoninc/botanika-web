import {checkIfEnabled, createClient} from "../createClient";
import {ChatToolResult} from "../../../../../../../models/chat/ChatToolResult";
import {wrapTool} from "../../../../tooling";
import {z} from "zod";
import { Configuration } from "src/models/Configuration";
import { WebsocketConnection } from "src/ui-server/websocket-server/websocket";

async function addToQueue(userConfig: Configuration, uri: string, deviceId: string): Promise<SpotifyApi.AddToQueueResponse> {
    const api = await createClient(userConfig);
    try {
        const response = await api.addToQueue(uri, {
            device_id: deviceId
        });

        return response.body;
    } catch (error: any) {
        console.error("Error occurred while adding to queue:", error.message);
        throw new Error(`Adding to queue failed: ${error.message}`);
    }
}

async function addToQueueToolCall(input: any, userConfig: Configuration) {
    if (!checkIfEnabled(userConfig)) {
        throw new Error("Spotify is not configured");
    }
    await addToQueue(userConfig, input.uri, input.deviceId);

    return <ChatToolResult>{
        text: "Added item to Spotify playback queue",
        references: []
    };
}

export function spotifyAddToQueueTool(userConfig: Configuration, ws: WebsocketConnection, chatId: string) {
    return {
        id: "spotify-addToQueue",
        description: "Add a Spotify URI to the queue.",
        parameters: z.object({
            uri: z.string().describe('The URI to add to the queue'),
            deviceId: z.string().describe('The device ID to add to the queue on'),
        }),
        execute: wrapTool("spotify-addToQueue", input => addToQueueToolCall(userConfig, userConfig)),
    };
}