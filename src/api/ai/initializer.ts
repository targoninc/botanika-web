import {createClients, getAllMcpTools} from "./tools/createClient";
import {CLI} from "../CLI";
import {McpInfo} from "./tools/models/McpInfo";

export async function getMcpTools(userId: string) {
    CLI.debug(`Initializing MCP clients...`);
    const mcpClients = await createClients(userId);
    const tools = await getAllMcpTools(mcpClients);

    return <McpInfo>{
        tools,
        onClose: () => {
            for (const client of mcpClients) {
                client.close();
            }
        }
    }
}