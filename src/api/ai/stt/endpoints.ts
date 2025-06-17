import {Application, Request, Response} from "express";
import fs from "fs";
import {appDataPath} from "../../appData";
import {transcribeNew} from "./openaiWhisper";
import {getConfig} from "../../configuration.ts";
import {ApiEndpoint} from "../../../models/ApiEndpoints.ts";
import multer from "multer";
import {CLI} from "../../CLI.ts";
import {execSync} from "child_process";

async function convertAudioFile(tmpFileName: string, convertedFileName: string): Promise<void> {
    try {
        execSync(`ffmpeg -i "${tmpFileName}" -vn -acodec libmp3lame -ab 192k "${convertedFileName}"`);
    } catch (error) {
        throw new Error(`Error converting audio file: ${error.message}`);
    }
}

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
    const convertedFileName = `${appDataPath}/tmp/conv_${file.originalname.split(".")[0]}.mp3`;
    if (!fs.existsSync(`${appDataPath}/tmp`)) {
        fs.mkdirSync(`${appDataPath}/tmp`, { recursive: true });
    }
    fs.writeFileSync(tmpFileName, file.buffer);
    CLI.success(`Wrote file ${tmpFileName}`);
    await convertAudioFile(tmpFileName, convertedFileName);
    CLI.success(`Converted file ${convertedFileName}`);

    const startTime = performance.now();
    try {
        await transcribeNew(convertedFileName, userConfig, res);
        const diff = performance.now() - startTime;
        CLI.success(`Transcribed audio in ${diff}ms`);
    } catch (e) {
        console.error("Error during transcription:", e);
        res.status(500).send(e.toString());
    } finally {
        fs.unlinkSync(tmpFileName);
        fs.unlinkSync(convertedFileName);
    }
}

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

export function addTranscribeEndpoints(app: Application) {
    app.post(ApiEndpoint.TRANSCRIBE, upload.single('file'), transcribeEndpoint);
}
