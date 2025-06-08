import express from "express";
import cors from "cors";
import {addTranscribeEndpoints} from "./ai/tts/endpoints.ts";
import {createMcpServers} from "./ai/mcp/servers/createServers.ts";
import {createEndpoints} from "./endpoints.ts";
import dotenv from "dotenv";

dotenv.config();

const APP_PORT = Number(process.env.PORT || "48678");
export let app = null;

export async function apiServer() {
    const port = APP_PORT;
    try {
        const test = await fetch(`http://localhost:${port}`);
        if (test.status === 200) {
            console.log('Server already running on a different instance');
            return;
        }
    } catch (e) {
        console.log('Server not running, starting...');
    }

    app = express();
    app.use(cors({
        origin: "*",
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        preflightContinue: false,
        optionsSuccessStatus: 204,
    }));
    addTranscribeEndpoints(app);
    app.use(express.json());

    app.get('/', (req, res) => {
        res.send('API up and running');
    });

    createMcpServers(app);
    createEndpoints(app);
    app.listen(port, () => {
        console.log(`Server started: http://localhost:${port}`);
    });
}
