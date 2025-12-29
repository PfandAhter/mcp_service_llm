// src/modules/chat/services/chat.service.ts
// Core chat service that ties everything together

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SessionCacheService, CachedSession } from './session-cache.service';
import { LLMFactoryService } from 'src/modules/llm/services/llm-factory.service';
import { ToolHandlerService } from 'src/modules/llm/services/tool-handler.service';
import { MicroserviceClientService } from 'src/modules/shared/microservice-client.service';
import { getHistoryManager } from 'src/libs/llm/history';
import { LLMResponse, ToolExecutionResult } from 'src/libs/llm/interfaces/llm.types';
import {
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_LLM_CONFIG,
    BUILT_IN_TOOLS,
} from 'src/constants/llm.constants';

/**
 * ChatService
 * 
 * Simplified chat service that uses:
 * - Hardcoded constants for LLM config, system prompt, tools
 * - SessionCacheService for history management
 * - Provider-aware history managers for correct tool handling
 * 
 * Usage:
 * const response = await chatService.processMessage('session-123', 'Hello!');
 */
@Injectable()
export class ChatService implements OnModuleInit {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        private readonly sessionCache: SessionCacheService,
        private readonly llmFactory: LLMFactoryService,
        private readonly toolHandler: ToolHandlerService,
        private readonly microserviceClient: MicroserviceClientService,
    ) { }

    /**
     * Register built-in tools on module init
     */
    onModuleInit() {
        this.registerBuiltInTools();
    }

    /**
     * Register the built-in tools from constants
     */

    /**
     * Register the built-in tools from constants
     */
    private registerBuiltInTools() {
        // Register bank_name_list (uses ATM service get-statuses endpoint)
        this.toolHandler.registerTool(
            BUILT_IN_TOOLS.find(t => t.name === 'bank_name_list')!,
            async (toolCall, context) => {
                try {
                    const data = await this.microserviceClient.sendGetRequest(
                        'atmService',
                        '/atm/get-statuses',
                        {},
                        { id: context.userId || 'anonymous', email: context.metadata?.email || '' }
                    );
                    return {
                        success: true,
                        message: 'ATM statuses and bank list retrieved successfully',
                        data,
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: `Failed to retrieve ATM statuses: ${error.message}`,
                    };
                }
            },
        );

        // Register generate_qr_for_route_to_an_atm (uses /atm/route endpoint)
        this.toolHandler.registerTool(
            BUILT_IN_TOOLS.find(t => t.name === 'generate_qr_for_route_to_an_atm')!,
            async (toolCall, context) => {
                try {
                    // Build request body matching GenerateRouteToATMRequest
                    const requestBody = {
                        userId: context.userId || 'anonymous',
                        userEmail: context.metadata?.email || '',
                        selectedAtmId: toolCall.args.selectedAtmId,
                        bankName: toolCall.args.bankName,
                        selectedAtmLatitude: toolCall.args.selectedAtmLatitude,
                        selectedAtmLongitude: toolCall.args.selectedAtmLongitude,
                        userLatitude: toolCall.args.userLatitude,
                        userLongitude: toolCall.args.userLongitude,
                    };

                    const data = await this.microserviceClient.sendPostRequest(
                        'atmService',
                        '/atm/route',
                        requestBody,
                        { id: context.userId || 'anonymous', email: context.metadata?.email || '' }
                    );
                    return {
                        success: true,
                        message: 'Route to ATM generated',
                        data,
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: `Failed to generate route: ${error.message}`,
                    };
                }
            },
        );

        // Register get_nearest_atm (uses /atm/nearest endpoint)
        this.toolHandler.registerTool(
            BUILT_IN_TOOLS.find(t => t.name === 'get_nearest_atm')!,
            async (toolCall, context) => {
                try {
                    const data = await this.microserviceClient.sendPostRequest(
                        'atmService',
                        '/atm/nearest',
                        toolCall.args,
                        { id: context.userId || 'anonymous', email: context.metadata?.email || '' }
                    );
                    return {
                        success: true,
                        message: 'Nearby ATMs retrieved successfully',
                        data,
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: `Failed to retrieve ATMs: ${error.message}`,
                    };
                }
            },
        );

        // Register transaction_list
        this.toolHandler.registerTool(
            BUILT_IN_TOOLS.find(t => t.name === 'transaction_list')!,
            async (toolCall, context) => {
                try {
                    const { accountId, size, type, dateRange } = toolCall.args;
                    const data = await this.microserviceClient.sendPostRequest(
                        'transactionService',
                        '/transaction/transactionsv2',
                        {
                            accountId,
                            page: 0,
                            size: size || 5,
                            type: type || 'ALL',
                            dateRange: dateRange || 'MONTH'
                        },
                        { id: context.userId || 'anonymous', email: context.metadata?.email || '' }
                    );

                    // DEBUG: Log the raw response structure from transaction-service
                    this.logger.log('=== TRANSACTION_LIST RAW RESPONSE ===');
                    this.logger.log(JSON.stringify(data, null, 2));
                    this.logger.log('=== END TRANSACTION_LIST RESPONSE ===');

                    return {
                        success: true,
                        message: 'Transactions retrieved successfully',
                        data,
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: `Failed to retrieve transactions: ${error.message}`,
                    };
                }
            },
        );

        // Register transfer_money
        this.toolHandler.registerTool(
            BUILT_IN_TOOLS.find(t => t.name === 'transfer_money')!,
            async (toolCall, context) => {
                const isConfirmed = toolCall.args.isConfirmed ?? false;

                try {
                    const data = await this.microserviceClient.sendPostRequest(
                        'transactionService',
                        '/transaction/transfer',
                        { ...toolCall.args, isConfirmed },
                        { id: context.userId || 'anonymous', email: context.metadata?.email || '' }
                    );

                    // Check if response indicates a business logic error (status !== "1")
                    const responseData = data as any;
                    if (responseData && responseData.status && responseData.status !== '1') {
                        return {
                            success: false,
                            message: responseData.processMessage || 'Transfer failed',
                            data: {
                                status: responseData.status,
                                processCode: responseData.processCode,
                                processMessage: responseData.processMessage,
                            },
                        };
                    }

                    return {
                        success: true,
                        message: isConfirmed ? 'Transfer completed' : 'Transfer preview generated',
                        data,
                    };
                } catch (error) {
                    // Try to extract BaseResponse from HttpException (NestJS wraps the error)
                    // HttpException.getResponse() returns the original error data
                    let errorData: any = null;

                    if (error.getResponse && typeof error.getResponse === 'function') {
                        // NestJS HttpException - use getResponse()
                        errorData = error.getResponse();
                    } else if (error.response?.data) {
                        // Axios error - use response.data
                        errorData = error.response.data;
                    }

                    if (errorData && errorData.processMessage) {
                        return {
                            success: false,
                            message: errorData.processMessage,
                            data: {
                                status: errorData.status || 'FAILED',
                                processCode: errorData.processCode || 'UNKNOWN',
                                processMessage: errorData.processMessage,
                            },
                        };
                    }

                    return {
                        success: false,
                        message: `Transfer failed: ${error.message}`,
                    };
                }
            },
        );

        // Register get_saved_accounts_for_transfer
        this.toolHandler.registerTool(
            BUILT_IN_TOOLS.find(t => t.name === 'get_saved_accounts_for_transfer')!,
            async (toolCall, context) => {
                try {
                    const data = await this.microserviceClient.sendPostRequest(
                        'accountService',
                        '/user/saved-accounts/get', // Assuming same endpoint for list
                        toolCall.args,
                        { id: context.userId || 'anonymous', email: context.metadata?.email || '' }
                    );
                    return {
                        success: true,
                        message: 'Saved accounts retrieved for transfer',
                        data,
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: `Failed to retrieve saved accounts: ${error.message}`,
                    };
                }
            },
        );

        // Register get_saved_accounts
        this.toolHandler.registerTool(
            BUILT_IN_TOOLS.find(t => t.name === 'get_saved_accounts')!,
            async (toolCall, context) => {
                try {
                    const data = await this.microserviceClient.sendPostRequest(
                        'accountService',
                        '/user/saved-accounts/get',
                        toolCall.args,
                        { id: context.userId || 'anonymous', email: context.metadata?.email || '' }
                    );
                    return {
                        success: true,
                        message: 'Saved accounts retrieved',
                        data,
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: `Failed to retrieve saved accounts: ${error.message}`,
                    };
                }
            },
        );

        // Register get_user_accounts
        this.toolHandler.registerTool(
            BUILT_IN_TOOLS.find(t => t.name === 'get_user_accounts')!,
            async (toolCall, context) => {
                try {
                    const data = await this.microserviceClient.sendPostRequest(
                        'accountService',
                        '/account/getv2',
                        {},
                        { id: context.userId || 'anonymous', email: context.metadata?.email || '' }
                    );
                    return {
                        success: true,
                        message: 'User accounts retrieved successfully',
                        data,
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: `Failed to retrieve user accounts: ${error.message}`,
                    };
                }
            },
        );

        // Register get_account_detail
        this.toolHandler.registerTool(
            BUILT_IN_TOOLS.find(t => t.name === 'get_account_detail')!,
            async (toolCall, context) => {
                try {
                    const data = await this.microserviceClient.sendPostRequest(
                        'accountService',
                        `/accounts/${toolCall.args.accountId}`,
                        {},
                        { id: context.userId || 'anonymous', email: context.metadata?.email || '' }
                    );
                    return {
                        success: true,
                        message: 'Account details retrieved successfully',
                        data,
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: `Failed to retrieve account detail: ${error.message}`,
                    };
                }
            },
        );

        // Register analyze_transactions
        this.toolHandler.registerTool(
            BUILT_IN_TOOLS.find(t => t.name === 'analyze_transactions')!,
            async (toolCall, context) => {
                try {
                    const data = await this.microserviceClient.sendPostRequest(
                        'analysisService',
                        '/analysis/transactions',
                        { analyzeRange: toolCall.args.analyzeRange },
                        { id: context.userId || 'anonymous', email: context.metadata?.email || '' }
                    );
                    return {
                        success: true,
                        message: 'Transaction analysis request submitted successfully. The estimated completion date is included in the response.',
                        data,
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: `Failed to submit transaction analysis request: ${error.message}`,
                    };
                }
            },
        );

        this.logger.log(`Registered ${BUILT_IN_TOOLS.length} built-in tools`);
    }

    /**
     * Process a chat message
     * 
     * @param sessionId - Session identifier
     * @param message - User's message
     * @param userContext - Optional user context (id, email)
     * @returns LLM response
     */
    async processMessage(sessionId: string, message: string, userContext?: { userId?: string; email?: string }): Promise<LLMResponse> {
        this.logger.log(`Processing message for session ${sessionId}`);

        // Get or create session
        const session = this.sessionCache.getOrCreateSession(sessionId, DEFAULT_LLM_CONFIG.provider);


        // Get provider and history manager
        const provider = this.llmFactory.getProvider(DEFAULT_LLM_CONFIG);
        const historyManager = getHistoryManager(session.provider);

        // Get current history and add user message
        let nativeHistory = [...session.nativeHistory];
        nativeHistory = historyManager.addUserMessage(nativeHistory, message);

        // Get all tools
        const allTools = this.toolHandler.getRegisteredTools();

        // Debug: Log tool count and names
        this.logger.debug(`[TOOLS] Passing ${allTools.length} tools to Gemini: ${allTools.map(t => t.name).join(', ')}`);

        // Run LLM loop
        const response = await this.runLLMLoop(
            provider,
            historyManager,
            nativeHistory,
            allTools,
            session,
            userContext,
        );

        // Save updated history
        this.sessionCache.updateHistory(sessionId, nativeHistory);

        // Log native history in provider's format
        this.logger.debug(`--- Session ${sessionId} Native History (${session.provider}) ---`);
        this.logger.debug(JSON.stringify(nativeHistory, null, 2));
        this.logger.debug(`--- End of History ---`);

        // Debug: Log the response being returned
        this.logger.debug(`[RETURN] Response text: ${response.text?.substring(0, 100)}...`);
        this.logger.debug(`[RETURN] Response toolCalls: ${response.toolCalls?.length || 0}`);

        return {
            ...response,
            // Find the last tool result using agnostic format
            lastToolResult: (() => {
                const recentHistory = nativeHistory.slice(-10); // Check last 10 messages
                const agnostic = historyManager.toAgnosticFormat(recentHistory);

                // Find the last tool message (Note: toAgnosticFormat returns chronological order)
                // We reverse to find the most recent one
                const lastToolMsg = [...agnostic].reverse().find(m => m.role === 'tool');

                if (lastToolMsg && lastToolMsg.toolResult) {
                    return {
                        functionName: lastToolMsg.toolResult.callId,
                        data: lastToolMsg.toolResult.result
                    };
                }
                return null;
            })()
        };
    }

    /**
     * Recursive LLM loop with tool handling
     */
    private async runLLMLoop(
        provider: any,
        historyManager: any,
        nativeHistory: any[],
        tools: any[],
        session: CachedSession,
        userContext?: { userId?: string; email?: string },
        depth: number = 0,
    ): Promise<LLMResponse> {
        const MAX_DEPTH = 128;
        if (depth >= MAX_DEPTH) {
            return {
                text: 'Too many tool calls. Please try again.',
                toolCalls: [],
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            };
        }

        // Call LLM
        const response = await provider.generateWithNativeHistory(
            nativeHistory,
            DEFAULT_SYSTEM_PROMPT,
            tools,
        );

        // If no tool calls, add assistant response to history and return
        if (!response.toolCalls || response.toolCalls.length === 0) {
            if (response.text) {
                nativeHistory.push(...historyManager.addAssistantMessage([], response.text).slice(-1));
            }
            // Update session history
            this.sessionCache.updateHistory(session.sessionId, nativeHistory);
            return response;
        }

        // Handle tool calls
        this.logger.log(`Tool calls: ${response.toolCalls.map(t => t.name).join(', ')}`);

        // Add model's tool call to history
        const afterToolCall = historyManager.addAssistantToolCalls(
            nativeHistory,
            response.toolCalls,
            response.rawResponse,
        );
        nativeHistory.length = 0;
        nativeHistory.push(...afterToolCall);

        // Execute each tool
        for (const toolCall of response.toolCalls) {
            const result = await this.toolHandler.executeTool(
                toolCall,
                {
                    sessionId: session.sessionId,
                    userId: userContext?.userId,
                    metadata: { email: userContext?.email }
                },
            );

            // Add tool result to history
            const afterResult = historyManager.addToolResults(nativeHistory, toolCall, result);
            nativeHistory.length = 0;
            nativeHistory.push(...afterResult);

            this.logger.log(`Tool ${toolCall.name}: ${result.success ? 'success' : 'failed'}`);
        }

        // Update session and recurse
        this.sessionCache.updateHistory(session.sessionId, nativeHistory);
        return this.runLLMLoop(provider, historyManager, nativeHistory, tools, session, userContext, depth + 1);
    }

    /**
     * Get session info
     */
    getSession(sessionId: string): CachedSession | null {
        return this.sessionCache.getSession(sessionId);
    }

    /**
     * Delete a session
     */
    deleteSession(sessionId: string): boolean {
        return this.sessionCache.deleteSession(sessionId);
    }
}
