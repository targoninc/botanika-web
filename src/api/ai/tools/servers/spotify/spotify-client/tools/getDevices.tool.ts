import {checkIfEnabled, createClient} from "../createClient";
import {ResourceReference} from "../../../../../../../models/chat/ResourceReference";
import {ChatToolResult} from "../../../../../../../models/chat/ChatToolResult";
import {wrapTool} from "../../../../tooling";
import { Configuration } from "src/models/Configuration";

async function getDevices(): Promise<SpotifyApi.UserDevicesResponse> {
    const api = await createClient();
    try {
        const response = await api.getMyDevices();

        return response.body;
    } catch (error: any) {
        console.error("Error occurred while getting devices:", error.message);
        throw new Error(`Getting devices failed: ${error.message}`);
    }
}

async function getDevicesToolCall() {
    await checkIfEnabled();

    const result = await getDevices();
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

export function spotifyGetDevicesTool(userConfig: Configuration) {
    return {
        id: "spotify-getDevices",
        description: "Get Spotify devices.",
        parameters: {},
        execute: wrapTool("spotify-getDevices", getDevicesToolCall),
    };
}