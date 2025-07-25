import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Define configuration schema
const configSchema = z.object({
  swagger: z.object({
    url: z.string().url().optional(),
    path: z.string().optional(),
  }).refine(data => data.url || data.path, {
    message: "Either SWAGGER_URL or SWAGGER_PATH must be provided"
  }),
  
  api: z.object({
    baseUrl: z.string().url().optional(),
    timeout: z.number().positive().default(30000),
  }),
  
  auth: z.object({
    type: z.enum(['bearer', 'apikey', 'basic', 'none']).default('none'),
    token: z.string().optional(),
    header: z.string().default('Authorization'),
    apiKeyHeader: z.string().default('X-API-Key'),
  }),
  
  options: z.object({
    refreshInterval: z.number().positive().default(3600000), // 1 hour
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    enableRequestLogging: z.boolean().default(false),
  }),
});

export type Config = z.infer<typeof configSchema>;

// Parse and validate configuration
export function loadConfig(): Config {
  const rawConfig = {
    swagger: {
      url: process.env.SWAGGER_URL,
      path: process.env.SWAGGER_PATH,
    },
    api: {
      baseUrl: process.env.API_BASE_URL,
      timeout: process.env.API_TIMEOUT ? parseInt(process.env.API_TIMEOUT, 10) : undefined,
    },
    auth: {
      type: process.env.AUTH_TYPE as any,
      token: process.env.AUTH_TOKEN,
      header: process.env.AUTH_HEADER,
      apiKeyHeader: process.env.API_KEY_HEADER,
    },
    options: {
      refreshInterval: process.env.REFRESH_INTERVAL ? parseInt(process.env.REFRESH_INTERVAL, 10) : undefined,
      logLevel: process.env.LOG_LEVEL as any,
      enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true',
    },
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:', error.errors);
      throw new Error(`Invalid configuration: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

// Export singleton config instance
export const appConfig = loadConfig();