// src/libs/llm/interfaces/llm.types.ts
// Provider-agnostic type definitions for LLM interactions

/**
 * Message roles for LLM conversations
 * NOTE: 'system' role is excluded - system prompts are passed separately
 */
export type Role = 'user' | 'assistant' | 'tool';

/**
 * Agnostic message format for LLM conversations
 */
export interface LLMMessage {
    role: Role;
    content?: string;
    toolCalls?: ToolCall[];
    toolResult?: {
        callId: string;
        result: any;
    };
}

/**
 * Tool/Function definition for LLM function calling
 * Based on OpenAI format, mapped to provider-specific formats
 */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
}

/**
 * Tool call from LLM response
 */
export interface ToolCall {
    id: string;
    name: string;
    args: Record<string, any>;
}

/**
 * Provider-agnostic LLM configuration
 */
export interface LLMConfig {
    provider?: 'openai' | 'gemini' | 'anthropic';
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    systemPrompt?: string;
}

/**
 * Standardized LLM response format
 */
export interface LLMResponse {
    text: string | null;
    toolCalls: ToolCall[];
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    /**
     * Raw response from the provider
     * Used for proper history management (e.g., Gemini requires pushing raw content)
     */
    rawResponse?: any;
    lastToolResult?: any;
}

/**
 * Full LLM configuration including tools
 */
export interface LLMConfiguration {
    provider: 'openai' | 'gemini' | 'anthropic';
    model: string;
    parameters: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        topK?: number;
        stopSequences?: string[];
        presencePenalty?: number;
        frequencyPenalty?: number;
    };
    tools: ToolDefinition[];
    systemPromptConfig?: {
        format: 'simple' | 'structured';
        sections?: string[];
    };
}

/**
 * Result of tool execution
 */
export interface ToolExecutionResult {
    success: boolean;
    message: string;
    data?: any;
}

/**
 * Session context for orchestration (generic interface)
 * Implement this interface for your specific use case
 */
export interface SessionContext {
    sessionId: string;
    userId?: string;
    metadata?: Record<string, any>;
}

/**
 * Cached session context for in-memory storage
 */
export interface CachedSessionContext {
    context: SessionContext;
    llmConfig: LLMConfiguration;
    systemPrompt: string;
    cachedAt: Date;
    expiresAt: Date;
}
