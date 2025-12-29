// src/libs/llm/history/openai-history.manager.ts
// OpenAI-specific chat history management

import { IChatHistoryManager } from '../interfaces/chat-history.types';
import { LLMMessage, ToolCall, ToolExecutionResult } from '../interfaces/llm.types';

/**
 * OpenAIHistoryManager
 * 
 * Manages chat history according to OpenAI API requirements.
 * 
 * Key OpenAI patterns:
 * 1. User messages: { role: 'user', content: '...' }
 * 2. Assistant messages: { role: 'assistant', content: '...' }
 * 3. Assistant tool calls: { role: 'assistant', content: null, tool_calls: [...] }
 * 4. Tool results: { role: 'tool', tool_call_id: '...', content: '...' }
 * 
 * CRITICAL: In OpenAI, tool results are sent with 'tool' role and require tool_call_id!
 */
export class OpenAIHistoryManager implements IChatHistoryManager {

    /**
     * Add a user message
     */
    addUserMessage(history: any[], content: string): any[] {
        return [
            ...history,
            {
                role: 'user',
                content,
            },
        ];
    }

    /**
     * Add an assistant text message
     */
    addAssistantMessage(history: any[], content: string): any[] {
        return [
            ...history,
            {
                role: 'assistant',
                content,
            },
        ];
    }

    /**
     * Add assistant's tool call request to history
     * 
     * OpenAI requires tool_calls array with specific structure
     */
    addAssistantToolCalls(history: any[], toolCalls: ToolCall[], rawResponse?: any): any[] {
        return [
            ...history,
            {
                role: 'assistant',
                content: null,
                tool_calls: toolCalls.map((tc) => ({
                    id: tc.id,
                    type: 'function',
                    function: {
                        name: tc.name,
                        arguments: JSON.stringify(tc.args),
                    },
                })),
            },
        ];
    }

    /**
     * Add tool execution result to history
     * 
     * OpenAI pattern:
     * { role: 'tool', tool_call_id: '...', content: JSON.stringify(result) }
     */
    addToolResults(
        history: any[],
        toolCall: ToolCall,
        result: ToolExecutionResult,
    ): any[] {
        return [
            ...history,
            {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result.data ?? { success: result.success, message: result.message }),
            },
        ];
    }

    /**
     * Convert agnostic messages to OpenAI format
     */
    toProviderFormat(messages: LLMMessage[]): any[] {
        const result: any[] = [];

        for (const msg of messages) {
            if (msg.role === 'user') {
                result.push({
                    role: 'user',
                    content: msg.content || '',
                });
            } else if (msg.role === 'assistant') {
                if (msg.toolCalls && msg.toolCalls.length > 0) {
                    result.push({
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
                    });
                } else {
                    result.push({
                        role: 'assistant',
                        content: msg.content || '',
                    });
                }
            } else if (msg.role === 'tool') {
                result.push({
                    role: 'tool',
                    tool_call_id: msg.toolResult?.callId,
                    content: JSON.stringify(msg.toolResult?.result),
                });
            }
        }

        return result;
    }

    /**
     * Convert OpenAI format back to agnostic messages
     */
    toAgnosticFormat(providerHistory: any[]): LLMMessage[] {
        const result: LLMMessage[] = [];

        for (const entry of providerHistory) {
            if (entry.role === 'user') {
                result.push({
                    role: 'user',
                    content: entry.content,
                });
            } else if (entry.role === 'assistant') {
                if (entry.tool_calls && entry.tool_calls.length > 0) {
                    result.push({
                        role: 'assistant',
                        toolCalls: entry.tool_calls.map((tc: any) => ({
                            id: tc.id,
                            name: tc.function.name,
                            args: JSON.parse(tc.function.arguments || '{}'),
                        })),
                    });
                } else {
                    result.push({
                        role: 'assistant',
                        content: entry.content,
                    });
                }
            } else if (entry.role === 'tool') {
                result.push({
                    role: 'tool',
                    toolResult: {
                        callId: entry.tool_call_id,
                        result: JSON.parse(entry.content || '{}'),
                    },
                });
            }
        }

        return result;
    }
}
