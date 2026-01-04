// src/constants/llm.constants.ts
// Hardcoded LLM configuration constants

import { LLMConfiguration, ToolDefinition } from 'src/libs/llm/interfaces/llm.types';
export { SYSTEM_PROMPT as DEFAULT_SYSTEM_PROMPT } from 'src/modules/chat/constant/systemprompt';
export { BUILT_IN_TOOLS } from './tools'
/**
 * Default System Prompt
 * Modify this for your use case
 */

/**
 * Default LLM Configuration
 * Change provider and model as needed
 */
export const DEFAULT_LLM_CONFIG: LLMConfiguration = {
    provider: 'gemini',
    model: 'gemini-2.5-pro',  // Changed to 2.5-pro for better tool calling support
    parameters: {
        temperature: 0.7,  // Reduced for more consistent tool calling
        maxTokens: 8192,
        topP: 0.95,
    },
    tools: [], // Tools are registered via ToolHandlerService
};

/**
 * Built-in Tool Definitions
 * Add your custom tools here
 */


/**
 * Session Cache Configuration
 */
export const SESSION_CACHE_CONFIG = {
    /** Time to live for cached sessions in milliseconds (30 minutes) */
    TTL_MS: 30 * 60 * 1000 * 5,

    /** Maximum number of messages to keep in history per session */
    MAX_HISTORY_LENGTH: 100,
};
