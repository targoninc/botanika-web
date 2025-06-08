import {checkIfEnabled, createClient} from "../createClient";
import {ChatToolResult} from "../../../../../../../models/chat/ChatToolResult";
import {wrapTool} from "../../../../tooling";
import { Configuration } from "src/models/Configuration";
import {z} from "zod";

async function getProfile(userConfig: Configuration): Promise<SpotifyApi.CurrentUsersProfileResponse> {
    const api = await createClient(userConfig);
    try {
        const response = await api.getMe();

        return response.body;
    } catch (error: any) {
        console.error("Error occurred while getting profile:", error.message);
        throw new Error(`Getting profile failed: ${error.message}`);
    }
}

async function getProfileToolCall(userConfig: Configuration) {
    if (!checkIfEnabled(userConfig)) {
        throw new Error("Spotify is not configured");
    }

    const result = await getProfile(userConfig);
    const country = result.country ? `, ${result.country}` : "";

    return <ChatToolResult>{
        text: "Found profile info",
        references: [{
            type: "resource-reference",
            name: result.display_name,
            snippet: `${result.followers.total} followers${country}`,
            imageUrl: (result.images && result.images.length > 0) ? result.images[0].url : undefined,
            link: result.external_urls.spotify,
            metadata: result
        }]
    };
}

export function spotifyGetProfileTool(userConfig: Configuration) {
    return {
        id: "spotify-getProfile",
        description: "Get Spotify profile of the current user.",
        parameters: z.object({}),
        execute: wrapTool("spotify-getProfile", () => getProfileToolCall(userConfig)),
    };
}