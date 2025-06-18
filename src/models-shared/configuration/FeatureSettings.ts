import {SpeechProvider} from "./SpeechProvider.ts";
import {TranscriptionProvider} from "./TranscriptionProvider.ts";
import {LlmProvider} from "../llms/llmProvider.ts";

import {FeatureType} from "./FeatureType.ts";

export interface FeatureSettings {
    required: string[],
    optional?: string[],
    featureType: FeatureType,
    speechProvider?: SpeechProvider,
    transcriptionProvider?: TranscriptionProvider,
    llmProvider?: LlmProvider,
}