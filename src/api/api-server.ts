import express, {Application} from "express";
import cors from "cors";
import {addTranscribeEndpoints} from "./ai/tts/endpoints.ts";
import {createMcpServers} from "./ai/mcp/servers/createServers.ts";
import {createEndpoints} from "./endpoints.ts";
import dotenv from "dotenv";

import {auth} from "express-openid-connect"
import * as process from "node:process";

dotenv.config();

export async function apiServer(app: Application) {
    app.use(cors({
        origin: "*",
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        preflightContinue: false,
        optionsSuccessStatus: 204,
    }));

    app.use(auth({
        authRequired: true,
        secret: process.env.OIDC_SECRET,
        clientID: process.env.OIDC_CLIENT_ID,
        issuerBaseURL: process.env.OIDC_ISSUER_BASE_URL,
        baseURL: process.env.OIDC_BASE_URL || `http://localhost:${process.env.PORT || 48678}`,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        clientAuthMethod: "client_secret_basic"
    }))

    addTranscribeEndpoints(app);
    app.use(express.json());

    createMcpServers(app);
    createEndpoints(app);

    return app;
}
