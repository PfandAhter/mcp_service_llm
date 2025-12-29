// src/libs/llm/history/gemini-history.manager.ts
// Gemini-specific chat history management

import { IChatHistoryManager } from '../interfaces/chat-history.types';
import { LLMMessage, ToolCall, ToolExecutionResult } from '../interfaces/llm.types';

/**
 * GeminiHistoryManager
 * 
 * Manages chat history according to Gemini API requirements.
 * 
 * Key Gemini patterns (from official docs):
 * 1. User messages: { role: 'user', parts: [{ text: '...' }] }
 * 2. Model messages: { role: 'model', parts: [{ text: '...' }] }
 * 3. Model tool calls: { role: 'model', parts: [{ functionCall: { name, args } }] }
 * 4. Tool results: { role: 'user', parts: [{ functionResponse: { name, response } }] }
 * 
 * CRITICAL: In Gemini, tool results are sent as USER messages with functionResponse!
 * This is different from OpenAI which uses a 'tool' role.
 */
export class GeminiHistoryManager implements IChatHistoryManager {

    /**
     * Add a user message
     */
    addUserMessage(history: any[], content: string): any[] {
        return [
            ...history,
            {
                role: 'user',
                parts: [{ text: content }],
            },
        ];
    }

    /**
     * Add an assistant/model text message
     */
    addAssistantMessage(history: any[], content: string): any[] {
        return [
            ...history,
            {
                role: 'model',
                parts: [{ text: content }],
            },
        ];
    }

    /**
     * Add model's tool call request to history
     * 
     * Following Gemini docs pattern:
     * contents.push(response.candidates[0].content);
     * 
     * We push the raw model response content (with functionCall parts)
     */
    addAssistantToolCalls(history: any[], toolCalls: ToolCall[], rawResponse?: any): any[] {
        // If raw response is provided, use it directly (preserves exact format)
        if (rawResponse?.candidates?.[0]?.content) {
            return [...history, rawResponse.candidates[0].content];
        }

        // Otherwise, construct from toolCalls
        return [
            ...history,
            {
                role: 'model',
                parts: toolCalls.map((tc) => ({
                    functionCall: {
                        name: tc.name,
                        args: tc.args,
                    },
                })),
            },
        ];
    }

    /**
     * Add tool execution result to history
     * 
     * CRITICAL GEMINI PATTERN (from official docs):
     * ```
     * const function_response_part = {
     *   name: tool_call.name,
     *   response: { result }
     * };
     * contents.push({ role: 'user', parts: [{ functionResponse: function_response_part }] });
     * ```
     * 
     * Note: Tool results are sent as USER role in Gemini!
     */
    addToolResults(
        history: any[],
        toolCall: ToolCall,
        result: ToolExecutionResult,
    ): any[] {
        return [
            ...history,
            {
                role: 'user',
                parts: [
                    {
                        functionResponse: {
                            name: toolCall.name,
                            response: {
                                result: result.data ?? { success: result.success, message: result.message },
                            },
                        },
                    },
                ],
            },
        ];
    }

    /**
     * Convert agnostic messages to Gemini format
     */
    toProviderFormat(messages: LLMMessage[]): any[] {
        const result: any[] = [];

        for (const msg of messages) {
            if (msg.role === 'user') {
                result.push({
                    role: 'user',
                    parts: [{ text: msg.content || '' }],
                });
            } else if (msg.role === 'assistant') {
                if (msg.toolCalls && msg.toolCalls.length > 0) {
                    result.push({
                        role: 'model',
                        parts: msg.toolCalls.map((tc) => ({
                            functionCall: { name: tc.name, args: tc.args },
                        })),
                    });
                } else {
                    result.push({
                        role: 'model',
                        parts: [{ text: msg.content || '' }],
                    });
                }
            } else if (msg.role === 'tool') {
                // Tool results become user messages in Gemini
                result.push({
                    role: 'user',
                    parts: [
                        {
                            functionResponse: {
                                name: msg.toolResult?.callId || 'unknown',
                                response: { result: msg.toolResult?.result },
                            },
                        },
                    ],
                });
            }
        }

        return result;
    }

    /**
     * Convert Gemini format back to agnostic messages
     */
    toAgnosticFormat(providerHistory: any[]): LLMMessage[] {
        const result: LLMMessage[] = [];

        for (const entry of providerHistory) {
            const parts = entry.parts || [];

            // Check for functionCall (model requesting tool)
            const functionCallParts = parts.filter((p: any) => p.functionCall);
            if (functionCallParts.length > 0) {
                result.push({
                    role: 'assistant',
                    toolCalls: functionCallParts.map((p: any) => ({
                        id: p.functionCall.name,
                        name: p.functionCall.name,
                        args: p.functionCall.args || {},
                    })),
                });
                continue;
            }

            // Check for functionResponse (tool result)
            const functionResponseParts = parts.filter((p: any) => p.functionResponse);
            if (functionResponseParts.length > 0) {
                for (const p of functionResponseParts) {
                    result.push({
                        role: 'tool',
                        toolResult: {
                            callId: p.functionResponse.name,
                            result: p.functionResponse.response?.result,
                        },
                    });
                }
                continue;
            }

            // Regular text message
            const textParts = parts.filter((p: any) => p.text);
            if (textParts.length > 0) {
                const role = entry.role === 'model' ? 'assistant' : 'user';
                result.push({
                    role: role as any,
                    content: textParts.map((p: any) => p.text).join(''),
                });
            }
        }

        return result;
    }
}
