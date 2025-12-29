// src/modules/chat/chat.module.ts
// Simplified chat module

import { Module } from '@nestjs/common';
import { LLMModule } from '../llm/llm.module';
import { MicroservicesModule } from '../shared/microservices.module';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { ChatService } from './services/chat.service';
import { SessionCacheService } from './services/session-cache.service';

/**
 * ChatModule
 * 
 * Simplified chat functionality:
 * - ChatService: Core logic with constants + session cache
 * - SessionCacheService: In-memory session/history storage
 * - ChatController: HTTP endpoints
 * - ChatGateway: WebSocket real-time chat
 */
@Module({
    imports: [LLMModule, MicroservicesModule],
    controllers: [ChatController],
    providers: [
        ChatService,
        SessionCacheService,
        ChatGateway,
    ],
    exports: [ChatService, SessionCacheService],
})
export class ChatModule { }
