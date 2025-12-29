// src/config/configuration.ts
// Centralized application configuration

export interface AppConfig {
    port: number;
    environment: 'development' | 'production' | 'test';
}

export interface LLMApiConfig {
    gemini: {
        apiKey: string;
    };
    openai: {
        apiKey: string;
    };
}

export interface Configuration {
    app: AppConfig;
    llm: LLMApiConfig;
    services: Record<string, string>;
}

export default (): Configuration => ({
    app: {
        port: parseInt(process.env.PORT || '3000', 10),
        environment: (process.env.NODE_ENV as Configuration['app']['environment']) || 'development',
    },
    llm: {
        gemini: {
            apiKey: process.env.GEMINI_API_KEY || '',
        },
        openai: {
            apiKey: process.env.OPENAI_API_KEY || '',
        },
    },
    services: {
        atmService: process.env.ATM_SERVICE_URL || 'http://localhost:8085/api/v1',
        accountService: process.env.ACCOUNT_SERVICE_URL || 'http://localhost:8084/api/v1',
        transactionService: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:8083/api/v1',
        analysisService: process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8051/api/v1',
    },
});
