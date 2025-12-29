// src/libs/llm/providers/base-llm.provider.ts
// Abstract base class for all LLM providers

import { LLMConfig, LLMMessage, LLMResponse, ToolDefinition } from '../interfaces/llm.types';

/**
 * BaseLLMProvider
 * 
 * Abstract base class that defines the interface for all LLM providers.
 * Extend this class to implement support for new LLM APIs.
 * 
 * Example:
 * ```typescript
 * export class MyCustomProvider extends BaseLLMProvider {
 *   async generateResponse(messages, systemPrompt, tools) {
 *     // Implement your provider logic
 *   }
 *   
 *   async generateWithNativeHistory(nativeHistory, systemPrompt, tools) {
 *     // Implement with provider-native history format
 *   }
 *   
 *   getProviderName() {
 *     return 'my-provider';
 *   }
 * }
 * ```
 */
export abstract class BaseLLMProvider {
    constructor(protected config: LLMConfig) { }

    /**
     * Generate a response from the LLM
     * 
     * @param messages - Conversation history in agnostic format
     * @param systemPrompt - System instruction for the model
     * @param tools - Available tools/functions for the model to call
     * @returns Standardized LLM response
     */
    abstract generateResponse(
        messages: LLMMessage[],
        systemPrompt?: string,
        tools?: ToolDefinition[],
    ): Promise<LLMResponse>;

    /**
     * Generate a response using provider-native history format
     * This is more efficient for multi-turn tool conversations
     * 
     * IMPORTANT: Use this method with provider-specific history managers
     * for correct tool call/result handling.
     * 
     * @param nativeHistory - History in provider's native format
     * @param systemPrompt - System instruction
     * @param tools - Available tools
     */
    abstract generateWithNativeHistory(
        nativeHistory: any[],
        systemPrompt?: string,
        tools?: ToolDefinition[],
    ): Promise<LLMResponse>;

    /**
     * Get the provider name for history manager selection
     */
    abstract getProviderName(): 'gemini' | 'openai' | 'anthropic';

    /**
     * Update configuration at runtime
     * Useful for changing temperature, maxTokens, etc. per request
     */
    updateConfig(newConfig: Partial<LLMConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     */
    getConfig(): LLMConfig {
        return { ...this.config };
    }
}
