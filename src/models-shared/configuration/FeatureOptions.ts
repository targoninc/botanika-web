import {BotanikaFeature} from "./BotanikaFeature";
import {SettingConfiguration} from "./SettingConfiguration.ts";
import {GenericTemplates} from "../../ui/templates/generic.templates.ts";

const apiKeyConfig = (url?: string) => <SettingConfiguration>{
    key: "apiKey",
    icon: "key",
    descriptionContent: url ? [GenericTemplates.link(url)] : [],
    label: "API Key",
    type: "password",
};

export const featureOptions: Record<BotanikaFeature, SettingConfiguration[]> = {
    [BotanikaFeature.OpenRouter]: [apiKeyConfig("https://openrouter.ai/settings/keys")],
    [BotanikaFeature.ElevenLabs]: [apiKeyConfig("https://elevenlabs.io/app/settings/api-keys")],
    [BotanikaFeature.RevAi]: [apiKeyConfig("https://www.rev.ai/access-token")],
    [BotanikaFeature.Groq]: [apiKeyConfig("https://console.groq.com/keys")],
    [BotanikaFeature.OpenAI]: [apiKeyConfig("https://platform.openai.com/account/api-keys")],
    [BotanikaFeature.Lmnt]: [apiKeyConfig("https://app.lmnt.com/account#api-keys")],
    [BotanikaFeature.Hume]: [apiKeyConfig("https://platform.hume.ai/settings/keys")],
    [BotanikaFeature.GoogleSearch]: [
        apiKeyConfig("https://console.cloud.google.com/apis/dashboard"),
        {
            key: "searchEngineId",
            icon: "key",
            descriptionContent: [GenericTemplates.link("https://programmablesearchengine.google.com/controlpanel/all")],
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
        apiKeyConfig()
    ],
};