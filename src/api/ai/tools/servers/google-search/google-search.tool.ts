import {z} from "zod";
import axios from "axios";
import {GoogleSearchResult} from "./google-search.models.ts";
import {ResourceReference} from "../../../../../models/chat/ResourceReference.ts";
import dotenv from "dotenv";
import {ChatToolResult} from "../../../../../models/chat/ChatToolResult.ts";
import {wrapTool} from "../../tooling.ts";
import {BotanikaFeature} from "../../../../../models/features/BotanikaFeature.ts";
import { Configuration } from "src/models/Configuration.ts";
import { WebsocketConnection } from "src/ui-server/websocket-server/websocket.ts";

dotenv.config();

async function search(userConfig: Configuration, query: string): Promise<GoogleSearchResult> {
    try {
        const apiKey = userConfig.featureOptions[BotanikaFeature.GoogleSearch].apiKey;
        const searchEngineId = userConfig.featureOptions[BotanikaFeature.GoogleSearch].searchEngineId;

        if (!apiKey || !searchEngineId) {
            throw new Error("Google API Key or Search Engine ID is not defined in environment variables.");
        }

        const url = `https://www.googleapis.com/customsearch/v1`;
        const response = await axios.get(url, {
            params: {
                key: apiKey,
                cx: searchEngineId,
                q: query
            }
        });

        return response.data as GoogleSearchResult;
    } catch (error: any) {
        console.error("Error occurred while searching:", error.message);
        throw new Error(`Search failed: ${error.message}`);
    }
}

async function toolCall(input: any, userConfig: Configuration) {
    const result = await search(userConfig, input.query);
    return <ChatToolResult>{
        text: `${result.items.length} Google search results`,
        references: result.items.map(i => {
            return <ResourceReference>{
                type: "resource-reference",
                name: i.title,
                link: i.link,
                snippet: i.snippet,
                imageUrl: i.pagemap?.cse_thumbnail?.length > 0 ? i.pagemap.cse_thumbnail[0].src : null
            }
        }),
    };
}

export function googleSearchTool(userConfig: Configuration, ws: WebsocketConnection, chatId: string) {
    return {
        id: "google-search-engine",
        description: "Web search. Useful for when you need to answer search questions. Input should be a search query.",
        parameters: z.object({
            query: z.string().describe('The query to search for'),
        }),
        execute: wrapTool("google-search-engine", input => toolCall(input, userConfig), ws, chatId),
    };
}