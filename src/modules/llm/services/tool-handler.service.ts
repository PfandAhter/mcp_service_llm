// src/modules/llm/services/tool-handler.service.ts
// Extensible tool handler with registry pattern

import { Injectable, Logger } from '@nestjs/common';
import { ToolCall, ToolExecutionResult, ToolDefinition, SessionContext } from 'src/libs/llm/interfaces/llm.types';

/**
 * Tool handler function type
 * Implement this signature to create custom tool handlers
 */
export type ToolHandler = (
    toolCall: ToolCall,
    context: SessionContext,
    emitEvent?: (event: string, data: any) => void,
) => Promise<ToolExecutionResult>;

/**
 * ToolHandlerService
 * 
 * Extensible tool handler with registry pattern.
 * Register your custom tools and their handlers dynamically.
 * 
 * Usage:
 * ```typescript
 * // Register a custom tool
 * this.toolHandler.registerTool(
 *   {
 *     name: 'get_weather',
 *     description: 'Get current weather for a location',
 *     parameters: {
 *       type: 'object',
 *       properties: {
 *         location: { type: 'string', description: 'City name' }
 *       },
 *       required: ['location']
 *     }
 *   },
 *   async (toolCall, context) => {
 *     const weather = await weatherApi.get(toolCall.args.location);
 *     return { success: true, message: 'Weather retrieved', data: weather };
 *   }
 * );
 * 
 * // Execute a tool
 * const result = await this.toolHandler.executeTool(toolCall, context);
 * ```
 */
@Injectable()
export class ToolHandlerService {
    private readonly logger = new Logger(ToolHandlerService.name);

    // Tool registry: name -> { definition, handler }
    private toolRegistry = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>();

    constructor() {
        // Register built-in example tool
        this.registerBuiltInTools();
    }

    /**
     * Register built-in example tools
     * Override or extend this method to add your own default tools
     */
    protected registerBuiltInTools() {
        // Example: Echo tool for testing
        this.registerTool(
            {
                name: 'echo',
                description: 'Echo back the input message. Useful for testing.',
                parameters: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', description: 'Message to echo back' },
                    },
                    required: ['message'],
                },
            },
            async (toolCall) => {
                return {
                    success: true,
                    message: `Echo: ${toolCall.args.message}`,
                    data: { echoed: toolCall.args.message },
                };
            },
        );
    }

    /**
     * Register a new tool with its handler
     * 
     * @param definition - Tool definition (name, description, parameters)
     * @param handler - Function to execute when tool is called
     */
    registerTool(definition: ToolDefinition, handler: ToolHandler): void {
        // Skip if tool is already registered to prevent duplicate registrations
        if (this.toolRegistry.has(definition.name)) {
            return;
        }

        this.toolRegistry.set(definition.name, { definition, handler });
        this.logger.log(`Registered tool: ${definition.name}`);
    }

    /**
     * Unregister a tool
     */
    unregisterTool(name: string): boolean {
        const deleted = this.toolRegistry.delete(name);
        if (deleted) {
            this.logger.log(`Unregistered tool: ${name}`);
        }
        return deleted;
    }

    /**
     * Get all registered tool definitions
     * Use this to pass available tools to the LLM
     */
    getRegisteredTools(): ToolDefinition[] {
        return Array.from(this.toolRegistry.values()).map((t) => t.definition);
    }

    /**
     * Check if a tool is registered
     */
    hasTool(name: string): boolean {
        return this.toolRegistry.has(name);
    }

    /**
     * Execute a tool call from the LLM
     * 
     * @param toolCall - The tool call from LLM response
     * @param context - Session context
     * @param emitEvent - Optional callback to emit events (e.g., WebSocket)
     * @returns Result of the tool execution
     */
    async executeTool(
        toolCall: ToolCall,
        context: SessionContext,
        emitEvent?: (event: string, data: any) => void,
    ): Promise<ToolExecutionResult> {
        this.logger.log(`Executing tool: ${toolCall.name}`);
        this.logger.debug(`Tool args: ${JSON.stringify(toolCall.args)}`);

        try {
            const registered = this.toolRegistry.get(toolCall.name);

            if (!registered) {
                const errorMsg = `Unknown tool: ${toolCall.name}. Available tools: ${this.getToolNames().join(', ')}`;
                this.logger.error(errorMsg);
                return {
                    success: false,
                    message: errorMsg,
                };
            }

            // Execute the handler
            const result = await registered.handler(toolCall, context, emitEvent);

            if (result.success) {
                this.logger.log(`Tool ${toolCall.name} executed successfully`);
            } else {
                this.logger.warn(`Tool ${toolCall.name} failed: ${result.message}`);
            }

            return result;
        } catch (error: any) {
            this.logger.error(`Tool execution error: ${error.message}`, error.stack);
            return {
                success: false,
                message: `Tool execution failed: ${error.message}`,
            };
        }
    }

    /**
     * Get list of registered tool names
     */
    private getToolNames(): string[] {
        return Array.from(this.toolRegistry.keys());
    }

    /**
     * Validate a tool call before execution
     */
    validateToolCall(toolCall: ToolCall): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!toolCall.name) {
            errors.push('Tool name is required');
        }

        if (!toolCall.args) {
            errors.push('Tool arguments are required');
        }

        if (toolCall.name && !this.hasTool(toolCall.name)) {
            errors.push(`Tool '${toolCall.name}' is not registered`);
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}
