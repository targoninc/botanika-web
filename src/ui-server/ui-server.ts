import ui from "./baseHtml.html" with {type: "text"};
import {config} from "dotenv";
import * as path from "path";
import {CLI} from "../api/CLI.ts";
import {apiServer} from "../api/api-server.ts";
import express, {Application} from "express";
import {addWebsocketServer} from "./websocket-server/websocket.ts";
import http from "http";

config();

console.log(process.cwd());

const outDir = path.join(process.cwd(), "out");
const styleDir = path.join(process.cwd(), "src/styles");
const uiDir = path.join(process.cwd(), "src/ui");

CLI.debug(`Starting API...`);

const APP_PORT = Number(process.env.PORT || "3001");
const port = APP_PORT;

try {
    const test = await fetch(`http://localhost:${port}`);
    if (test.status === 200) {
        CLI.error("Server is already running");
        process.exit(0);
    }
} catch {
    // Ignore error if server is not running
}

export const app = express();

// Static files
[outDir, uiDir, styleDir].forEach(dir => {
    app.use(express.static(dir));
});

export const userWebsocketMap = new Map();

apiServer(app).then((app: Application) => {
    CLI.success(`API started!`);

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

    server.listen(port, () => {
        console.log(`Server started: http://localhost:${port}`);
        console.log(`WebSocket server available at: ws://localhost:${port}/ws`);
    });
});
