import {experimental_generateSpeech, GeneratedAudioFile} from "ai";
import {Configuration} from "../../../models-shared/configuration/Configuration.ts";
import {ttsProviderMap} from "./ttsProviderMap.ts";

export async function getTtsAudio(text: string, config: Configuration): Promise<GeneratedAudioFile> {
    try {
        const result = await experimental_generateSpeech({
            model: ttsProviderMap[config.speechProvider](config.speechModel),
            text: text,
        });
        return result.audio;
    } catch (error) {
        console.error("Error while generating speech", error);
    }
}