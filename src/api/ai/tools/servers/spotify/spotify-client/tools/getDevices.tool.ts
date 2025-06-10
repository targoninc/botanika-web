import {checkIfEnabled, createClient} from "../createClient";
import {ResourceReference} from "../../../../../../../models/chat/ResourceReference";
import {ChatToolResult} from "../../../../../../../models/chat/ChatToolResult";
import {wrapTool} from "../../../../tooling";
import { Configuration } from "src/models/Configuration";
import {z} from "zod";
import { WebsocketConnection } from "src/api/websocket-server/websocket";

async function getDevices(userConfig: Configuration): Promise<SpotifyApi.UserDevicesResponse> {
    const api = await createClient(userConfig);
    try {
        const response = await api.getMyDevices();

        return response.body;
    } catch (error: any) {
        console.error("Error occurred while getting devices:", error.message);
        throw new Error(`Getting devices failed: ${error.message}`);
    }
}

async function getDevicesToolCall(userConfig: Configuration) {
    if (!checkIfEnabled(userConfig)) {
        throw new Error("Spotify is not configured");
    }

    const result = await getDevices(userConfig);
    const refs = result.devices.map(device => {
        return <ResourceReference>{
            type: "resource-reference",
            name: device.type + ": " + device.name + " (" + device.volume_percent + "% volume)",
            snippet: "ID: " + device.id,
        }
    });

    return <ChatToolResult>{
        text: `${refs.length} Spotify devices found`,
        references: refs,
    };
}

export function spotifyGetDevicesTool(userConfig: Configuration, ws: WebsocketConnection, chatId: string) {
    return {
        id: "spotify-getDevices",
        description: "Get Spotify devices.",
        parameters: z.object({}),
        execute: wrapTool("spotify-getDevices", () => getDevicesToolCall(userConfig)),
    };
}