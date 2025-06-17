import {BotanikaFeature} from "./BotanikaFeature.ts";

export interface Configuration extends Record<string, any> {
    display_hotkeys: boolean;
    language: string;
    botname: string;
    botDescription: string;
    displayname: string;
    userDescription: string;
    birthdate: string;
    provider: string;
    model: string;
    enableAutoTts: boolean;
    enableStt: boolean;
    maxSteps: number;
    transcriptionModel: string;
    transcriptionProvider: string;
    speechModel: string;
    speechProvider: string;
    speechVoice: string;
    featureOptions: {
        [BotanikaFeature.GoogleSearch]: {
            apiKey: string,
            searchEngineId: string,
        },
        [BotanikaFeature.OpenAI]: {
            apiKey: string,
        },
        [BotanikaFeature.Groq]: {
            apiKey: string,
        },
        [BotanikaFeature.Ollama]: {
            url: string,
        },
        [BotanikaFeature.OpenRouter]: {
            apiKey: string,
        },
        [BotanikaFeature.ElevenLabs]: {
            apiKey: string,
        },
        [BotanikaFeature.RevAi]: {
            apiKey: string,
        },
        [BotanikaFeature.Azure]: {
            resourceName: string,
            apiKey: string,
        },
    };
    tintColor: string;
}