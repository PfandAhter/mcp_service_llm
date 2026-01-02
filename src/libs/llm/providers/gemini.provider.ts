// src/libs/llm/providers/gemini.provider.ts
// Google Gemini API provider implementation

import { BaseLLMProvider } from './base-llm.provider';
import { GoogleGenAI, Content, FunctionCallingConfigMode } from '@google/genai';
import { LLMMessage, LLMResponse, ToolDefinition, LLMConfig } from '../interfaces/llm.types';

/**
 * GeminiProvider
 * 
 * Implementation of BaseLLMProvider for Google Gemini API.
 * Supports text generation, tool/function calling, and streaming.
 * 
 * Usage:
 * ```typescript
 * const provider = new GeminiProvider(
 *   { model: 'gemini-2.0-flash-exp', temperature: 0.7 },
 *   process.env.GEMINI_API_KEY
 * );
 * const response = await provider.generateResponse(messages, systemPrompt, tools);
 * ```
 */
export class GeminiProvider extends BaseLLMProvider {
    private client: GoogleGenAI;

    constructor(config: LLMConfig, apiKey: string) {
        super(config);
        this.client = new GoogleGenAI({ apiKey });
    }

    async generateResponse(
        messages: LLMMessage[],
        systemPrompt?: string,
        tools?: ToolDefinition[],
    ): Promise<LLMResponse> {
        // Prepare system instruction
        const systemInstruction = systemPrompt ? [{ text: systemPrompt }] : undefined;

        // Map tools to Gemini FunctionDeclaration format
        const geminiTools = tools?.length
            ? [
                {
                    functionDeclarations: tools.map((t) => ({
                        name: t.name,
                        description: t.description,
                        parameters: t.parameters,
                    })),
                },
            ]
            : undefined;

        try {
            const response = await this.client.models.generateContent({
                model: this.config.model,
                config: {
                    systemInstruction,
                    tools: geminiTools,
                    // Explicitly set function calling mode to AUTO to fix empty response issue
                    toolConfig: geminiTools ? {
                        functionCallingConfig: {
                            mode: FunctionCallingConfigMode.AUTO,
                        },
                    } : undefined,
                    temperature: this.config.temperature,
                    maxOutputTokens: this.config.maxTokens,
                    topP: this.config.topP,
                },
                contents: messages.map((m) => this.mapToGeminiMessage(m)),
            });

            return this.parseGeminiResponse(response);
        } catch (error: any) {
            // Enhanced error handling for common issues
            if (error.message?.includes('fetch failed')) {
                throw new Error(
                    `Failed to connect to Gemini API. Possible causes:\n` +
                    `1. Network/Firewall blocking the request\n` +
                    `2. Invalid API key\n` +
                    `3. Proxy configuration needed\n` +
                    `Original error: ${error.message}`,
                );
            }
            throw error;
        }
    }

    /**
     * Parse Gemini API response to standardized format
     * Includes rawResponse for proper history management
     */
    private parseGeminiResponse(response: any): LLMResponse {
        const candidate = response.candidates?.[0];
        const content = candidate?.content;
        const usage = response.usageMetadata;

        // Debug logging
        console.log('[GeminiProvider] Raw candidate:', JSON.stringify(candidate, null, 2));
        console.log('[GeminiProvider] Content parts:', JSON.stringify(content?.parts, null, 2));

        // Check for empty response (no parts)
        if (!content?.parts || content.parts.length === 0) {
            console.warn('[GeminiProvider] WARNING: Empty response from Gemini (no parts). Possible causes:');
            console.warn('  - Model wants to call a tool but tools are not properly registered');
            console.warn('  - Safety filter blocked the response');
            console.warn('  - API rate limit or quota issue');
            console.warn('  - finishReason:', candidate?.finishReason);

            // Return a fallback response
            return {
                text: null,
                toolCalls: [],
                usage: {
                    inputTokens: usage?.promptTokenCount || 0,
                    outputTokens: usage?.candidatesTokenCount || 0,
                    totalTokens: usage?.totalTokenCount || 0,
                },
                rawResponse: response,
            };
        }

        // Extract text content
        const textPart = content?.parts?.find((p: any) => p.text !== undefined);
        const text = textPart?.text ?? null;

        console.log('[GeminiProvider] Extracted text:', text);

        // Extract tool calls
        const toolCalls =
            content?.parts
                ?.filter((p: any) => p.functionCall && p.functionCall.name)
                .map((p: any) => ({
                    id: p.functionCall.name, // Gemini uses name as ID
                    name: p.functionCall.name,
                    args: p.functionCall.args || {},
                })) || [];

        console.log('[GeminiProvider] Tool calls found:', toolCalls.length);

        return {
            text,
            toolCalls,
            usage: {
                inputTokens: usage?.promptTokenCount || 0,
                outputTokens: usage?.candidatesTokenCount || 0,
                totalTokens: usage?.totalTokenCount || 0,
            },
            // Include raw response for history management
            rawResponse: response,
        };
    }

    /**
     * Generate response using provider-native history format
     * This is more efficient for multi-turn conversations with tool calls
     * 
     * @param nativeHistory - History in Gemini's native format (Content[])
     * @param systemPrompt - System instruction
     * @param tools - Available tools
     */
    async generateWithNativeHistory(
        nativeHistory: any[],
        systemPrompt?: string,
        tools?: ToolDefinition[],
    ): Promise<LLMResponse> {
        const systemInstruction = systemPrompt ? [{ text: systemPrompt }] : undefined;

        const geminiTools = tools?.length
            ? [{
                functionDeclarations: tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                }))
            }]
            : undefined;

        // Debug: Log tool count being sent to Gemini
        console.log(`[GeminiProvider] Sending ${tools?.length || 0} tools to Gemini`);
        if (geminiTools) {
            console.log(`[GeminiProvider] Function declarations: ${geminiTools[0].functionDeclarations.map(f => f.name).join(', ')}`);
        }

        try {
            const response = await this.client.models.generateContent({
                model: this.config.model,
                config: {
                    systemInstruction,
                    tools: geminiTools,
                    // Explicitly set function calling mode to AUTO to fix empty response issue
                    toolConfig: geminiTools ? {
                        functionCallingConfig: {
                            mode: FunctionCallingConfigMode.AUTO,
                        },
                    } : undefined,
                    temperature: this.config.temperature,
                    maxOutputTokens: this.config.maxTokens,
                    topP: this.config.topP,
                },
                contents: nativeHistory,
            });

            return this.parseGeminiResponse(response);
        } catch (error: any) {
            if (error.message?.includes('fetch failed')) {
                throw new Error(
                    `Failed to connect to Gemini API: ${error.message}`,
                );
            }
            throw error;
        }
    }

    /**
     * Get the history manager for this provider
     */
    getProviderName(): 'gemini' {
        return 'gemini';
    }

    /**
     * Map agnostic message format to Gemini-specific Content format
     * 
     * Key differences from OpenAI:
     * - Gemini uses 'model' role instead of 'assistant'
     * - Tool results are sent as 'user' messages with functionResponse
     */
    private mapToGeminiMessage(msg: LLMMessage): Content {
        if (msg.role === 'user') {
            return { role: 'user', parts: [{ text: msg.content || '' }] };
        }

        if (msg.role === 'assistant') {
            // Assistant with tool calls
            if (msg.toolCalls && msg.toolCalls.length > 0) {
                return {
                    role: 'model',
                    parts: msg.toolCalls.map((tc) => ({
                        functionCall: {
                            name: tc.name,
                            args: tc.args,
                        },
                    })),
                };
            }
            // Normal text response
            return { role: 'model', parts: [{ text: msg.content || '' }] };
        }

        if (msg.role === 'tool') {
            // GEMINI QUIRK: Tool results are sent as USER messages
            return {
                role: 'user',
                parts: [
                    {
                        functionResponse: {
                            name: msg.toolResult?.callId || 'unknown_tool',
                            response: { result: msg.toolResult?.result },
                        },
                    },
                ],
            };
        }

        // Fallback
        return { role: 'user', parts: [{ text: msg.content || '' }] };
    }
}
