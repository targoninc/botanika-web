import fs from "fs";
import {terminator} from "../../../models/chat/terminator";
import {OpenAI} from "openai";
import {Response} from "express";
import {Configuration} from "../../../models/Configuration.ts";

let openAi: OpenAI;

export async function transcribeOpenAI(file: string, config: Configuration, res: Response) {
    if (!openAi) {
        openAi = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    const text = await openAi.audio.transcriptions.create({
        model: config.transcriptionModel,
        file: fs.createReadStream(file),
        response_format: "text",
        stream: true,
        language: "en",
    });
    const reader = text.toReadableStream().getReader();
    let done = false;
    while (!done) {
        const { value, done: doneReading } = await reader.read();
        if (doneReading) {
            break;
        }
        const text = new TextDecoder().decode(value);
        res.write(text + terminator);
    }
    res.end();
}