import { OpenAPIV2 } from 'openapi-types';
import { SwaggerParser } from './SwaggerParser';
import { ParsedSwaggerDoc, ApiOperation, ApiParameter, ApiRequestBody, ApiResponse } from '../types';
import { logger } from '../utils/logger';

export class OpenApi2Parser extends SwaggerParser {
  protected document: OpenAPIV2.Document;

  constructor(document: OpenAPIV2.Document) {
    super(document);
    this.document = document;
  }

  parse(): ParsedSwaggerDoc {
    logger.info('Parsing OpenAPI 2.0 document');
    
    return {
      version: '2.0',
      title: this.document.info.title,
      description: this.document.info.description,
      baseUrl: this.extractBaseUrl(),
      operations: this.extractOperations(),
      securitySchemes: this.document.securityDefinitions,
    };
  }

  protected extractBaseUrl(): string {
    const schemes = this.document.schemes || ['https'];
    const scheme = schemes[0];
    const host = this.document.host || '';
    const basePath = this.document.basePath || '';
    
    logger.debug(`OpenAPI 2.0 - scheme: ${scheme}, host: ${host}, basePath: ${basePath}`);
    
    // If host is empty or incomplete, try to extract from SWAGGER_URL
    if (!host || !host.includes('.')) {
      const swaggerUrl = process.env.SWAGGER_URL;
      if (swaggerUrl) {
        try {
          const urlObj = new URL(swaggerUrl);
          const extractedHost = urlObj.host;
          logger.info(`No valid host in Swagger doc, using host from SWAGGER_URL: ${extractedHost}`);
          const baseUrl = `${scheme}://${extractedHost}${basePath}`;
          logger.info(`Constructed base URL: ${baseUrl}`);
          return baseUrl;
        } catch (error) {
          logger.error('Failed to parse SWAGGER_URL:', error);
        }
      }
    }
    
    const baseUrl = `${scheme}://${host}${basePath}`;
    logger.info(`Extracted base URL: ${baseUrl}`);
    return baseUrl;
  }

  protected extractOperations(): ApiOperation[] {
    const operations: ApiOperation[] = [];
    
    if (!this.document.paths) {
      return operations;
    }

    for (const [path, pathItem] of Object.entries(this.document.paths)) {
      if (!pathItem) continue;

      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        const apiOperation: ApiOperation = {
          operationId: operation.operationId || this.generateOperationId(method, path),
          method: method.toUpperCase(),
          path,
          summary: operation.summary,
          description: operation.description,
          parameters: this.convertParameters(
            operation.parameters || [], 
            Array.isArray(pathItem.parameters) ? pathItem.parameters : []
          ),
          requestBody: this.convertRequestBody(operation),
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
    operationParams: (OpenAPIV2.Parameter | OpenAPIV2.ReferenceObject)[],
    pathParams: (OpenAPIV2.Parameter | OpenAPIV2.ReferenceObject)[]
  ): ApiParameter[] {
    // Merge path-level and operation-level parameters
    const allParams = [...(pathParams || []), ...(operationParams || [])];
    const uniqueParams = new Map<string, OpenAPIV2.Parameter>();
    
    // Operation parameters override path parameters
    for (const param of allParams) {
      // Skip reference objects for now (would need proper $ref resolution)
      if ('$ref' in param) {
        continue;
      }
      if ('name' in param) {
        const key = `${param.in}-${param.name}`;
        uniqueParams.set(key, param);
      }
    }

    return Array.from(uniqueParams.values())
      .filter(param => 'name' in param && param.in !== 'body')
      .map(param => ({
        name: (param as OpenAPIV2.InBodyParameterObject).name,
        in: param.in as 'path' | 'query' | 'header',
        description: param.description,
        required: param.required,
        schema: this.extractParameterSchema(param),
        example: 'example' in param ? param.example : undefined,
      }));
  }

  private extractParameterSchema(param: OpenAPIV2.Parameter): any {
    if ('schema' in param) {
      return (param as OpenAPIV2.InBodyParameterObject).schema;
    }
    
    // For non-body parameters, construct schema from type info
    const schema: any = {
      type: (param as any).type,
    };

    if ('format' in param) {
      schema.format = (param as any).format;
    }
    if ('enum' in param) {
      schema.enum = (param as any).enum;
    }
    if ('minimum' in param) {
      schema.minimum = (param as any).minimum;
    }
    if ('maximum' in param) {
      schema.maximum = (param as any).maximum;
    }
    if ('pattern' in param) {
      schema.pattern = (param as any).pattern;
    }

    return schema;
  }

  private convertRequestBody(operation: OpenAPIV2.OperationObject): ApiRequestBody | undefined {
    const bodyParam = operation.parameters?.find(
      param => 'in' in param && param.in === 'body'
    ) as OpenAPIV2.InBodyParameterObject | undefined;

    if (!bodyParam) {
      return undefined;
    }

    return {
      description: bodyParam.description,
      required: bodyParam.required,
      content: {
        'application/json': {
          schema: bodyParam.schema,
        },
      },
    };
  }

  private convertResponses(responses: OpenAPIV2.ResponsesObject): Record<string, ApiResponse> {
    const converted: Record<string, ApiResponse> = {};

    for (const [statusCode, response] of Object.entries(responses)) {
      if (typeof response === 'object' && 'description' in response) {
        converted[statusCode] = {
          description: response.description,
          content: response.schema ? {
            'application/json': {
              schema: response.schema,
            },
          } : undefined,
        };
      }
    }

    return converted;
  }
}