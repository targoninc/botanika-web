import {Request, Response} from "express";
import fs from "fs";
import {appDataPath} from "../../appData";
import {transcribeLocal} from "./localWhisper";
import {transcribeOpenAI} from "./openaiWhisper";
import {getConfig} from "../../configuration.ts";
import {BotanikaFeature} from "../../../models/features/BotanikaFeature.ts";
import {featureOption} from "../tools/servers/allTools.ts";

export async function transcribeEndpoint(req: Request, res: Response) {
    if (!req.file) {
        res.status(400).send("No file uploaded.");
        return;
    }

    const file = req.file;
    const tmpFileName = `${appDataPath}/tmp/${file.originalname}`;
    if (!fs.existsSync(`${appDataPath}/tmp`)) {
        fs.mkdirSync(`${appDataPath}/tmp`, { recursive: true });
    }
    fs.writeFileSync(tmpFileName, file.buffer);
    const userConfig = await getConfig(req.user.id);
    if (!userConfig.enableStt) {
        return;
    }

    let provider = "local";
    if (!featureOption(userConfig, BotanikaFeature.OpenAI).apiKey) {
        return res.status(400).send("OpenAI API key missing");
    }

    const startTime = performance.now();
    try {
        switch (provider) {
            case "openai":
                await transcribeOpenAI(tmpFileName, userConfig, res);
                break;
            case "local":
                await transcribeLocal(tmpFileName, res);
                break;
            default:
                throw new Error("Invalid transcription provider");
        }
    } catch (e) {
        console.error("Error during transcription:", e);
        res.status(500).send(e.toString());
    }
    const diff = performance.now() - startTime;
    console.log(`Transcribed audio in ${diff}ms`);
}