import {Configuration} from "./Configuration.ts";
import {BotanikaFeature} from "./features/BotanikaFeature.ts";

export const defaultConfig: Configuration = {
    display_hotkeys: true,
    botname: "Botanika",
    userDescription: "",
    birthdate: "",
    displayname: "",
    language: "en",
    provider: "groq",
    model: "llama-3.1-8b-instant",
    enableTts: false,
    botDescription: "",
    maxSteps: 5,
    featureOptions: {
        [BotanikaFeature.GoogleSearch]: {
            apiKey: "",
            searchEngineId: ""
        },
        [BotanikaFeature.OpenAI]: {
            apiKey: "",
            transcriptionModel: "",
        },
        [BotanikaFeature.Groq]: {
            apiKey: "",
        },
        [BotanikaFeature.Ollama]: {
            url: "",
        },
        [BotanikaFeature.OpenRouter]: {
            apiKey: "",
        },
        [BotanikaFeature.Spotify]: {
            clientId: "",
            clientSecret: "",
        },
        [BotanikaFeature.Azure]: {
            resourceName: "",
            apiKey: "",
        },
    },
    tintColor: "#00ff00",
}