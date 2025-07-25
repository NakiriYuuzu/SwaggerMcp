import { AxiosRequestConfig } from 'axios';
import { AuthConfig } from '../types';
import { logger } from '../utils/logger';

export class AuthManager {
  private authConfig: AuthConfig;

  constructor(authConfig: AuthConfig) {
    this.authConfig = authConfig;
  }

  // Apply authentication to request config
  applyAuth(config: AxiosRequestConfig): AxiosRequestConfig {
    if (this.authConfig.type === 'none') {
      return config;
    }

    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {};
    }

    switch (this.authConfig.type) {
      case 'bearer':
        if (this.authConfig.token) {
          config.headers[this.authConfig.header] = `Bearer ${this.authConfig.token}`;
          logger.debug(`Applied Bearer token authentication`);
        } else {
          logger.warn('Bearer auth configured but no token provided');
        }
        break;

      case 'apikey':
        if (this.authConfig.token && this.authConfig.apiKeyHeader) {
          config.headers[this.authConfig.apiKeyHeader] = this.authConfig.token;
          logger.debug(`Applied API key authentication to header: ${this.authConfig.apiKeyHeader}`);
        } else {
          logger.warn('API key auth configured but no token or header name provided');
        }
        break;

      case 'basic':
        if (this.authConfig.token) {
          // Token should be in format "username:password"
          const encoded = Buffer.from(this.authConfig.token).toString('base64');
          config.headers[this.authConfig.header] = `Basic ${encoded}`;
          logger.debug(`Applied Basic authentication`);
        } else {
          logger.warn('Basic auth configured but no credentials provided');
        }
        break;

      default:
        logger.warn(`Unknown authentication type: ${this.authConfig.type}`);
    }

    return config;
  }

  // Update authentication token
  updateToken(token: string): void {
    this.authConfig.token = token;
    logger.info('Authentication token updated');
  }

  // Get current auth type
  getAuthType(): string {
    return this.authConfig.type;
  }

  // Check if authentication is configured
  isAuthConfigured(): boolean {
    return this.authConfig.type !== 'none' && !!this.authConfig.token;
  }
}