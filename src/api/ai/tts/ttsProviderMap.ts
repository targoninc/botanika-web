import {Configuration} from "../../../models-shared/configuration/Configuration.ts";
import {BotanikaFeature} from "../../../models-shared/configuration/BotanikaFeature.ts";
import {createOpenAI} from "@ai-sdk/openai";
import {SpeechProvider} from "../../../models-shared/configuration/SpeechProvider.ts";
import {createLMNT} from "@ai-sdk/lmnt";
import {SpeechModel} from "ai";
import {createHume} from "@ai-sdk/hume";
import {getFeatureOption} from "../../../models-shared/configuration/getFeatureOption.ts";

export const ttsProviderMap: Record<SpeechProvider, (modelName: string, config: Configuration) => SpeechModel> = {
    [SpeechProvider.openai]: (modelName: string, config: Configuration) => {
        return createOpenAI({
            apiKey: getFeatureOption(config, BotanikaFeature.OpenAI).apiKey,
        }).speech(modelName);
    },
    [SpeechProvider.lmnt]: (modelName: string, config: Configuration) => {
        return createLMNT({
            apiKey: getFeatureOption(config, BotanikaFeature.Lmnt).apiKey,
        }).speech(modelName);
    },
    [SpeechProvider.hume]: (modelName: string, config: Configuration) => {
        return createHume({
            apiKey: getFeatureOption(config, BotanikaFeature.Hume).apiKey,
        }).speech();
    },
}

export const ttsProviderFeatures: Record<SpeechProvider, BotanikaFeature> = {
    [SpeechProvider.lmnt]: BotanikaFeature.Lmnt,
    [SpeechProvider.hume]: BotanikaFeature.Hume,
    [SpeechProvider.openai]: BotanikaFeature.OpenAI,
}