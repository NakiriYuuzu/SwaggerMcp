import { OpenAPIDocument, ParsedSwaggerDoc, ApiOperation } from '../types';

export abstract class SwaggerParser {
  protected document: OpenAPIDocument;

  constructor(document: OpenAPIDocument) {
    this.document = document;
  }

  // Factory method to create appropriate parser
  static create(document: OpenAPIDocument): SwaggerParser {
    const version = SwaggerParser.detectVersion(document);

    switch (version) {
      case '2.0': {
        const { OpenApi2Parser } = require('./OpenApi2Parser');
        return new OpenApi2Parser(document);
      }
      case '3.0':
      case '3.1': {
        const { OpenApi3Parser } = require('./OpenApi3Parser');
        return new OpenApi3Parser(document);
      }
      default:
        throw new Error(`Unsupported OpenAPI version: ${version}`);
    }
  }

  // Detect OpenAPI version
  private static detectVersion(document: any): '2.0' | '3.0' | '3.1' {
    if ('swagger' in document && document.swagger === '2.0') {
      return '2.0';
    } else if ('openapi' in document) {
      if (document.openapi.startsWith('3.0')) {
        return '3.0';
      } else if (document.openapi.startsWith('3.1')) {
        return '3.1';
      }
    }
    throw new Error('Unable to detect OpenAPI version');
  }

  // Abstract method to parse the document
  abstract parse(): ParsedSwaggerDoc;

  // Common method to extract operations
  protected extractOperations(): ApiOperation[] {
    const operations: ApiOperation[] = [];

    // This will be implemented differently by each subclass
    // but provides a common interface
    return operations;
  }

  // Helper to generate operation ID if not provided
  protected generateOperationId(method: string, path: string): string {
    // Convert path to camelCase operation ID
    // e.g., POST /api/users/{id}/profile => postApiUsersIdProfile
    const pathParts = path
      .split('/')
      .filter(part => part.length > 0)
      .map(part => {
        // Handle path parameters
        if (part.startsWith('{') && part.endsWith('}')) {
          return part.slice(1, -1);
        }
        return part;
      });

    const operationId = method.toLowerCase() + pathParts
      .map((part, index) => {
        if (index === 0) {
          return part;
        }
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join('');

    return operationId;
  }

  // Extract base URL from the document
  protected abstract extractBaseUrl(): string;
}