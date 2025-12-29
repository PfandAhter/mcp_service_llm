// src/modules/chat/services/session-cache.service.ts
// In-memory session cache for chat history management

import { Injectable, Logger } from '@nestjs/common';
import { SESSION_CACHE_CONFIG } from 'src/constants/llm.constants';

/**
 * Cached session data
 */
export interface CachedSession {
    sessionId: string;
    /** Provider-native history format */
    nativeHistory: any[];
    /** Provider name for history manager selection */
    provider: 'gemini' | 'openai' | 'anthropic';
    createdAt: Date;
    lastActivityAt: Date;
    /** Custom metadata */
    metadata?: Record<string, any>;
}

/**
 * SessionCacheService
 * 
 * In-memory cache for session management.
 * Stores chat history and session data per sessionId.
 * 
 * Future: Can be replaced with Redis/Database implementation
 * by implementing the same interface.
 */
@Injectable()
export class SessionCacheService {
    private readonly logger = new Logger(SessionCacheService.name);

    // In-memory session store
    private sessions = new Map<string, CachedSession>();

    // Cleanup interval (every 5 minutes)
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Start periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);
    }

    /**
     * Get or create a session
     */
    getOrCreateSession(sessionId: string, provider: 'gemini' | 'openai' | 'anthropic' = 'gemini'): CachedSession {
        let session = this.sessions.get(sessionId);

        if (!session) {
            session = {
                sessionId,
                nativeHistory: [],
                provider,
                createdAt: new Date(),
                lastActivityAt: new Date(),
            };
            this.sessions.set(sessionId, session);
            this.logger.log(`Created new session: ${sessionId}`);
        } else {
            // Update last activity
            session.lastActivityAt = new Date();
        }

        return session;
    }

    /**
     * Get session by ID (returns null if not found)
     */
    getSession(sessionId: string): CachedSession | null {
        const session = this.sessions.get(sessionId);

        if (session) {
            // Check if expired
            const age = Date.now() - session.lastActivityAt.getTime();
            if (age > SESSION_CACHE_CONFIG.TTL_MS) {
                this.deleteSession(sessionId);
                return null;
            }
            session.lastActivityAt = new Date();
        }

        return session || null;
    }

    /**
     * Update session history
     */
    updateHistory(sessionId: string, nativeHistory: any[]): void {
        const session = this.sessions.get(sessionId);

        if (session) {
            // Trim history if too long
            if (nativeHistory.length > SESSION_CACHE_CONFIG.MAX_HISTORY_LENGTH) {
                nativeHistory = nativeHistory.slice(-SESSION_CACHE_CONFIG.MAX_HISTORY_LENGTH);
            }

            session.nativeHistory = nativeHistory;
            session.lastActivityAt = new Date();
            this.logger.debug(`Updated history for session ${sessionId}: ${nativeHistory.length} messages`);
        }
    }

    /**
     * Delete a session
     */
    deleteSession(sessionId: string): boolean {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            this.logger.log(`Deleted session: ${sessionId}`);
        }
        return deleted;
    }

    /**
     * Clear all sessions
     */
    clearAllSessions(): void {
        const count = this.sessions.size;
        this.sessions.clear();
        this.logger.log(`Cleared all ${count} sessions`);
    }

    /**
     * Get session count
     */
    getSessionCount(): number {
        return this.sessions.size;
    }

    /**
     * Cleanup expired sessions
     */
    private cleanupExpiredSessions(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            const age = now - session.lastActivityAt.getTime();
            if (age > SESSION_CACHE_CONFIG.TTL_MS) {
                this.sessions.delete(sessionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.logger.log(`Cleaned up ${cleaned} expired session(s)`);
        }
    }

    /**
     * Cleanup on module destroy
     */
    onModuleDestroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
