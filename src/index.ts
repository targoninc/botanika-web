import express, {Response, Request} from "express";
import cors from "cors";
import {addAudioEndpoints, addTranscribeEndpoints} from "./api/ai/tts/endpoints.ts";
import dotenv from "dotenv";
import ui from "./ui-server/baseHtml.html" with {type: "text"};

import {addUserEndpoints, addAuthenticationMiddleware} from "./api/authentication/middleware.ts";
import {addShortcutEndpoints} from "./api/shortcuts/shortcuts.ts";
import { addMcpEndpoints } from "./api/ai/tools/endpoints.ts";
import {addChatEndpoints} from "./api/ai/endpoints.ts";
import {addConfigEndpoints} from "./api/configuration.ts";
import {CLI} from "./api/CLI.ts";
import {addWebsocketServer} from "./api/websocket-server/websocket.ts";
import * as http from "node:http";
import path from "node:path";
import {ApiEndpoint} from "./models/ApiEndpoints.ts";

dotenv.config();

const outDir = path.join(process.cwd(), "out");
const styleDir = path.join(process.cwd(), "src/styles");
const uiDir = path.join(process.cwd(), "src/ui");
const assetsDir = path.join(process.cwd(), "src/assets");

const APP_PORT = Number(process.env.PORT || "3001");
try {
    const test = await fetch(`http://localhost:${APP_PORT}`);
    if (test.status === 200) {
        CLI.error("Server is already running");
        process.exit(0);
    }
} catch {
    // Ignore error if server is not running
}

export const app = express();

// Static files
[outDir, uiDir, styleDir, assetsDir].forEach(dir => {
    app.use(express.static(dir));
});

app.use(cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
}));

addAuthenticationMiddleware(app);

addTranscribeEndpoints(app);
app.use(express.json());

addConfigEndpoints(app);
addChatEndpoints(app);
addMcpEndpoints(app);
addAudioEndpoints(app);
addShortcutEndpoints(app);
addUserEndpoints(app);

// TODO: Does not work with horizontal scaling. Provide a way to define the signing key in the environment variables and load it from there.
export const signingKey = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);

app.get(ApiEndpoint.WS_TOKEN, async (req: Request, res: Response) => {
    const payload = JSON.stringify({
        id: req.user.id,
        session: req.oidc.user.sid
    });

    const token = {
        payload,
        signature: Buffer.from(await crypto.subtle.sign("Ed25519", signingKey.privateKey, new TextEncoder().encode(payload))).toBase64()
    };

    res.json({ token: btoa(JSON.stringify(token)) });
});
// Handle all other routes with baseHtml
app.get('*', async (req, res) => {
    try {
        res.type('text/html').send(ui);
    } catch (error) {
        console.error("Error rendering HTML:", error);
        res.status(500).send("Internal Server Error");
    }
});

const server = http.createServer(app);
addWebsocketServer(server);

server.listen(APP_PORT, () => {
    console.log(`Server started: http://localhost:${APP_PORT}`);
    console.log(`WebSocket server available at: ws://localhost:${APP_PORT}/ws`);
});
