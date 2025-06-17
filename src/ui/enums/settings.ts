import {SettingConfiguration} from "../../models-shared/configuration/SettingConfiguration.ts";
import {TranscriptionProvider} from "../../models-shared/configuration/TranscriptionProvider.ts";
import {SpeechProvider} from "../../models-shared/configuration/SpeechProvider.ts";

export const settings: SettingConfiguration[] = [
    {
        key: "display_hotkeys",
        icon: "keyboard",
        label: "Display hotkeys",
        description: "Whether to display hotkeys in the UI.",
        type: "boolean",
    },
    {
        key: "botname",
        label: "Assistant name",
        description: "What name LLMs will use to refer to themselves",
        type: "string",
    },
    {
        key: "botDescription",
        label: "What should the assistant be like?",
        description: "The assistant will try to align with this description",
        type: "long-string",
    },
    {
        key: "displayname",
        icon: "person",
        label: "Your name",
        description: "Displayed in the UI",
        type: "string",
    },
    {
        key: "userDescription",
        label: "A short description of yourself",
        description: "Will be given to the model(s) as context",
        type: "long-string",
    },
    {
        key: "birthdate",
        icon: "calendar_month",
        label: "Your birthdate",
        description: "Will be given to the model(s) as context",
        type: "date",
    },
    {
        key: "maxSteps",
        icon: "checklist",
        label: "Maximum steps per call",
        description: "Maximum amount of iterations each message you send will trigger",
        type: "number",
    },
    {
        key: "tintColor",
        icon: "colors",
        label: "UI tint color",
        description: "What color to slightly tint the UI with.",
        type: "color",
    }
];

export const transcriptionSettings: SettingConfiguration[] = [
    {
        key: "enableStt",
        icon: "mic",
        label: "Enable transcription",
        description: "Whether transcription of what you say should be enabled",
        type: "boolean",
    },
    {
        key: "transcriptionProvider",
        icon: "transcribe",
        label: "Transcription Provider",
        description: `Which transcription provider to use.`,
        type: "select",
        options: [null].concat(Object.values(TranscriptionProvider))
    },
    {
        key: "transcriptionModel",
        icon: "transcribe",
        label: "Transcription Model",
        description: `Find available models: https://ai-sdk.dev/docs/ai-sdk-core/transcription#transcription-models`,
        type: "string",
    },
];

export const speechSettings: SettingConfiguration[] = [
    {
        key: "enableTts",
        icon: "text_to_speech",
        label: "Enable text to speech",
        description: "Whether assistant messages should be spoken aloud",
        type: "boolean",
    },
    {
        key: "speechProvider",
        icon: "record_voice_over",
        label: "Speech Provider",
        description: `Which speech provider to use.`,
        type: "select",
        options: [null].concat(Object.values(SpeechProvider))
    },
    {
        key: "speechModel",
        icon: "record_voice_over",
        label: "Speech Model",
        description: `Find available models: https://ai-sdk.dev/docs/ai-sdk-core/speech#speech-models`,
        type: "string",
    },
]