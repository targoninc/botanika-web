import {BotanikaFeature} from "./BotanikaFeature";
import {SettingConfiguration} from "../uiExtensions/SettingConfiguration";

const apiKeyConfig = <SettingConfiguration>{
    key: "apiKey",
    icon: "key",
    description: "API Key",
    label: "API Key",
    type: "string",
    validator: value => {
        return [];
    }
};

export const featureOptions: Record<BotanikaFeature, SettingConfiguration[]> = {
    [BotanikaFeature.OpenAI]: [
        apiKeyConfig,
        {
            key: "transcriptionModel",
            icon: "transcribe",
            description: "Which OpenAI transcription model to use.",
            label: "Transcription Model",
            type: "string",
            validator: value => {
                const modelOptions = ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper"];
                return modelOptions.includes(value) || value === '' ? [] : [`Not a valid model, must be one of ${modelOptions.join(",")}`];
            }
        }
    ],
    [BotanikaFeature.GoogleSearch]: [
        apiKeyConfig,
        {
            key: "searchEngineId",
            icon: "key",
            description: "Search engine ID",
            label: "Search engine ID",
            type: "string",
            validator: value => {
                return [];
            }
        },
    ],
    [BotanikaFeature.Groq]: [
        apiKeyConfig,
    ],
    [BotanikaFeature.Ollama]: [
        {
            key: "url",
            icon: "key",
            description: "Ollama URL",
            label: "Ollama URL",
            type: "string",
            validator: value => {
                return [];
            }
        },
    ],
    [BotanikaFeature.Azure]: [
        {
            key: "resourceName",
            icon: "graph_5",
            description: "Resource name",
            label: "Resource name",
            type: "string",
            validator: value => {
                return [];
            }
        },
        apiKeyConfig
    ],
    [BotanikaFeature.OpenRouter]: [
        apiKeyConfig,
    ],
    [BotanikaFeature.Spotify]: [
        {
            key: "clientId",
            icon: "key",
            description: "Client ID",
            label: "Client ID",
            type: "string",
            validator: value => {
                return [];
            }
        },
        {
            key: "clientSecret",
            icon: "key",
            description: "Client secret",
            label: "Client secret",
            type: "string",
            validator: value => {
                return [];
            }
        },
    ]
};