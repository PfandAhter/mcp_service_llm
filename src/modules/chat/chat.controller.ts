// src/modules/chat/chat.controller.ts
// Simplified HTTP REST endpoints for chat

import { Controller, Post, Body, Delete, Param, Get, Logger, HttpException, HttpStatus, Headers } from '@nestjs/common';
import { ChatService } from './services/chat.service';

/**
 * Simplified Chat request DTO
 * User only needs to send sessionId and message
 * userId and userEmail can be sent in body or headers
 */
interface ChatRequest {
    sessionId: string;
    message: string;
    userId?: string;
    userEmail?: string;
}

/**
 * ChatController
 * 
 * Simplified HTTP REST endpoints for chat.
 * All LLM configuration is loaded from constants.
 * History is managed automatically via session cache.
 * 
 * Endpoints:
 * - POST /chat/message - Send a message
 * - GET /chat/session/:sessionId - Get session info
 * - DELETE /chat/session/:sessionId - Delete session
 */
@Controller('chat')
export class ChatController {
    private readonly logger = new Logger(ChatController.name);

    constructor(private readonly chatService: ChatService) { }

    /**
     * Send a chat message
     * 
     * @example
     * POST /chat/message
     * { "sessionId": "user-123", "message": "Hello!" }
     */
    @Post('message')
    async sendMessage(@Body() body: ChatRequest, @Headers() headers: Record<string, string>) {
        if (!body.sessionId) {
            throw new HttpException('sessionId is required', HttpStatus.BAD_REQUEST);
        }

        if (!body.message) {
            throw new HttpException('message is required', HttpStatus.BAD_REQUEST);
        }

        this.logger.log(`Chat message for session ${body.sessionId}: "${body.message.substring(0, 50)}..."`);

        // Extract user context from body first, then headers (API Gateway propagation)
        const userId = body.userId || headers['X-User-Id'] || headers['x-user-id'];
        const email = body.userEmail || headers['X-User-Email'] || headers['x-user-email'];

        if (userId) {
            this.logger.debug(`Received request from user: ${userId} (${email || 'no email'})`);
        } else {
            this.logger.warn('No userId found in body or headers. Using anonymous context.');
        }

        try {
            const response = await this.chatService.processMessage(body.sessionId, body.message, {
                userId,
                email
            });

            return {
                success: true,
                sessionId: body.sessionId,
                message: {
                    role: 'assistant',
                    content: response.text,
                },
                pendingRequest: response.lastToolResult?.data ? {
                    function: response.lastToolResult.functionName, // Tool name (e.g., 'transfer_money')
                    arguments: response.lastToolResult.data, // Tool result (status, processCode, processMessage)
                    originalArgs: response.lastToolResult.originalArgs, // Original tool args (amount, fromIBAN, toIBAN, etc.)
                    options: response.lastToolResult // pass full result as options for now
                } : undefined,
                response: {
                    text: response.text,
                    toolCalls: response.toolCalls,
                },
                usage: response.usage,
            };
        } catch (error: any) {
            this.logger.error(`Chat error: ${error.message}`, error.stack);
            throw new HttpException(
                { success: false, error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get session information
     */
    @Get('session/:sessionId')
    async getSession(@Param('sessionId') sessionId: string) {
        const session = this.chatService.getSession(sessionId);

        if (!session) {
            throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
        }

        return {
            sessionId: session.sessionId,
            provider: session.provider,
            messageCount: session.nativeHistory.length,
            createdAt: session.createdAt,
            lastActivityAt: session.lastActivityAt,
        };
    }

    /**
     * Delete a session (clear history)
     */
    @Delete('session/:sessionId')
    async deleteSession(@Param('sessionId') sessionId: string) {
        const deleted = this.chatService.deleteSession(sessionId);

        return {
            success: deleted,
            message: deleted ? 'Session deleted' : 'Session not found',
        };
    }
}
