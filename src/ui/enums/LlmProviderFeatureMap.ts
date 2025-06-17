import {LlmProvider} from "../../models-shared/llms/llmProvider.ts";
import {BotanikaFeature} from "../../models-shared/configuration/BotanikaFeature.ts";

export const llmProviderFeatureMap: Record<LlmProvider, BotanikaFeature> = {
    [LlmProvider.openai]: BotanikaFeature.OpenAI,
    [LlmProvider.ollama]: BotanikaFeature.Ollama,
    [LlmProvider.groq]: BotanikaFeature.Groq,
    [LlmProvider.azure]: BotanikaFeature.Azure,
    [LlmProvider.openrouter]: BotanikaFeature.OpenRouter,
};