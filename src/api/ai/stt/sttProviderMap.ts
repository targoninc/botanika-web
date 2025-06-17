import {TranscriptionModelV1} from "@ai-sdk/provider";
import {Configuration} from "../../../models/Configuration.ts";
import {BotanikaFeature} from "../../../models/features/BotanikaFeature.ts";
import {createOpenAI} from "@ai-sdk/openai";
import {featureOption} from "../tools/servers/allTools.ts";
import {createGroq} from "@ai-sdk/groq";
import {TranscriptionProvider} from "../../../models/transcriptionProvider.ts";

export const sttProviderMap: Record<TranscriptionProvider, (modelName: string, config: Configuration) => TranscriptionModelV1> = {
    [TranscriptionProvider.openai]: (modelName: string, config: Configuration) => {
        return createOpenAI({
            apiKey: featureOption(config, BotanikaFeature.OpenAI).apiKey,
        }).transcription(modelName);
    },
    [TranscriptionProvider.groq]: (modelName: string, config: Configuration) => {
        // Not working, see https://github.com/vercel/ai/issues/6413
        return createGroq({
            apiKey: featureOption(config, BotanikaFeature.Groq).apiKey,
        }).transcription(modelName);
    },
    [TranscriptionProvider.elevenlabs]: function (modelName: string, config: Configuration): TranscriptionModelV1 {
        throw new Error("Function not implemented.");
    },
    [TranscriptionProvider.azureopenai]: function (modelName: string, config: Configuration): TranscriptionModelV1 {
        throw new Error("Function not implemented.");
    },
    [TranscriptionProvider.revai]: function (modelName: string, config: Configuration): TranscriptionModelV1 {
        throw new Error("Function not implemented.");
    },
    [TranscriptionProvider.deepgram]: function (modelName: string, config: Configuration): TranscriptionModelV1 {
        throw new Error("Function not implemented.");
    },
    [TranscriptionProvider.gladia]: function (modelName: string, config: Configuration): TranscriptionModelV1 {
        throw new Error("Function not implemented.");
    },
    [TranscriptionProvider.assemblyai]: function (modelName: string, config: Configuration): TranscriptionModelV1 {
        throw new Error("Function not implemented.");
    },
    [TranscriptionProvider.fal]: function (modelName: string, config: Configuration): TranscriptionModelV1 {
        throw new Error("Function not implemented.");
    }
}