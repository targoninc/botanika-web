import {BotanikaFeature} from "./BotanikaFeature";
import {SettingConfiguration} from "./SettingConfiguration.ts";

const apiKeyConfig = <SettingConfiguration>{
    key: "apiKey",
    icon: "key",
    description: "Your own API Key",
    label: "API Key",
    type: "password",
};

const voiceConfig = <SettingConfiguration>{
    key: "voice",
    icon: "record_voice_over",
    description: "The voice to use when generating speech",
    label: "Voice",
    type: "string",
};

export const featureOptions: Record<BotanikaFeature, SettingConfiguration[]> = {
    [BotanikaFeature.OpenRouter]: [apiKeyConfig],
    [BotanikaFeature.ElevenLabs]: [apiKeyConfig],
    [BotanikaFeature.RevAi]: [apiKeyConfig],
    [BotanikaFeature.Groq]: [apiKeyConfig],
    [BotanikaFeature.OpenAI]: [apiKeyConfig, voiceConfig],
    [BotanikaFeature.Lmnt]: [apiKeyConfig, voiceConfig],
    [BotanikaFeature.Hume]: [apiKeyConfig, voiceConfig],
    [BotanikaFeature.GoogleSearch]: [
        apiKeyConfig,
        {
            key: "searchEngineId",
            icon: "key",
            description: "Search engine ID",
            label: "Search engine ID",
            type: "string",
        },
    ],
    [BotanikaFeature.Ollama]: [
        {
            key: "url",
            icon: "key",
            description: "Ollama URL",
            label: "Ollama URL",
            type: "string",
        },
    ],
    [BotanikaFeature.Azure]: [
        {
            key: "resourceName",
            icon: "graph_5",
            description: "Resource name",
            label: "Resource name",
            type: "string",
        },
        apiKeyConfig
    ],
};