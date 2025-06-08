import {baseHtml} from "./baseHtml";
import {config} from "dotenv";
import * as path from "path";
import {CLI} from "../api/CLI.ts";
import {apiServer} from "../api/api-server.ts";
import {Application} from "express";
import express from "express";

config();

console.log(process.cwd());

const outDir = path.join(process.cwd(), "out");
const styleDir = path.join(process.cwd(), "src/styles");
const uiDir = path.join(process.cwd(), "src/ui");

CLI.debug(`Starting API...`);

const APP_PORT = Number(process.env.PORT || "48678");
const port = APP_PORT;
try {
    const test = await fetch(`http://localhost:${port}`);
    if (test.status === 200) {
        throw new Error('Server already running on a different instance');
    }
} catch (e) {
    console.log('Server not running, starting...');
}

export const app = express();

// Static files
[outDir, uiDir, styleDir].forEach(dir => {
    app.use(express.static(dir));
});

apiServer(app).then((app: Application) => {
    CLI.success(`API started!`);

    // Handle all other routes with baseHtml
    app.get('*', async (req, res) => {
        try {
            const html = await baseHtml(req);
            res.type('text/html').send(html);
        } catch (error) {
            console.error("Error rendering HTML:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    app.listen(port, () => {
        console.log(`Server started: http://localhost:${port}`);
    });
});