import {LlmProvider} from "../../models/llms/llmProvider.ts";
import {BotanikaFeature} from "../../models/features/BotanikaFeature.ts";

export const providerFeatureMap: Record<LlmProvider, BotanikaFeature> = {
    [LlmProvider.openai]: BotanikaFeature.OpenAI,
    [LlmProvider.ollama]: BotanikaFeature.Ollama,
    [LlmProvider.groq]: BotanikaFeature.Groq,
    [LlmProvider.azure]: BotanikaFeature.Azure,
    [LlmProvider.openrouter]: BotanikaFeature.OpenRouter,
};