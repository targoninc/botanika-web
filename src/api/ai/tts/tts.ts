import {experimental_generateSpeech, GeneratedAudioFile} from "ai";
import {Configuration} from "../../../models-shared/configuration/Configuration.ts";
import {ttsProviderFeatures, ttsProviderMap} from "./ttsProviderMap.ts";
import {CLI} from "../../CLI.ts";
import {featureOption} from "../tools/servers/allTools.ts";

export async function getTtsAudio(text: string, config: Configuration): Promise<GeneratedAudioFile> {
    try {
        const result = await experimental_generateSpeech({
            model: ttsProviderMap[config.speechProvider](config.speechModel, config),
            text: text,
            voice: featureOption(config, ttsProviderFeatures[config.speechProvider]).voice,
            outputFormat: "mp3"
        });

        result.warnings.forEach((warning) => {
            CLI.warning(`Warning while generating speech: ${warning.type}`);
        });

        return result.audio;
    } catch (error) {
        console.error("Error while generating speech", error);
    }
}