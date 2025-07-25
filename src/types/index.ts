import { z } from 'zod';
import { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

// Unified type for all OpenAPI document versions
export type OpenAPIDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document;

// Unified operation type
export interface ApiOperation {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses?: Record<string, ApiResponse>;
  security?: SecurityRequirement[];
  tags?: string[];
}

// Parameter types
export interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: any; // Will be converted to Zod schema
  example?: any;
}

// Request body type
export interface ApiRequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, ApiMediaType>;
}

// Media type
export interface ApiMediaType {
  schema?: any; // Will be converted to Zod schema
  example?: any;
  examples?: Record<string, any>;
}

// Response type
export interface ApiResponse {
  description: string;
  content?: Record<string, ApiMediaType>;
}

// Security requirement
export type SecurityRequirement = Record<string, string[]>;

// MCP Tool metadata
export interface McpToolMetadata {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape; // Object with Zod schemas as properties
  operation: ApiOperation;
}

// Authentication configuration
export interface AuthConfig {
  type: 'bearer' | 'apikey' | 'basic' | 'none';
  token?: string;
  header: string;
  apiKeyHeader?: string;
}

// Swagger parser result
export interface ParsedSwaggerDoc {
  version: '2.0' | '3.0' | '3.1';
  title: string;
  description?: string;
  baseUrl: string;
  operations: ApiOperation[];
  securitySchemes?: Record<string, any>;
}