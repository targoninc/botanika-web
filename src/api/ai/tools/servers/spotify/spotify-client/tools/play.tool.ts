import {z} from "zod";
import {ChatToolResult} from "../../../../../../../models/chat/ChatToolResult";
import {wrapTool} from "../../../../tooling";
import {checkIfEnabled, createClient} from "../createClient";
import { Configuration } from "src/models/Configuration";
import { WebsocketConnection } from "src/api/websocket-server/websocket";

async function play(userConfig: Configuration, deviceId: string, contextUri: string, uris: string[], positionMs: number): Promise<void> {
    const api = await createClient(userConfig);
    try {
        if (contextUri && contextUri.length > 0) {
            await api.play({
                device_id: deviceId,
                context_uri: contextUri,
                position_ms: positionMs
            });
        } else if (uris && uris.length > 0) {
            await api.play({
                device_id: deviceId,
                uris: uris,
                position_ms: positionMs
            });
        } else {
            throw new Error("No URIs or context URI provided");
        }
    } catch (error: any) {
        console.error("Error occurred while starting playback:", error.message);
        throw new Error(`Playing failed: ${error.message}`);
    }
}

interface SpotifyPlayOptions {
    deviceId: string;
    contextUri: string;
    uris: string[];
    positionMs: number;
}

async function playToolCall(userConfig: Configuration, input: SpotifyPlayOptions) {
    if (!checkIfEnabled(userConfig)) {
        throw new Error("Spotify is not configured");
    }

    await play(userConfig, input.deviceId, input.contextUri, input.uris, input.positionMs);

    return <ChatToolResult>{
        text: `Started playback on Spotify`,
    };
}

export function spotifyPlayTool(userConfig: Configuration, ws: WebsocketConnection, chatId: string) {
    return {
        id: "spotify-play",
        description: "Play a song, album or playlist on Spotify. If you don't know the URIs, use the Spotify search tool first.",
        parameters: z.object({
            deviceId: z.string().describe('The device ID to play on'),
            contextUri: z.string().describe('The context URI to play on').optional(),
            uris: z.array(z.string()).describe('The URIs to play').optional(),
            positionMs: z.number().describe('The position in milliseconds to start playing from'),
        }),
        execute: wrapTool("spotify-play", input => playToolCall(userConfig, input)),
    };
}