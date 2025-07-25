import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiOperation } from '../types';
import { AuthManager } from './AuthManager';
import { logger } from '../utils/logger';
import { appConfig } from '../utils/config';

export class ApiProxy {
  private axiosInstance: AxiosInstance;
  private authManager: AuthManager;
  private baseUrl: string;

  constructor(baseUrl: string, authManager: AuthManager) {
    this.baseUrl = this.normalizeBaseUrl(baseUrl);
    this.authManager = authManager;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: appConfig.api.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.request(config.method?.toUpperCase() || 'GET', config.url || '', config.data);
        return config;
      },
      (error) => {
        logger.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.response(
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          response.status,
          response.data
        );
        return response;
      },
      (error) => {
        if (error.response) {
          logger.response(
            error.config?.method?.toUpperCase() || 'GET',
            error.config?.url || '',
            error.response.status,
            error.response.data
          );
        } else {
          logger.error('Response error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  // Execute API operation
  async execute(operation: ApiOperation, params: Record<string, any>): Promise<any> {
    try {
      const config = this.buildRequestConfig(operation, params);
      const response = await this.axiosInstance.request(config);
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error, operation);
    }
  }

  private buildRequestConfig(operation: ApiOperation, params: Record<string, any>): AxiosRequestConfig {
    let url = operation.path;
    const config: AxiosRequestConfig = {
      method: operation.method.toLowerCase() as any,
      url,
      params: {},
      headers: {},
    };

    // Process parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        const value = params[param.name];
        
        // Skip undefined optional parameters
        if (value === undefined && !param.required) {
          continue;
        }

        switch (param.in) {
          case 'path':
            // Replace path parameters
            url = url.replace(`{${param.name}}`, encodeURIComponent(value));
            config.url = url;
            break;
          
          case 'query':
            config.params![param.name] = value;
            break;
          
          case 'header':
            config.headers![param.name] = value;
            break;
          
          case 'cookie':
            // Cookies are typically handled by the browser/client
            logger.warn(`Cookie parameter ${param.name} is not directly supported`);
            break;
        }
      }
    }

    // Process request body
    if (operation.requestBody) {
      // Collect all parameters that aren't path/query/header
      const bodyData: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(params)) {
        // Skip if this parameter was already handled
        const isHandledParam = operation.parameters?.some(
          p => p.name === key && ['path', 'query', 'header', 'cookie'].includes(p.in)
        );
        
        if (!isHandledParam && value !== undefined) {
          bodyData[key] = value;
        }
      }

      // Check if we have a 'body' parameter (for non-object request bodies)
      if (params.body !== undefined) {
        config.data = params.body;
      } else if (Object.keys(bodyData).length > 0) {
        config.data = bodyData;
      }
    }

    // Apply authentication
    return this.authManager.applyAuth(config);
  }

  private handleResponse(response: AxiosResponse): any {
    // Return the response data directly
    // In a more sophisticated implementation, we might validate against the response schema
    return response.data;
  }

  private handleError(error: any, operation: ApiOperation): never {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const data = error.response.data;
        
        throw new Error(
          `API request failed: ${operation.method} ${operation.path} returned ${status}. ` +
          `Response: ${JSON.stringify(data)}`
        );
      } else if (error.request) {
        // Request was made but no response received
        throw new Error(
          `API request failed: ${operation.method} ${operation.path} - No response received. ` +
          `Error: ${error.message}`
        );
      } else {
        // Error in request setup
        throw new Error(
          `API request setup failed: ${operation.method} ${operation.path}. ` +
          `Error: ${error.message}`
        );
      }
    } else {
      // Non-Axios error
      throw new Error(
        `Unexpected error during API request: ${operation.method} ${operation.path}. ` +
        `Error: ${error.message || error}`
      );
    }
  }

  private normalizeBaseUrl(url: string): string {
    // Remove trailing slash
    return url.replace(/\/$/, '');
  }

  // Update base URL
  updateBaseUrl(baseUrl: string): void {
    this.baseUrl = this.normalizeBaseUrl(baseUrl);
    this.axiosInstance.defaults.baseURL = this.baseUrl;
    logger.info(`API base URL updated to: ${this.baseUrl}`);
  }
}