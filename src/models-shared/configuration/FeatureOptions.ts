import {BotanikaFeature} from "./BotanikaFeature";
import {SettingConfiguration} from "./SettingConfiguration.ts";
import {GenericTemplates} from "../../ui/templates/generic.templates.ts";
import {SpeechProvider} from "./SpeechProvider.ts";
import {TranscriptionProvider} from "./TranscriptionProvider.ts";
import {LlmProvider} from "../llms/llmProvider.ts";
import {ProviderSettings} from "./ProviderSettings.ts";
import {FeatureType} from "./FeatureType.ts";
import {getFeatureOption} from "./getFeatureOption.ts";
import {Configuration} from "./Configuration.ts";

const apiKeyConfig = (url?: string) => <SettingConfiguration>{
    key: "apiKey",
    icon: "key",
    descriptionContent: url ? [GenericTemplates.link(url)] : [],
    label: "API Key",
    type: "password",
};

export function getEnabledProvidersForFeatureType(config: Configuration, featureType: FeatureType) {
    const providers = [];

    for (const [feat, pSettings] of Object.entries(featureOptions)) {
        const typeFeature = pSettings.features.find(f => f.featureType === featureType);
        if (typeFeature) {
            const configured = getFeatureOption(config, feat as BotanikaFeature);
            if (typeFeature.required.every(r => !!configured[r])) {
                switch (featureType) {
                    case FeatureType.llm:
                        providers.push(typeFeature.llmProvider);
                        break;
                    case FeatureType.tts:
                        providers.push(typeFeature.speechProvider);
                        break;
                    case FeatureType.stt:
                        providers.push(typeFeature.transcriptionProvider);
                        break;
                    case FeatureType.tools:
                    default:
                        break;
                }
            }
        }
    }

    return providers;
}

export function featureTypeIsUsable(config: Configuration, featureType: FeatureType) {
    return getEnabledProvidersForFeatureType(config, featureType).length > 0;
}

export const featureOptions: Record<BotanikaFeature, ProviderSettings> = {
    [BotanikaFeature.OpenRouter]: {
        keys: [apiKeyConfig("https://openrouter.ai/settings/keys")],
        features: [
            { featureType: FeatureType.llm, required: ["apiKey"], llmProvider: LlmProvider.openrouter },
        ]
    },
    [BotanikaFeature.ElevenLabs]: {
        keys: [apiKeyConfig("https://elevenlabs.io/app/settings/api-keys")],
        features: [
            { featureType: FeatureType.stt, required: ["apiKey"], transcriptionProvider: TranscriptionProvider.elevenlabs },
        ]
    },
    [BotanikaFeature.RevAi]: {
        keys: [apiKeyConfig("https://www.rev.ai/access-token")],
        features: [
            { featureType: FeatureType.stt, required: ["apiKey"], transcriptionProvider: TranscriptionProvider.revai },
        ]
    },
    [BotanikaFeature.Groq]: {
        keys: [apiKeyConfig("https://console.groq.com/keys")],
        features: [
            { featureType: FeatureType.llm, required: ["apiKey"], llmProvider: LlmProvider.groq },
            { featureType: FeatureType.stt, required: ["apiKey"], transcriptionProvider: TranscriptionProvider.groq },
        ]
    },
    [BotanikaFeature.OpenAI]: {
        keys: [apiKeyConfig("https://platform.openai.com/account/api-keys")],
        features: [
            { featureType: FeatureType.llm, required: ["apiKey"], llmProvider: LlmProvider.openai },
            { featureType: FeatureType.stt, required: ["apiKey"], transcriptionProvider: TranscriptionProvider.openai },
            { featureType: FeatureType.tts, required: ["apiKey"], speechProvider: SpeechProvider.openai },
        ]
    },
    [BotanikaFeature.Lmnt]: {
        keys: [apiKeyConfig("https://app.lmnt.com/account#api-keys")],
        features: [
            { featureType: FeatureType.tts, required: ["apiKey"], speechProvider: SpeechProvider.lmnt },
        ]
    },
    [BotanikaFeature.Hume]: {
        keys: [apiKeyConfig("https://platform.hume.ai/settings/keys")],
        features: [
            { featureType: FeatureType.tts, required: ["apiKey"], speechProvider: SpeechProvider.hume },
        ]
    },
    [BotanikaFeature.Deepgram]: {
        keys: [apiKeyConfig("https://console.deepgram.com/")],
        features: [
            { featureType: FeatureType.stt, required: ["apiKey"], transcriptionProvider: TranscriptionProvider.deepgram },
        ]
    },
    [BotanikaFeature.Gladia]: {
        keys: [apiKeyConfig("https://app.gladia.io/account")],
        features: [
            { featureType: FeatureType.stt, required: ["apiKey"], transcriptionProvider: TranscriptionProvider.gladia },
        ]
    },
    [BotanikaFeature.AssemblyAI]: {
        keys: [apiKeyConfig("https://www.assemblyai.com/dashboard/api-keys")],
        features: [
            { featureType: FeatureType.stt, required: ["apiKey"], transcriptionProvider: TranscriptionProvider.assemblyai },
        ]
    },
    [BotanikaFeature.Fal]: {
        keys: [apiKeyConfig("https://fal.ai/dashboard/keys")],
        features: [
            { featureType: FeatureType.stt, required: ["apiKey"], transcriptionProvider: TranscriptionProvider.fal },
        ]
    },
    [BotanikaFeature.GoogleSearch]: {
        keys: [
            apiKeyConfig("https://console.cloud.google.com/apis/dashboard"),
            {
                key: "searchEngineId",
                icon: "key",
                descriptionContent: [GenericTemplates.link("https://programmablesearchengine.google.com/controlpanel/all")],
                label: "Search engine ID",
                type: "string",
            },
        ],
        features: [
            { featureType: FeatureType.tools, required: ["apiKey", "searchEngineId"] }
        ]
    },
    [BotanikaFeature.Ollama]: {
        keys: [
            {
                key: "url",
                icon: "key",
                description: "Ollama URL. You can use ngrok to make it publicly available. Make sure to configure Ollama to allow incoming connections from this instance's host.",
                label: "Ollama URL",
                type: "string",
            },
        ],
        features: [
            { featureType: FeatureType.llm, required: ["url"], llmProvider: LlmProvider.ollama },
        ]
    },
    [BotanikaFeature.Azure]: {
        keys: [
            {
                key: "resourceName",
                icon: "graph_5",
                description: "Azure resource name",
                label: "Resource name",
                type: "string",
            },
            apiKeyConfig()
        ],
        features: [
            { featureType: FeatureType.llm, required: ["resourceName", "apiKey"], llmProvider: LlmProvider.azure },
            { featureType: FeatureType.stt, required: ["resourceName", "apiKey"], transcriptionProvider: TranscriptionProvider.azureopenai },
        ]
    },
};