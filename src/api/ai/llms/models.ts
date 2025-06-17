import {LanguageModelV1} from "ai"
import {createGroq} from "@ai-sdk/groq";
import {createOpenAI} from "@ai-sdk/openai";
import {createAzure} from "@ai-sdk/azure";
import {createOpenRouter} from "@openrouter/ai-sdk-provider";
import {createOllama} from 'ollama-ai-provider';
import {LlmProvider} from "../../../models/llms/llmProvider";
import {ModelDefinition} from "../../../models/llms/ModelDefinition";
import {getGroqModels} from "./providers/groq";
import {getOpenaiModels} from "./providers/openai";
import {getOllamaModels} from "./providers/ollama";
import {getAzureModels} from "./providers/azure";
import {getOpenrouterModels} from "./providers/openrouter";
import dotenv from "dotenv";
import {ProviderDefinition} from "../../../models/llms/ProviderDefinition";
import { BotanikaFeature } from "../../../models/features/BotanikaFeature";
import {Configuration} from "../../../models/Configuration.ts";

dotenv.config();

export const providerMap: Record<LlmProvider, (modelName: string, config: Configuration) => LanguageModelV1> = {
    [LlmProvider.groq]: (modelName: string, config: Configuration) => {
        return createGroq({
            apiKey: config.featureOptions[BotanikaFeature.Groq].apiKey,
        }).languageModel(modelName);
    },
    [LlmProvider.openai]: (modelName: string, config: Configuration) => {
        return createOpenAI({
            apiKey: config.featureOptions[BotanikaFeature.OpenAI].apiKey,
        }).languageModel(modelName);
    },
    [LlmProvider.ollama]: (modelName: string, config: Configuration) => {
        return createOllama({
            baseURL: config.featureOptions[BotanikaFeature.Ollama].url,
        }).languageModel(modelName, {
            simulateStreaming: true
        });
    },
    [LlmProvider.azure]: (modelName: string, config: Configuration) => {
        return createAzure({
            resourceName: config.featureOptions[BotanikaFeature.Azure].resourceName,
            apiKey: config.featureOptions[BotanikaFeature.Azure].apiKey,
        }).languageModel(modelName);
    },
    [LlmProvider.openrouter]: (modelName: string, config: Configuration) => {
        return createOpenRouter({
            apiKey: config.featureOptions[BotanikaFeature.OpenRouter].apiKey
        }).languageModel(modelName);
    }
}

export function getModel(providerName: LlmProvider, model: string, config: Configuration): LanguageModelV1 {
    const provider = providerMap[providerName];
    if (!provider) {
        throw new Error("Invalid LLM provider");
    }

    return provider(model, config);
}

export function getAvailableModels(provider: string): ModelDefinition[] {
    switch (provider) {
        case LlmProvider.groq:
            return getGroqModels();
        case LlmProvider.openai:
            return getOpenaiModels();
        case LlmProvider.ollama:
            return getOllamaModels();
        case LlmProvider.azure:
            return getAzureModels();
        case LlmProvider.openrouter:
            return getOpenrouterModels();
        default:
            throw new Error("Unsupported LLM provider");
    }
}

export async function initializeLlms() {
    const availableProviders = Object.values(LlmProvider);
    const models: Record<string, ProviderDefinition> = {};
    for (const provider of availableProviders) {
        models[provider] = <ProviderDefinition>{
            models: await getAvailableModels(provider)
        };
    }
    return models;
}
