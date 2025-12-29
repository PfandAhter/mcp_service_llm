// src/modules/llm/llm.module.ts
// NestJS module for LLM services

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLMFactoryService } from './services/llm-factory.service';
import { ToolHandlerService } from './services/tool-handler.service';
import { OrchestratorService } from './services/orchestrator.service';

/**
 * LLMModule
 * 
 * NestJS module that bundles all LLM-related services.
 * Import this module to use LLM functionality in your application.
 * 
 * Provides:
 * - LLMFactoryService: Create LLM provider instances
 * - ToolHandlerService: Register and execute tools
 * - OrchestratorService: Manage conversation loops
 * 
 * Usage:
 * ```typescript
 * @Module({
 *   imports: [LLMModule],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
    imports: [ConfigModule],
    providers: [LLMFactoryService, ToolHandlerService, OrchestratorService],
    exports: [LLMFactoryService, ToolHandlerService, OrchestratorService],
})
export class LLMModule { }
