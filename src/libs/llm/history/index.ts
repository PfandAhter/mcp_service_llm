// src/libs/llm/history/index.ts
// Chat history managers exports

export * from './gemini-history.manager';
export * from './openai-history.manager';

import { IChatHistoryManager } from '../interfaces/chat-history.types';
import { GeminiHistoryManager } from './gemini-history.manager';
import { OpenAIHistoryManager } from './openai-history.manager';

/**
 * Get the appropriate history manager for a provider
 */
export function getHistoryManager(provider: 'gemini' | 'openai' | 'anthropic'): IChatHistoryManager {
    switch (provider) {
        case 'gemini':
            return new GeminiHistoryManager();
        case 'openai':
            return new OpenAIHistoryManager();
        case 'anthropic':
            // Anthropic uses similar pattern to OpenAI, default to OpenAI for now
            return new OpenAIHistoryManager();
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}
