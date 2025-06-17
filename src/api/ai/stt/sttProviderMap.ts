import {TranscriptionModelV1} from "@ai-sdk/provider";
import {Configuration} from "../../../models/Configuration.ts";
import {BotanikaFeature} from "../../../models/features/BotanikaFeature.ts";
import {createOpenAI} from "@ai-sdk/openai";
import {featureOption} from "../tools/servers/allTools.ts";
import {createGroq} from "@ai-sdk/groq";
import {TranscriptionProvider} from "../../../models/transcriptionProvider.ts";
import {createElevenLabs} from "@ai-sdk/elevenlabs";
import {createAzure} from "@ai-sdk/azure";
import {createRevai} from "@ai-sdk/revai";
import {createDeepgram} from "@ai-sdk/deepgram";
import {createGladia} from "@ai-sdk/gladia";
import {createAssemblyAI} from "@ai-sdk/assemblyai";
import {createFal} from "@ai-sdk/fal";

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
        return createElevenLabs({
            apiKey: featureOption(config, BotanikaFeature.ElevenLabs).apiKey,
        }).transcription(modelName);
    },
    [TranscriptionProvider.azureopenai]: function (modelName: string, config: Configuration): TranscriptionModelV1 {
        return createAzure({
            resourceName: config.featureOptions[BotanikaFeature.Azure].resourceName,
            apiKey: config.featureOptions[BotanikaFeature.Azure].apiKey,
        }).transcription(modelName);
    },
    [TranscriptionProvider.revai]: function (modelName: any, config: Configuration): TranscriptionModelV1 {
        return createRevai({
            apiKey: featureOption(config, BotanikaFeature.RevAi).apiKey,
        }).transcription(modelName);
    },
    [TranscriptionProvider.deepgram]: function (modelName: string, config: Configuration): TranscriptionModelV1 {
        return createDeepgram({
            apiKey: featureOption(config, BotanikaFeature.RevAi).apiKey,
        }).transcription(modelName);
    },
    [TranscriptionProvider.gladia]: function (modelName: string, config: Configuration): TranscriptionModelV1 {
        return createGladia({
            apiKey: featureOption(config, BotanikaFeature.RevAi).apiKey,
        }).transcription();
    },
    [TranscriptionProvider.assemblyai]: function (modelName: any, config: Configuration): TranscriptionModelV1 {
        return createAssemblyAI({
            apiKey: featureOption(config, BotanikaFeature.RevAi).apiKey,
        }).transcription(modelName);
    },
    [TranscriptionProvider.fal]: function (modelName: string, config: Configuration): TranscriptionModelV1 {
        return createFal({
            apiKey: featureOption(config, BotanikaFeature.RevAi).apiKey,
        }).transcription(modelName);
    }
}