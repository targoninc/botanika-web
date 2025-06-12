import {Application, Request, Response} from "express";
import { ApiEndpoint } from "../../../models/ApiEndpoints";
import {db, updateUser} from "../../database/db.ts";
import { JsonArray } from "@prisma/client/runtime/library";
import {McpServerConfig} from "../../../models/mcp/McpServerConfig.ts";

export async function getMcpConfig(id: string) {
    const config = await db.user.findUnique({
        select: { mcpConfiguration: true },
        where: { id }
    });

    return config.mcpConfiguration as unknown as McpServerConfig[];
}

export async function setMcpConfigEndpoint(req: Request) {
    const config = req.body as JsonArray;
    await updateUser(req.user.id, {
        mcpConfiguration: config
    });
}

export function addMcpEndpoints(app: Application) {
    app.get(ApiEndpoint.MCP_CONFIG, async (req: Request, res: Response) => {
        res.send(await getMcpConfig(req.user.id));
    });
    app.post(ApiEndpoint.MCP_CONFIG, setMcpConfigEndpoint);
}
