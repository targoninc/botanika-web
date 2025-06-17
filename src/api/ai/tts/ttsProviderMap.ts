import {TranscriptionModelV1} from "@ai-sdk/provider";
import {Configuration} from "../../../models/Configuration.ts";
import {BotanikaFeature} from "../../../models/features/BotanikaFeature.ts";
import {createOpenAI} from "@ai-sdk/openai";
import {featureOption} from "../tools/servers/allTools.ts";
import {SpeechProvider} from "./SpeechProvider.ts";
import {createLMNT} from "@ai-sdk/lmnt";
import {SpeechModel} from "ai";
import {createHume} from "@ai-sdk/hume";

export const ttsProviderMap: Record<SpeechProvider, (modelName: string, config: Configuration) => SpeechModel> = {
    [SpeechProvider.openai]: (modelName: string, config: Configuration) => {
        return createOpenAI({
            apiKey: featureOption(config, BotanikaFeature.OpenAI).apiKey,
        }).speech(modelName);
    },
    [SpeechProvider.lmnt]: (modelName: string, config: Configuration) => {
        return createLMNT({
            apiKey: featureOption(config, BotanikaFeature.OpenAI).apiKey,
        }).speech(modelName);
    },
    [SpeechProvider.hume]: (modelName: string, config: Configuration) => {
        return createHume({
            apiKey: featureOption(config, BotanikaFeature.OpenAI).apiKey,
        }).speech();
    },
}