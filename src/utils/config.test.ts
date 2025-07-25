import { loadConfig } from './config';

// Mock dotenv to prevent console.log output
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('Config', () => {
  const originalEnv = process.env;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Mock console.error to suppress expected error output
    console.error = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
    console.error = originalConsoleError;
  });

  it('should throw error when neither SWAGGER_URL nor SWAGGER_PATH is provided', () => {
    delete process.env.SWAGGER_URL;
    delete process.env.SWAGGER_PATH;

    expect(() => {
      loadConfig();
    }).toThrow();
  });

  it('should parse environment variables correctly', () => {
    process.env.SWAGGER_URL = 'https://example.com/swagger.json';
    process.env.AUTH_TYPE = 'bearer';
    process.env.AUTH_TOKEN = 'test-token';
    process.env.API_TIMEOUT = '5000';
    process.env.LOG_LEVEL = 'debug';
    process.env.ENABLE_REQUEST_LOGGING = 'true';

    const config = loadConfig();

    expect(config.swagger.url).toBe('https://example.com/swagger.json');
    expect(config.auth.type).toBe('bearer');
    expect(config.auth.token).toBe('test-token');
    expect(config.api.timeout).toBe(5000);
    expect(config.options.logLevel).toBe('debug');
    expect(config.options.enableRequestLogging).toBe(true);
  });

  it('should use default values when optional environment variables are not set', () => {
    process.env.SWAGGER_URL = 'https://example.com/swagger.json';
    delete process.env.AUTH_TYPE;
    delete process.env.API_TIMEOUT;
    delete process.env.LOG_LEVEL;
    delete process.env.ENABLE_REQUEST_LOGGING;

    const config = loadConfig();

    expect(config.auth.type).toBe('none');
    expect(config.api.timeout).toBe(30000);
    expect(config.options.refreshInterval).toBe(3600000);
    expect(config.options.logLevel).toBe('info');
    expect(config.options.enableRequestLogging).toBe(false);
  });
});