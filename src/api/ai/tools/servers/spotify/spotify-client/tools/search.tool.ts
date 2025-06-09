import {z} from "zod";
import {ResourceReference} from "../../../../../../../models/chat/ResourceReference";
import {ChatToolResult} from "../../../../../../../models/chat/ChatToolResult";
import {wrapTool} from "../../../../tooling";
import {SearchType} from "../models/SearchType";
import {checkIfEnabled, createClient} from "../createClient";
import {SpotifySearchOptions} from "../models/SpotifySearchOptions";
import { Configuration } from "src/models/Configuration";
import { WebsocketConnection } from "src/ui-server/websocket-server/websocket";

async function search(userConfig: Configuration, query: string, searchTypes: SearchType[]): Promise<SpotifyApi.SearchResponse> {
    const api = await createClient(userConfig);
    try {
        const response = await api.search(query, searchTypes, {
            limit: 10,
        });

        return response.body;
    } catch (error: any) {
        console.error("Error occurred while searching:", error.message);
        throw new Error(`Search failed: ${error.message}`);
    }
}

async function searchToolCall(input: SpotifySearchOptions, userConfig: Configuration) {
    if (!checkIfEnabled(userConfig)) {
        throw new Error("Spotify is not configured");
    }

    const result = await search(userConfig, input.query, input.searchTypes);
    const refs = Object.keys(result).flatMap(key => {
        return result[key].items
            .filter(i => !!i)
            .map((i: any) => {
                const artists = i.artists ? i.artists.map(a => a.name).join(", ") : undefined;

                return <ResourceReference>{
                    type: "resource-reference",
                    name: artists ? artists + " - " + i.name : i.name,
                    link: i.external_urls?.spotify,
                    imageUrl: i.images ? i.images[0]?.url : null,
                    metadata: {
                        id: i.id,
                        uri: i.uri,
                        artists: i.artists
                    }
                }
            })
    });

    return <ChatToolResult>{
        text: `${refs.length} Spotify search results`,
        references: refs
    };
}

export function spotifySearchTool(userConfig: Configuration, ws: WebsocketConnection, chatId: string) {
    return {
        id: "spotify-search",
        description: "Spotify search. Useful for when you need to search for music or podcasts.",
        parameters: z.object({
            query: z.string().describe('What to search for'),
            searchTypes: z.array(z.nativeEnum(SearchType)).describe('What types to search for. Must be an array.'),
        }),
        execute: wrapTool("spotify-search", input => searchToolCall(input, userConfig)),
    };
}