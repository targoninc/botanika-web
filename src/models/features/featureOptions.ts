import {BotanikaFeature} from "./BotanikaFeature";
import {SettingConfiguration} from "../uiExtensions/SettingConfiguration";

const apiKeyConfig = <SettingConfiguration>{
    key: "apiKey",
    icon: "key",
    description: "API Key",
    label: "API Key",
    type: "password",
};

export const featureOptions: Record<BotanikaFeature, SettingConfiguration[]> = {
    [BotanikaFeature.OpenRouter]: [
        apiKeyConfig,
    ],
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
    [BotanikaFeature.OpenAI]: [
        apiKeyConfig,
    ],
    [BotanikaFeature.ElevenLabs]: [
        apiKeyConfig,
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
    /*[BotanikaFeature.Spotify]: [
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
            type: "password",
            validator: value => {
                return [];
            }
        },
    ]*/
};