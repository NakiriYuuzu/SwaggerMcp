import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import axios from 'axios';
const SwaggerParser = require('swagger-parser');
import { promises as fs } from 'fs';
import { OpenAPIDocument, ParsedSwaggerDoc, McpToolMetadata } from './types';
import { SwaggerParser as Parser } from './parsers';
import { ToolGenerator } from './generators';
import { AuthManager, ApiProxy } from './proxy';
import { appConfig } from './utils/config';
import { logger } from './utils/logger';

export class SwaggerMcpServer {
  private server: McpServer;
  private swaggerDoc?: ParsedSwaggerDoc;
  private tools: Map<string, McpToolMetadata> = new Map();
  private authManager: AuthManager;
  private apiProxy?: ApiProxy;
  private refreshInterval?: NodeJS.Timeout;

  constructor() {
    this.server = new McpServer({
      name: 'swagger-mcp',
      version: '1.0.0',
    });

    this.authManager = new AuthManager({
      type: appConfig.auth.type,
      token: appConfig.auth.token,
      header: appConfig.auth.header,
      apiKeyHeader: appConfig.auth.apiKeyHeader,
    });

    this.setupServer();
  }

  private setupServer(): void {
    // Server will be initialized when start() is called
    logger.info('SwaggerMCP server initialized');
  }

  async start(): Promise<void> {
    logger.info('Starting SwaggerMCP server...');

    // Load and parse Swagger document
    await this.loadSwaggerDocument();

    // Set up refresh interval if configured
    if (appConfig.options.refreshInterval > 0) {
      this.refreshInterval = setInterval(
        () => this.loadSwaggerDocument(),
        appConfig.options.refreshInterval
      );
      logger.info(`Swagger document refresh interval set to ${appConfig.options.refreshInterval}ms`);
    }

    // Register tools with MCP server
    this.registerTools();

    // Set up STDIO transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('SwaggerMCP server started successfully');
  }

  private async loadSwaggerDocument(): Promise<void> {
    try {
      logger.info('Loading Swagger document...');
      
      let document: OpenAPIDocument;

      if (appConfig.swagger.url) {
        // Fetch from URL
        logger.info(`Fetching Swagger document from URL: ${appConfig.swagger.url}`);
        const response = await axios.get(appConfig.swagger.url);
        document = response.data;
      } else if (appConfig.swagger.path) {
        // Read from file
        logger.info(`Reading Swagger document from file: ${appConfig.swagger.path}`);
        const content = await fs.readFile(appConfig.swagger.path, 'utf-8');
        document = JSON.parse(content);
      } else {
        throw new Error('No Swagger document source configured');
      }

      // Fix duplicate operationIds before validation
      this.fixDuplicateOperationIds(document);

      // Validate and dereference the document
      const validated = await SwaggerParser.validate(document as any);
      const dereferenced = await SwaggerParser.dereference(validated as any);

      // Parse the document
      const parser = Parser.create(dereferenced);
      this.swaggerDoc = parser.parse();

      // Log the extracted base URL
      logger.info(`Base URL from Swagger document: ${this.swaggerDoc.baseUrl}`);

      // Override base URL if configured
      if (appConfig.api.baseUrl) {
        logger.info(`Overriding base URL with API_BASE_URL: ${appConfig.api.baseUrl}`);
        this.swaggerDoc.baseUrl = appConfig.api.baseUrl;
      }

      // Create API proxy
      this.apiProxy = new ApiProxy(this.swaggerDoc.baseUrl, this.authManager);

      logger.info(`Swagger document loaded: ${this.swaggerDoc.title} (${this.swaggerDoc.version})`);
      logger.info(`Using API base URL: ${this.swaggerDoc.baseUrl}`);
      logger.info(`Found ${this.swaggerDoc.operations.length} operations`);

      // Generate tools from operations
      this.generateTools();

    } catch (error) {
      logger.error('Failed to load Swagger document:', error);
      throw error;
    }
  }

  private generateTools(): void {
    if (!this.swaggerDoc) {
      return;
    }

    this.tools.clear();

    const definitions = this.swaggerDoc.securitySchemes;
    const generator = new ToolGenerator(definitions);

    for (const operation of this.swaggerDoc.operations) {
      try {
        const tool = generator.generateTool(operation);
        this.tools.set(tool.name, tool);
        logger.debug(`Generated tool: ${tool.name}`);
      } catch (error) {
        logger.error(`Failed to generate tool for operation ${operation.operationId}:`, error);
      }
    }

    logger.info(`Generated ${this.tools.size} tools from Swagger operations`);
  }

  private registerTools(): void {
    for (const [name, metadata] of this.tools) {
      this.server.registerTool(
        name,
        {
          title: metadata.title,
          description: metadata.description,
          inputSchema: metadata.inputSchema,
        },
        async (params: any) => {
          return this.executeTool(metadata, params);
        }
      );
    }

    logger.info(`Registered ${this.tools.size} tools with MCP server`);
  }

  private async executeTool(metadata: McpToolMetadata, params: any): Promise<any> {
    if (!this.apiProxy) {
      throw new Error('API proxy not initialized');
    }

    try {
      logger.info(`Executing tool: ${metadata.name}`);
      
      // Validate input parameters
      const schema = z.object(metadata.inputSchema);
      const validatedParams = schema.parse(params);
      
      // Execute the API operation
      const result = await this.apiProxy.execute(metadata.operation, validatedParams);
      
      // Return result in MCP format
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error(`Tool execution failed: ${metadata.name}`, error);
      
      // Return error in MCP format
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private fixDuplicateOperationIds(document: OpenAPIDocument): void {
    if (!document.paths) {
      return;
    }

    const operationIds = new Set<string>();
    const duplicateCount = new Map<string, number>();
    let fixedCount = 0;

    // First pass: collect all operationIds and identify duplicates
    for (const [path, pathItem] of Object.entries(document.paths)) {
      if (!pathItem) continue;

      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        const operationId = operation.operationId;
        if (operationId) {
          if (operationIds.has(operationId)) {
            // Found duplicate
            const count = duplicateCount.get(operationId) || 1;
            duplicateCount.set(operationId, count + 1);
          } else {
            operationIds.add(operationId);
          }
        }
      }
    }

    // Second pass: fix duplicate operationIds
    const processedIds = new Set<string>();
    
    for (const [path, pathItem] of Object.entries(document.paths)) {
      if (!pathItem) continue;

      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        const originalOperationId = operation.operationId;
        if (originalOperationId && duplicateCount.has(originalOperationId)) {
          // This is a duplicate operationId
          if (processedIds.has(originalOperationId)) {
            // Generate unique suffix
            let suffix = 2;
            let newOperationId = `${originalOperationId}_${suffix}`;
            
            while (operationIds.has(newOperationId) || processedIds.has(newOperationId)) {
              suffix++;
              newOperationId = `${originalOperationId}_${suffix}`;
            }
            
            operation.operationId = newOperationId;
            operationIds.add(newOperationId);
            processedIds.add(newOperationId);
            fixedCount++;
            
            logger.warn(`Fixed duplicate operationId: '${originalOperationId}' → '${newOperationId}' (${method.toUpperCase()} ${path})`);
          } else {
            // First occurrence, keep original
            processedIds.add(originalOperationId);
          }
        }
      }
    }

    if (fixedCount > 0) {
      logger.info(`Fixed ${fixedCount} duplicate operationIds in Swagger document`);
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping SwaggerMCP server...');
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    await this.server.close();
    logger.info('SwaggerMCP server stopped');
  }
}