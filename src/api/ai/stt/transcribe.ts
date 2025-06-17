import {Response} from "express";
import {Configuration} from "../../../models/Configuration.ts";
import {experimental_transcribe} from "ai";
import {readFile} from "fs/promises";
import {CLI} from "../../CLI.ts";
import {sttProviderMap} from "./sttProviderMap.ts";

export async function transcribe(file: string, config: Configuration, res: Response) {
    try {
        const response = await experimental_transcribe({
            model: sttProviderMap[config.transcriptionProvider](config.transcriptionModel, config),
            audio: await readFile(file),
        });
        res.send(response.text);
    } catch (error) {
        CLI.error(error);
    }
}