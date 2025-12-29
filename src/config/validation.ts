// src/config/validation.ts
// Environment validation schema using class-validator

import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

enum Environment {
    Development = 'development',
    Production = 'production',
    Test = 'test',
}

class EnvironmentVariables {
    @IsNumber()
    @IsOptional()
    PORT?: number;

    @IsEnum(Environment)
    @IsOptional()
    NODE_ENV?: Environment;

    @IsString()
    GEMINI_API_KEY: string;

    @IsString()
    @IsOptional()
    OPENAI_API_KEY?: string;
}

export function validate(config: Record<string, unknown>) {
    const validatedConfig = plainToInstance(EnvironmentVariables, config, {
        enableImplicitConversion: true,
    });

    const errors = validateSync(validatedConfig, {
        skipMissingProperties: false,
    });

    if (errors.length > 0) {
        const errorMessages = errors.map((error) => {
            const constraints = Object.values(error.constraints || {}).join(', ');
            return `${error.property}: ${constraints}`;
        });

        throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
    }

    return validatedConfig;
}
