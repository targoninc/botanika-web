import {experimental_createMCPClient as createMCPClient, ToolSet} from 'ai';
import {TempMcpClient} from "./models/TempMcpClient";
import {McpConfiguration} from "../../../models/mcp/McpConfiguration";
import {CLI} from "../../CLI";
import {getMcpConfig} from "./endpoints.ts";
import {McpServerConfig} from "../../../models/mcp/McpServerConfig.ts";

export async function createClient(url: string, headers: Record<string, string>): Promise<TempMcpClient> {
    return await createMCPClient({
        transport: {
            type: 'sse',
            url,
            headers: {
                "Content-Type": "application/json",
                ...headers
            }
        },
        onUncaughtError: (e) => {
            CLI.error(`Error in MCP client: ${e}`);
        }
    }) as unknown as TempMcpClient;
}

export async function createClientsFromConfig(servers: McpServerConfig[]) {
    if (!servers || servers.length === 0) {
        return [];
    }

    const clients: TempMcpClient[] = [];
    for (const server of servers) {
        const client = await createClient(server.url, server.headers ?? {});
        clients.push(client);
    }
    return clients;
}

export async function createClients(userId: string) {
    const config = await getMcpConfig(userId);
    return await createClientsFromConfig(config);
}

export async function getAllMcpTools(clients: TempMcpClient[]) {
    const tools: ToolSet = {};
    for (const client of clients) {
        const clientTools = await client.tools() as ToolSet;
        for (const toolKey in clientTools) {
            tools[toolKey] = clientTools[toolKey];
        }
    }
    return tools;
}