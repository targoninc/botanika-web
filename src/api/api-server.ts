import express, {Application} from "express";
import cors from "cors";
import {addTranscribeEndpoints} from "./ai/tts/endpoints.ts";
import {createMcpServers} from "./ai/mcp/servers/createServers.ts";
import {createEndpoints} from "./endpoints.ts";
import dotenv from "dotenv";

dotenv.config();

export async function apiServer(app: Application) {
    app.use(cors({
        origin: "*",
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        preflightContinue: false,
        optionsSuccessStatus: 204,
    }));
    addTranscribeEndpoints(app);
    app.use(express.json());

    createMcpServers(app);
    createEndpoints(app);

    return app;
}
