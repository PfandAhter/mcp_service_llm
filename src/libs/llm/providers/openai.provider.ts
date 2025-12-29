// src/libs/llm/providers/openai.provider.ts
// OpenAI API provider implementation

import { BaseLLMProvider } from './base-llm.provider';
import OpenAI from 'openai';
import { LLMMessage, LLMResponse, ToolDefinition, LLMConfig } from '../interfaces/llm.types';

/**
 * OpenAIProvider
 * 
 * Implementation of BaseLLMProvider for OpenAI API.
 * Supports GPT-4, GPT-3.5, and function calling.
 * 
 * Usage:
 * ```typescript
 * const provider = new OpenAIProvider(
 *   { model: 'gpt-4o', temperature: 0.7 },
 *   process.env.OPENAI_API_KEY
 * );
 * const response = await provider.generateResponse(messages, systemPrompt, tools);
 * ```
 */


export class OpenAIProvider extends BaseLLMProvider {
    private client: OpenAI;

    constructor(config: LLMConfig, apiKey: string) {
        super(config);
        this.client = new OpenAI({ apiKey });
    }

    async generateResponse(
        messages: LLMMessage[],
        systemPrompt?: string,
        tools?: ToolDefinition[],
    ): Promise<LLMResponse> {
        // Build OpenAI messages array
        const openAiMessages: any[] = [];

        // Add system prompt as first message
        if (systemPrompt) {
            openAiMessages.push({ role: 'system', content: systemPrompt });
        }

        // Map agnostic messages to OpenAI format
        for (const msg of messages) {
            openAiMessages.push(this.mapToOpenAIMessage(msg));
        }

        return this.executeRequest(openAiMessages, tools);
    }

    /**
     * Generate response using provider-native history format
     * 
     * @param nativeHistory - History in OpenAI's native format
     * @param systemPrompt - System instruction (added as first message if not present)
     * @param tools - Available tools
     */
    async generateWithNativeHistory(
        nativeHistory: any[],
        systemPrompt?: string,
        tools?: ToolDefinition[],
    ): Promise<LLMResponse> {
        const messages = [...nativeHistory];

        // Add system prompt at beginning if provided and not already present
        if (systemPrompt && (!messages.length || messages[0].role !== 'system')) {
            messages.unshift({ role: 'system', content: systemPrompt });
        }

        return this.executeRequest(messages, tools);
    }

    /**
     * Get the provider name for history manager selection
     */
    getProviderName(): 'openai' {
        return 'openai';
    }

    /**
     * Execute the OpenAI API request
     */
    private async executeRequest(messages: any[], tools?: ToolDefinition[]): Promise<LLMResponse> {
        // Map tools to OpenAI format
        const openAiTools = tools?.map((t) => ({
            type: 'function' as const,
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        }));

        // Make API call
        const response = await this.client.chat.completions.create({
            model: this.config.model,
            messages,
            tools: openAiTools,
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            top_p: this.config.topP,
        });

        const choice = response.choices[0];

        // Normalize to agnostic response format
        return {
            text: choice.message.content,
            toolCalls:
                choice.message.tool_calls?.map((tc) => ({
                    id: tc.id,
                    name: tc.function.name,
                    args: JSON.parse(tc.function.arguments),
                })) || [],
            usage: {
                inputTokens: response.usage?.prompt_tokens || 0,
                outputTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
            },
            rawResponse: response,
        };
    }

    /**
     * Map agnostic message to OpenAI format
     */
    private mapToOpenAIMessage(msg: LLMMessage): any {
        // Tool result message
        if (msg.role === 'tool') {
            return {
                role: 'tool',
                tool_call_id: msg.toolResult?.callId,
                content: JSON.stringify(msg.toolResult?.result),
            };
        }

        // Assistant with tool calls
        if (msg.toolCalls && msg.toolCalls.length > 0) {
            return {
                role: 'assistant',
                content: null,
                tool_calls: msg.toolCalls.map((tc) => ({
                    id: tc.id,
                    type: 'function',
                    function: {
                        name: tc.name,
                        arguments: JSON.stringify(tc.args),
                    },
                })),
            };
        }

        // Regular message
        return {
            role: msg.role,
            content: msg.content,
        };
    }
}
