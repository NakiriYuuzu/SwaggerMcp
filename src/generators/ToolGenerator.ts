import { z } from 'zod';
import { ApiOperation, McpToolMetadata, ApiParameter } from '../types';
import { SchemaConverter } from './SchemaConverter';
import { logger } from '../utils/logger';

export class ToolGenerator {
  private schemaConverter: SchemaConverter;
  private toolPrefix: string;

  constructor(definitions?: Record<string, any>, toolPrefix: string = '') {
    this.schemaConverter = new SchemaConverter(definitions);
    this.toolPrefix = toolPrefix;
  }

  // Generate MCP tool from OpenAPI operation
  generateTool(operation: ApiOperation): McpToolMetadata {
    const toolName = this.generateToolName(operation);
    const title = this.generateToolTitle(operation);
    const description = this.generateToolDescription(operation);
    const inputSchema = this.generateInputSchema(operation);

    logger.debug(`Generated tool: ${toolName}`);

    return {
      name: toolName,
      title,
      description,
      inputSchema,
      operation,
    };
  }

  private generateToolName(operation: ApiOperation): string {
    // Use operationId if available and well-formed
    if (operation.operationId && operation.operationId.includes('-')) {
      let name = operation.operationId.toLowerCase();

      // Add prefix if provided
      if (this.toolPrefix) {
        name = `${this.toolPrefix}-${name}`;
      }

      return name;
    }

    // Generate name in format: method-path-group-endpoint
    const method = operation.method.toLowerCase();

    // Parse path components
    const pathParts = operation.path
      .split('/')
      .filter(part => part.length > 0)
      .map(part => {
        // Handle path parameters: {id} -> id
        if (part.startsWith('{') && part.endsWith('}')) {
          return part.slice(1, -1);
        }
        return part;
      })
      .map(part => part.toLowerCase());

    // Build the tool name: method + all path parts
    const nameParts = [method, ...pathParts];

    // Join with hyphens and clean up
    let name = nameParts
      .join('-')
      .replace(/[^a-zA-Z0-9-]/g, '') // Remove invalid characters except hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    // Add prefix if provided
    if (this.toolPrefix) {
      name = `${this.toolPrefix}-${name}`;
    }

    return name;
  }

  private generateToolTitle(operation: ApiOperation): string {
    if (operation.summary) {
      return operation.summary;
    }

    // Generate title from method and path
    const method = operation.method;
    const path = operation.path
      .split('/')
      .filter(p => p.length > 0)
      .map(p => p.startsWith('{') ? p.slice(1, -1) : p)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');

    return `${method} ${path}`;
  }

  private generateToolDescription(operation: ApiOperation): string {
    let description = operation.description || operation.summary || '';

    if (!description) {
      description = `${operation.method} request to ${operation.path}`;
    }

    // Add parameter information
    if (operation.parameters && operation.parameters.length > 0) {
      const paramDescriptions = operation.parameters
        .map(p => `- ${p.name} (${p.in}${p.required ? ', required' : ''}): ${p.description || 'No description'}`)
        .join('\n');

      description += `\n\nParameters:\n${paramDescriptions}`;
    }

    return description;
  }

  private generateInputSchema(operation: ApiOperation): z.ZodRawShape {
    const shape: z.ZodRawShape = {};

    // Process parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        const paramSchema = this.convertParameter(param);
        if (paramSchema) {
          shape[param.name] = paramSchema;
        }
      }
    }

    // Process request body
    if (operation.requestBody && operation.requestBody.content) {
      // Prefer application/json content
      const jsonContent = operation.requestBody.content['application/json'];
      if (jsonContent && jsonContent.schema) {
        const bodySchema = this.schemaConverter.convert(jsonContent.schema);

        // If request body is required, merge its properties into the main shape
        // Otherwise, make it optional
        if (operation.requestBody.required) {
          // If the body schema is an object, merge its shape
          if (bodySchema instanceof z.ZodObject) {
            const bodyShape = bodySchema.shape;
            Object.assign(shape, bodyShape);
          } else {
            // For non-object bodies, add as 'body' parameter
            shape['body'] = bodySchema;
          }
        } else {
          if (bodySchema instanceof z.ZodObject) {
            const bodyShape = bodySchema.shape;
            // Make all body properties optional
            for (const [key, schema] of Object.entries(bodyShape)) {
              shape[key] = (schema as z.ZodType<any>).optional();
            }
          } else {
            shape['body'] = bodySchema.optional();
          }
        }
      }
    }

    // Return the shape object (not wrapped in z.object())
    return shape;
  }

  private convertParameter(param: ApiParameter): z.ZodType<any> | null {
    if (!param.schema) {
      // For OpenAPI 2.0 style parameters without schema
      logger.warn(`Parameter ${param.name} has no schema, using any type`);
      return param.required ? z.any() : z.any().optional();
    }

    let zodSchema = this.schemaConverter.convert(param.schema);

    // Apply required/optional
    if (!param.required) {
      zodSchema = zodSchema.optional();
    }

    // Add description as metadata (for documentation purposes)
    if (param.description) {
      zodSchema = zodSchema.describe(param.description);
    }

    return zodSchema;
  }
}