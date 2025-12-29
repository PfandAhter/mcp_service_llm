// src/modules/llm/services/orchestrator.service.ts
// Core conversation orchestrator with provider-aware history management

import { Injectable, Logger } from '@nestjs/common';
import { LLMFactoryService } from './llm-factory.service';
import { ToolHandlerService } from './tool-handler.service';
import {
    LLMMessage,
    LLMResponse,
    LLMConfiguration,
    SessionContext,
    CachedSessionContext,
    ToolCall,
} from 'src/libs/llm/interfaces/llm.types';
import { BaseLLMProvider } from 'src/libs/llm/providers/base-llm.provider';
import { getHistoryManager, GeminiHistoryManager, OpenAIHistoryManager } from 'src/libs/llm/history';
import { IChatHistoryManager } from 'src/libs/llm/interfaces/chat-history.types';

/**
 * OrchestratorService
 * 
 * Core conversation orchestrator that manages the LLM conversation loop.
 * Now with PROVIDER-AWARE history management for correct tool call handling.
 * 
 * Key feature: Each provider (Gemini, OpenAI) has different requirements for 
 * how tool calls and results are represented in the message history.
 * - Gemini: Tool results go as 'user' role with functionResponse
 * - OpenAI: Tool results go as 'tool' role with tool_call_id
 * 
 * The orchestrator uses the appropriate history manager based on the provider.
 */
@Injectable()
export class OrchestratorService {
    private readonly logger = new Logger(OrchestratorService.name);

    // In-memory cache for session contexts
    private sessionCache = new Map<string, CachedSessionContext>();

    // Cache TTL (5 minutes)
    private readonly CACHE_TTL_MS = 5 * 60 * 1000;

    constructor(
        private readonly llmFactory: LLMFactoryService,
        private readonly toolHandler: ToolHandlerService,
    ) { }

    // ═══════════════════════════════════════════════════════════
    // MESSAGE PROCESSING (Provider-Aware)
    // ═══════════════════════════════════════════════════════════

    /**
     * Process a user message using provider-aware history management
     * 
     * This method correctly handles tool calls and results according to
     * each provider's API requirements.
     * 
     * @param sessionId - Session identifier
     * @param userMessage - User's message text
     * @param llmConfig - LLM configuration (provider, model, tools, etc.)
     * @param systemPrompt - System instruction for the LLM
     * @param context - Session context for tool execution
     * @param messageHistory - Previous messages in agnostic format
     * @param emitEvent - Optional callback to emit events
     * @returns LLM response
     */
    async processMessage(
        sessionId: string,
        userMessage: string,
        llmConfig: LLMConfiguration,
        systemPrompt: string,
        context: SessionContext,
        messageHistory: LLMMessage[] = [],
        emitEvent?: (event: string, data: any) => void,
    ): Promise<LLMResponse> {
        this.logger.log(`Processing message for session ${sessionId} using provider: ${llmConfig.provider}`);

        try {
            // Get LLM provider
            const provider = this.llmFactory.getProvider(llmConfig);

            // Get the appropriate history manager for this provider
            const historyManager = getHistoryManager(provider.getProviderName());

            // Convert agnostic history to provider-native format
            let nativeHistory = historyManager.toProviderFormat(messageHistory);

            // Add user message using provider-specific format
            nativeHistory = historyManager.addUserMessage(nativeHistory, userMessage);

            // Merge registered tools with config tools
            const allTools = [
                ...llmConfig.tools,
                ...this.toolHandler.getRegisteredTools(),
            ];

            // Deduplicate tools by name
            const uniqueTools = Array.from(
                new Map(allTools.map((t) => [t.name, t])).values()
            );

            // Run LLM loop with provider-native history
            const response = await this.runLLMLoopNative(
                provider,
                historyManager,
                systemPrompt,
                nativeHistory,
                uniqueTools,
                sessionId,
                context,
                emitEvent,
            );

            this.logger.log(
                `Message processed: ${response.usage.totalTokens} tokens, ${response.toolCalls.length} tools`,
            );

            return response;
        } catch (error: any) {
            this.logger.error(`Message processing failed: ${error.message}`, error.stack);
            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PROVIDER-AWARE LLM LOOP
    // ═══════════════════════════════════════════════════════════

    /**
     * Recursive LLM loop with provider-native history management
     * 
     * This correctly handles the history format for each provider:
     * - Gemini: Pushes raw model response, then user role with functionResponse
     * - OpenAI: Pushes assistant with tool_calls, then tool role with tool_call_id
     */
    private async runLLMLoopNative(
        provider: BaseLLMProvider,
        historyManager: IChatHistoryManager,
        systemPrompt: string,
        nativeHistory: any[],
        tools: any[],
        sessionId: string,
        context: SessionContext,
        emitEvent?: (event: string, data: any) => void,
        depth: number = 0,
    ): Promise<LLMResponse> {
        // Safety: Prevent infinite loops
        const MAX_DEPTH = 10;
        if (depth >= MAX_DEPTH) {
            this.logger.warn(`Max tool call depth (${MAX_DEPTH}) reached, returning`);
            return {
                text: 'I apologize, but I encountered too many tool calls. Please try again.',
                toolCalls: [],
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            };
        }

        this.logger.log(`LLM loop iteration ${depth + 1}`);

        // Call LLM with native history format
        const response = await provider.generateWithNativeHistory(
            nativeHistory,
            systemPrompt,
            tools,
        );

        // If no tool calls, return text response
        if (!response.toolCalls || response.toolCalls.length === 0) {
            this.logger.log('LLM returned text response (no tools)');

            // Emit text message event
            if (emitEvent && response.text) {
                emitEvent('ai_message', {
                    text: response.text,
                    timestamp: new Date(),
                });
            }

            return response;
        }

        // Handle tool calls with provider-aware history updates
        this.logger.log(
            `LLM requested ${response.toolCalls.length} tool(s): ${response.toolCalls.map((t) => t.name).join(', ')}`,
        );

        // Step 1: Add model's tool call request to history
        // For Gemini: uses raw response content
        // For OpenAI: formats as assistant message with tool_calls
        nativeHistory = historyManager.addAssistantToolCalls(
            nativeHistory,
            response.toolCalls,
            response.rawResponse,
        );

        // Step 2: Execute each tool and add results to history
        for (const toolCall of response.toolCalls) {
            // Execute tool
            const toolResult = await this.toolHandler.executeTool(
                toolCall,
                context,
                emitEvent,
            );

            // Add tool result using provider-specific format
            // For Gemini: { role: 'user', parts: [{ functionResponse: { name, response } }] }
            // For OpenAI: { role: 'tool', tool_call_id, content }
            nativeHistory = historyManager.addToolResults(
                nativeHistory,
                toolCall,
                toolResult,
            );

            // Emit tool execution event
            if (emitEvent) {
                emitEvent('tool_executed', {
                    toolName: toolCall.name,
                    success: toolResult.success,
                    message: toolResult.message,
                });
            }

            this.logger.log(
                `Tool ${toolCall.name}: ${toolResult.success ? 'success' : 'failed'}`,
            );
        }

        // Recursive call - let LLM respond to tool results
        return this.runLLMLoopNative(
            provider,
            historyManager,
            systemPrompt,
            nativeHistory,
            tools,
            sessionId,
            context,
            emitEvent,
            depth + 1,
        );
    }

    // ═══════════════════════════════════════════════════════════
    // LEGACY: Agnostic History (for backwards compatibility)
    // ═══════════════════════════════════════════════════════════

    /**
     * Process message with agnostic history format
     * @deprecated Use processMessage instead for correct provider-aware handling
     */
    async processMessageAgnostic(
        sessionId: string,
        userMessage: string,
        llmConfig: LLMConfiguration,
        systemPrompt: string,
        context: SessionContext,
        messageHistory: LLMMessage[] = [],
        emitEvent?: (event: string, data: any) => void,
    ): Promise<LLMResponse> {
        // Delegates to the main method which handles conversion
        return this.processMessage(
            sessionId,
            userMessage,
            llmConfig,
            systemPrompt,
            context,
            messageHistory,
            emitEvent,
        );
    }

    // ═══════════════════════════════════════════════════════════
    // CACHE MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    /**
     * Cache session context
     */
    cacheSession(
        sessionId: string,
        data: { context: SessionContext; llmConfig: LLMConfiguration; systemPrompt: string },
    ) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.CACHE_TTL_MS);

        this.sessionCache.set(sessionId, {
            context: data.context,
            llmConfig: data.llmConfig,
            systemPrompt: data.systemPrompt,
            cachedAt: now,
            expiresAt,
        });

        this.logger.log(`Session ${sessionId} cached until ${expiresAt.toISOString()}`);
    }

    /**
     * Get cached session (returns null if expired/not found)
     */
    getCachedSession(sessionId: string): CachedSessionContext | null {
        const cached = this.sessionCache.get(sessionId);

        if (!cached) return null;

        if (new Date() > cached.expiresAt) {
            this.sessionCache.delete(sessionId);
            return null;
        }

        return cached;
    }

    /**
     * Clear session cache
     */
    clearSessionCache(sessionId: string) {
        this.sessionCache.delete(sessionId);
    }

    /**
     * Clear all expired caches
     */
    clearExpiredCaches() {
        const now = new Date();
        let cleared = 0;

        for (const [sessionId, cached] of this.sessionCache.entries()) {
            if (now > cached.expiresAt) {
                this.sessionCache.delete(sessionId);
                cleared++;
            }
        }

        if (cleared > 0) {
            this.logger.log(`Cleared ${cleared} expired session cache(s)`);
        }
    }
}
