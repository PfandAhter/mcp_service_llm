// src/modules/llm/services/llm-factory.service.ts
// Factory service for instantiating LLM providers

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseLLMProvider } from 'src/libs/llm/providers/base-llm.provider';
import { GeminiProvider } from 'src/libs/llm/providers/gemini.provider';
import { OpenAIProvider } from 'src/libs/llm/providers/openai.provider';
import { LLMConfiguration, LLMConfig } from 'src/libs/llm/interfaces/llm.types';
import { Configuration } from 'src/config/configuration';

/**
 * LLMFactoryService
 * 
 * Responsible for instantiating the correct LLM provider based on configuration.
 * Uses typed configuration from NestJS ConfigService.
 */
@Injectable()
export class LLMFactoryService {
    constructor(private readonly configService: ConfigService<Configuration, true>) { }

    /**
     * Get the appropriate LLM provider based on configuration
     */
    getProvider(llmConfig: LLMConfiguration): BaseLLMProvider {
        const providerConfig: LLMConfig = {
            model: llmConfig.model,
            temperature: llmConfig.parameters.temperature,
            maxTokens: llmConfig.parameters.maxTokens,
            topP: llmConfig.parameters.topP,
            topK: llmConfig.parameters.topK,
        };

        switch (llmConfig.provider) {
            case 'gemini': {
                const apiKey = this.configService.get('llm.gemini.apiKey', { infer: true });
                if (!apiKey) {
                    throw new Error('GEMINI_API_KEY not configured. Check your .env file.');
                }
                return new GeminiProvider(providerConfig, apiKey);
            }

            case 'openai': {
                const apiKey = this.configService.get('llm.openai.apiKey', { infer: true });
                if (!apiKey) {
                    throw new Error('OPENAI_API_KEY not configured. Check your .env file.');
                }
                return new OpenAIProvider(providerConfig, apiKey);
            }

            case 'anthropic':
                throw new Error('Anthropic provider not yet implemented.');

            default:
                throw new Error(`Unknown LLM provider: ${llmConfig.provider}. Supported: gemini, openai`);
        }
    }

    /**
     * Check if a provider API key is configured
     */
    isProviderConfigured(provider: 'gemini' | 'openai'): boolean {
        if (provider === 'gemini') {
            return !!this.configService.get('llm.gemini.apiKey', { infer: true });
        }
        if (provider === 'openai') {
            return !!this.configService.get('llm.openai.apiKey', { infer: true });
        }
        return false;
    }

    /**
     * Get list of configured providers
     */
    getConfiguredProviders(): string[] {
        const providers: string[] = [];
        if (this.isProviderConfigured('gemini')) providers.push('gemini');
        if (this.isProviderConfigured('openai')) providers.push('openai');
        return providers;
    }
}
