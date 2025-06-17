import {getTtsAudioOpenAi} from "./openai";
import {experimental_generateSpeech} from "ai";
import {Configuration} from "../../../models/Configuration.ts";
import {ttsProviderMap} from "./ttsProviderMap.ts";

/**
 * Returns a base64 encoded string of the audio blob
 * @param text The text to generate audio for
 */
export async function getTtsAudio(text: string, config: Configuration): Promise<Blob> {

    try {
        await experimental_generateSpeech({
            model: ttsProviderMap[config.speechProvider](config.speechModel),
            text: text,
        });
    } catch (error) {
        if (AI_NoAudioGeneratedError.isInstance(error)) {
            console.log('AI_NoAudioGeneratedError');
            console.log('Cause:', error.cause);
            console.log('Responses:', error.responses);
        }
    }

    //return await getTtsAudioOpenAi(text);
}