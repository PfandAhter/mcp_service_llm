// src/modules/chat/chat.gateway.ts
// Simplified WebSocket gateway for real-time chat

import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './services/chat.service';

/**
 * ChatGateway
 * 
 * Simplified WebSocket gateway for real-time chat.
 * Uses hardcoded constants and session cache.
 * 
 * Events:
 * - Client → Server: message { text: string }
 * - Server → Client: connected, ai_message, tool_executed, error
 * 
 * Connection:
 * Connect with sessionId in query: ws://localhost:3000/chat?sessionId=xxx
 */
@WebSocketGateway({
    namespace: 'chat',
    cors: {
        origin: '*',
        credentials: true,
    },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);

    constructor(private readonly chatService: ChatService) { }

    async handleConnection(@ConnectedSocket() client: Socket) {
        const sessionId = client.handshake.query.sessionId as string || `ws_${Date.now()}`;

        client.data.sessionId = sessionId;
        client.join(`session_${sessionId}`);

        client.emit('connected', {
            sessionId,
            clientId: client.id,
            timestamp: new Date().toISOString(),
        });

        this.logger.log(`Client ${client.id} connected with session ${sessionId}`);
    }

    async handleDisconnect(@ConnectedSocket() client: Socket) {
        this.logger.log(`Client ${client.id} disconnected`);
    }

    /**
     * Handle chat message
     * Simplified: just { text: string }
     */
    @SubscribeMessage('message')
    async handleMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { text: string },
    ) {
        const sessionId = client.data.sessionId;

        if (!payload?.text) {
            client.emit('error', { code: 'INVALID_PAYLOAD', message: 'text is required' });
            return;
        }

        this.logger.log(`Message from ${sessionId}: "${payload.text.substring(0, 50)}..."`);

        try {
            client.emit('message_received', {
                text: payload.text,
                timestamp: new Date().toISOString(),
            });

            const response = await this.chatService.processMessage(sessionId, payload.text);

            // Emit AI response
            if (response.text) {
                this.server.to(`session_${sessionId}`).emit('ai_message', {
                    text: response.text,
                    timestamp: new Date().toISOString(),
                });
            }

            // Emit tool execution info
            if (response.toolCalls?.length) {
                this.server.to(`session_${sessionId}`).emit('tools_used', {
                    tools: response.toolCalls.map(t => t.name),
                });
            }

        } catch (error: any) {
            this.logger.error(`Message error: ${error.message}`, error.stack);
            client.emit('error', {
                code: 'PROCESSING_ERROR',
                message: error.message,
            });
        }
    }

    /**
     * Clear session history
     */
    @SubscribeMessage('clear_history')
    handleClearHistory(@ConnectedSocket() client: Socket) {
        const sessionId = client.data.sessionId;
        this.chatService.deleteSession(sessionId);
        client.emit('history_cleared', { sessionId });
    }

    /**
     * End session
     */
    @SubscribeMessage('end_session')
    handleEndSession(@ConnectedSocket() client: Socket) {
        const sessionId = client.data.sessionId;
        this.chatService.deleteSession(sessionId);
        client.emit('session_ended', { sessionId });
        client.disconnect();
    }
}
