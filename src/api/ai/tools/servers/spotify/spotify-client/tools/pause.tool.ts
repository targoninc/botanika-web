import {z} from "zod";
import {ChatToolResult} from "../../../../../../../models/chat/ChatToolResult";
import {wrapTool} from "../../../../tooling";
import {checkIfEnabled, createClient} from "../createClient";
import { Configuration } from "src/models/Configuration";
import { WebsocketConnection } from "src/api/websocket-server/websocket";

async function pause(userConfig: Configuration, deviceId: string): Promise<void> {
    const api = await createClient(userConfig);
    try {
        await api.pause({
            device_id: deviceId,
        });
    } catch (error: any) {
        console.error("Error occurred while pausing:", error.message);
        throw new Error(`Pausing failed: ${error.message}`);
    }
}

interface SpotifyPauseOptions {
    deviceId: string;
}

async function pauseToolCall(input: SpotifyPauseOptions, userConfig: Configuration) {
    if (!checkIfEnabled(userConfig)) {
        throw new Error("Spotify is not configured");
    }

    await pause(userConfig, input.deviceId);

    return <ChatToolResult>{
        text: `Paused playback on Spotify`,
    };
}

export function spotifyPauseTool(userConfig: Configuration, ws: WebsocketConnection, chatId: string) {
    return {
        id: "spotify-pause",
        description: "Pause Spotify playback.",
        parameters: z.object({
            deviceId: z.string().describe('The device ID to pause on'),
        }),
        execute: wrapTool("spotify-pause", input => pauseToolCall(input, userConfig)),
    };
}