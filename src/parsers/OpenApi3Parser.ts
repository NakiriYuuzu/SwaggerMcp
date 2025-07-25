import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { SwaggerParser } from './SwaggerParser';
import { ParsedSwaggerDoc, ApiOperation, ApiParameter, ApiRequestBody, ApiResponse } from '../types';
import { logger } from '../utils/logger';

type OpenAPI3Document = OpenAPIV3.Document | OpenAPIV3_1.Document;
type OpenAPI3Operation = OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject;
type OpenAPI3Parameter = OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject;

export class OpenApi3Parser extends SwaggerParser {
  protected document: OpenAPI3Document;

  constructor(document: OpenAPI3Document) {
    super(document);
    this.document = document;
  }

  parse(): ParsedSwaggerDoc {
    const version = this.document.openapi.startsWith('3.0') ? '3.0' : '3.1';
    logger.info(`Parsing OpenAPI ${version} document`);
    
    return {
      version: version as '3.0' | '3.1',
      title: this.document.info.title,
      description: this.document.info.description,
      baseUrl: this.extractBaseUrl(),
      operations: this.extractOperations(),
      securitySchemes: this.extractSecuritySchemes(),
    };
  }

  protected extractBaseUrl(): string {
    if (!this.document.servers || this.document.servers.length === 0) {
      logger.warn('No servers defined in OpenAPI document, using default localhost');
      return 'http://localhost';
    }

    // Use the first server as the default
    const server = this.document.servers[0];
    let url = server.url;

    logger.debug(`Original server URL from OpenAPI: ${url}`);

    // Replace variables with default values
    if (server.variables) {
      for (const [varName, variable] of Object.entries(server.variables)) {
        const value = variable.default || variable.enum?.[0] || '';
        url = url.replace(`{${varName}}`, value);
      }
    }

    // Handle relative URLs - if URL starts with /, it's relative to the host
    if (url.startsWith('/')) {
      // Try to extract the host from the Swagger document URL if available
      const swaggerUrl = process.env.SWAGGER_URL;
      if (swaggerUrl) {
        try {
          const urlObj = new URL(swaggerUrl);
          const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
          url = baseUrl + url;
          logger.info(`Resolved relative URL using Swagger document host: ${url}`);
        } catch (error) {
          logger.error('Failed to parse SWAGGER_URL for host extraction:', error);
          url = 'http://localhost' + url;
        }
      } else {
        logger.warn('Relative server URL found but no SWAGGER_URL to extract host from');
        url = 'http://localhost' + url;
      }
    }

    // Ensure URL is absolute
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // If it's just a hostname or partial URL, assume HTTPS
      url = 'https://' + url;
    }

    logger.info(`Extracted base URL: ${url}`);
    return url;
  }

  protected extractOperations(): ApiOperation[] {
    const operations: ApiOperation[] = [];
    
    if (!this.document.paths) {
      return operations;
    }

    for (const [path, pathItem] of Object.entries(this.document.paths)) {
      if (!pathItem) continue;

      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'] as const;
      
      for (const method of methods) {
        const operation = (pathItem as any)[method] as OpenAPI3Operation | undefined;
        if (!operation) continue;

        const apiOperation: ApiOperation = {
          operationId: operation.operationId || this.generateOperationId(method, path),
          method: method.toUpperCase(),
          path,
          summary: operation.summary,
          description: operation.description,
          parameters: this.convertParameters(operation.parameters || [], pathItem.parameters || []),
          requestBody: this.convertRequestBody(operation.requestBody),
          responses: this.convertResponses(operation.responses),
          security: operation.security || this.document.security,
          tags: operation.tags,
        };

        operations.push(apiOperation);
      }
    }

    return operations;
  }

  private convertParameters(
    operationParams: (OpenAPI3Parameter | OpenAPIV3.ReferenceObject)[],
    pathParams: (OpenAPI3Parameter | OpenAPIV3.ReferenceObject)[]
  ): ApiParameter[] {
    // Merge path-level and operation-level parameters
    const allParams = [...pathParams, ...operationParams];
    const uniqueParams = new Map<string, OpenAPI3Parameter>();
    
    // Operation parameters override path parameters
    for (const param of allParams) {
      // Resolve references if needed (simplified - in production, use a proper $ref resolver)
      const resolvedParam = this.resolveReference(param) as OpenAPI3Parameter;
      if (resolvedParam && 'name' in resolvedParam) {
        const key = `${resolvedParam.in}-${resolvedParam.name}`;
        uniqueParams.set(key, resolvedParam);
      }
    }

    return Array.from(uniqueParams.values()).map(param => ({
      name: param.name,
      in: param.in as 'path' | 'query' | 'header' | 'cookie',
      description: param.description,
      required: param.required,
      schema: param.schema,
      example: param.example,
    }));
  }

  private convertRequestBody(
    requestBody?: OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject | OpenAPIV3.ReferenceObject
  ): ApiRequestBody | undefined {
    if (!requestBody) {
      return undefined;
    }

    // Resolve reference if needed
    const resolvedBody = this.resolveReference(requestBody) as 
      OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject;
    
    if (!resolvedBody) {
      return undefined;
    }

    return {
      description: resolvedBody.description,
      required: resolvedBody.required,
      content: resolvedBody.content as Record<string, any>,
    };
  }

  private convertResponses(
    responses?: OpenAPIV3.ResponsesObject | OpenAPIV3_1.ResponsesObject
  ): Record<string, ApiResponse> {
    if (!responses) {
      return {};
    }

    const converted: Record<string, ApiResponse> = {};

    for (const [statusCode, response] of Object.entries(responses)) {
      const resolvedResponse = this.resolveReference(response) as 
        OpenAPIV3.ResponseObject | OpenAPIV3_1.ResponseObject;
      
      if (resolvedResponse && 'description' in resolvedResponse) {
        converted[statusCode] = {
          description: resolvedResponse.description,
          content: resolvedResponse.content as Record<string, any>,
        };
      }
    }

    return converted;
  }

  private extractSecuritySchemes(): Record<string, any> | undefined {
    if (!this.document.components) {
      return undefined;
    }

    const components = this.document.components as OpenAPIV3.ComponentsObject | OpenAPIV3_1.ComponentsObject;
    return components.securitySchemes as Record<string, any>;
  }

  private resolveReference(obj: any): any {
    // Simplified reference resolution
    // In production, use a proper JSON Reference resolver
    if (obj && '$ref' in obj) {
      logger.warn(`Reference resolution not fully implemented: ${obj.$ref}`);
      return undefined;
    }
    return obj;
  }
}