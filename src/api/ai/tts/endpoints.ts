import { Application, Request, Response } from "express";
import {CLI} from "../../CLI";
import { ApiEndpoint } from "../../../models-shared/ApiEndpoints";
import {getTtsAudio} from "./tts.ts";
import {db} from "../../database/db.ts";
import {getConfig} from "../../configuration.ts";

export async function getAudioEndpoint(req: Request, res: Response) {
    const id = req.query.id as string;
    if (!id) {
        res.status(400).send("Missing id parameter");
        return;
    }

    CLI.debug(`Audio playback requested for message ID ${id}`);

    const message = await db.message.findUnique({
        where: {
            id
        }
    });
    if (!message) {
        res.status(404).send("Message does not exist");
        return;
    }

    const config = await getConfig(req.user.id);
    const audio = await getTtsAudio(message.text, config);

    res.setHeader('Content-Type', audio.mimeType);

    const audioBuffer = Buffer.from(audio.base64, 'base64');
    res.send(audioBuffer);


}

export function addAudioEndpoints(app: Application) {
    app.get(ApiEndpoint.AUDIO, getAudioEndpoint);
}
