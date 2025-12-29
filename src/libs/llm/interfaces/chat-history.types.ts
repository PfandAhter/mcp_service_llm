// src/libs/llm/interfaces/chat-history.types.ts
// Provider-aware chat history management types

import { LLMMessage, ToolCall, ToolExecutionResult } from './llm.types';

/**
 * Raw content from provider response
 * Used to preserve provider-specific format for history
 */
export interface RawProviderContent {
    provider: 'gemini' | 'openai' | 'anthropic';
    content: any; // Raw content from provider response
}

/**
 * ChatHistoryManager Interface
 * 
 * Defines provider-aware methods for building chat history.
 * Each provider implements this differently based on their API requirements.
 * 
 * Key differences:
 * - Gemini: Tool results are sent as 'user' role with functionResponse part
 * - OpenAI: Tool results are sent as 'tool' role with tool_call_id
 * - Anthropic: Similar to OpenAI but with different structure
 */
export interface IChatHistoryManager {
    /**
     * Add a user message to history
     */
    addUserMessage(history: any[], content: string): any[];

    /**
     * Add an assistant/model message to history
     * For text responses
     */
    addAssistantMessage(history: any[], content: string): any[];

    /**
     * Add an assistant message with tool calls to history
     * Called when the model requests to use tools
     */
    addAssistantToolCalls(history: any[], toolCalls: ToolCall[], rawResponse?: any): any[];

    /**
     * Add tool execution results to history
     * This is where providers differ significantly!
     */
    addToolResults(
        history: any[],
        toolCall: ToolCall,
        result: ToolExecutionResult,
    ): any[];

    /**
     * Convert agnostic LLMMessage[] to provider-specific format
     * Used when starting from agnostic history
     */
    toProviderFormat(messages: LLMMessage[]): any[];

    /**
     * Convert provider-specific format back to agnostic LLMMessage[]
     * Used for storage/cross-provider compatibility
     */
    toAgnosticFormat(providerHistory: any[]): LLMMessage[];
}
