import {Application, Request, Response} from "express";
import fs from "fs";
import {appDataPath} from "../../appData";
import {transcribeNew} from "./openaiWhisper";
import {getConfig} from "../../configuration.ts";
import {ApiEndpoint} from "../../../models/ApiEndpoints.ts";
import multer from "multer";
import {CLI} from "../../CLI.ts";

export async function transcribeEndpoint(req: Request, res: Response) {
    if (!req.file) {
        res.status(400).send("No file uploaded.");
        return;
    }

    const userConfig = await getConfig(req.user.id);
    if (!userConfig.enableStt) {
        return;
    }

    const file = req.file;
    const tmpFileName = `${appDataPath}/tmp/${file.originalname}`;
    if (!fs.existsSync(`${appDataPath}/tmp`)) {
        fs.mkdirSync(`${appDataPath}/tmp`, { recursive: true });
    }
    fs.writeFileSync(tmpFileName, file.buffer);
    CLI.success(`Wrote file ${tmpFileName}`);

    const startTime = performance.now();
    try {
        await transcribeNew(tmpFileName, userConfig, res);
        const diff = performance.now() - startTime;
        CLI.success(`Transcribed audio in ${diff}ms`);
    } catch (e) {
        console.error("Error during transcription:", e);
        res.status(500).send(e.toString());
    }
}

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

export function addTranscribeEndpoints(app: Application) {
    app.post(ApiEndpoint.TRANSCRIBE, upload.single('file'), transcribeEndpoint);
}
