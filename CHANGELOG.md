# Changelog

## [1.1.18] - 2025-07-25

### Changed
- Restored 'app' component in tool names by removing it from the prefix filter list
- Tool names now include 'app' as a meaningful part of the path structure

### Updated Examples for WRA API
- `GET /App/Reservoir/Info/Day/{...}` → `get-app-reservoir-info-day`
- `GET /App/Reservoir/Info/Hour/{...}` → `get-app-reservoir-info-hour`
- `GET /App/Reservoir/Info/Realtime/{...}` → `get-app-reservoir-info-realtime`

## [1.1.17] - 2025-07-25

### Fixed
- **Critical Fix**: Improved tool naming logic to exclude path parameters and use meaningful path components
- Fixed issue where paths with parameters would generate non-descriptive or duplicate tool names
- Now properly filters out parameters (e.g., `{id}`, `{BeginDate}`) and uses actual path segments

### Enhanced Tool Naming
- **Before**: `/App/Reservoir/Info/Day/{ReservoirID}/{BeginDate}/{EndDate}` → `get-enddate`
- **After**: `/App/Reservoir/Info/Day/{ReservoirID}/{BeginDate}/{EndDate}` → `get-reservoir-info-day`

### Technical Details
- Updated path parsing to exclude parameter segments (anything in `{braces}`)
- Added 'app' to common prefix filter list
- Now uses all meaningful path components instead of just the last one
- Generates descriptive tool names that reflect the actual API functionality

### Examples for WRA API
- `GET /App/Reservoir/Info/Day/{...}` → `get-reservoir-info-day`
- `GET /App/Reservoir/Info/Hour/{...}` → `get-reservoir-info-hour`
- `GET /App/Reservoir/Info/Realtime/{...}` → `get-reservoir-info-realtime`

## [1.1.15] - 2025-07-25

### Changed
- Further simplified tool naming convention from `[method]group-endpoint` to `method-endpoint`
- Uses only the method and final endpoint name for maximum simplicity and readability
- Removed brackets from method names for cleaner appearance

### Technical Details
- Updated tool name format to use only `method` + `endpoint` (last path component)
- Examples:
  - `GET /api/Weather/forecast` → `get-forecast`
  - `POST /api/Users/create` → `post-create`
  - `PUT /api/Items/{id}` → `put-id`
- Maintains 64-character limit compliance for Claude Desktop

## [1.1.14] - 2025-07-25

### Changed
- Simplified tool naming convention from `method-path-group-endpoint` to `[method]group-endpoint`
- Added automatic tool name length limit (64 characters max) for Claude Desktop compatibility
- Improved path parsing by filtering out common API prefixes (`api`, `v1`, `v2`, `v3`)
- Enhanced tool name truncation with intelligent part preservation

### Fixed
- Fixed Claude Desktop error: "String should have at most 64 characters" for tool names
- Added smart truncation that preserves method and endpoint while removing less important middle parts

### Technical Details
- Updated `generateToolName()` method to use simplified format: `[method]group-endpoint`
- Added `truncateToolName()` method with intelligent truncation logic
- Filters out common API path prefixes to reduce name length
- Takes only the most significant path parts (usually last 2) for cleaner names

## [1.1.13] - 2025-07-25

### Fixed
- Fixed Swagger 2.0 host field validation error for malformed documents
- Added automatic correction for host fields containing paths (e.g., `web.wra.gov.tw/wracbhydro2`)
- Properly separates host and basePath fields according to Swagger 2.0 specification
- Specifically fixes compatibility with Taiwan WRA API and similar malformed Swagger documents

### Technical Details
- Added `fixHostFieldFormat()` method to handle malformed host fields in Swagger 2.0 documents
- Automatically extracts path components from host field and moves them to basePath
- Combines with existing basePath if present and normalizes duplicate slashes
- Provides detailed logging for troubleshooting host field corrections

## [1.1.12] - 2025-07-25

### Fixed
- Fixed MCP protocol JSON parsing error caused by stdout contamination
- Redirected all log outputs to stderr to maintain clean stdout for MCP communication
- Fixed dotenv configuration error outputs interfering with MCP protocol
- Resolved "Unexpected token" and "Expected ',' or ']'" JSON errors

### Technical Details
- Updated config.ts to use process.stderr.write instead of console.error
- Modified logger.ts to output all logs to stderr instead of stdout
- Ensures MCP server maintains clean JSON-RPC communication channel

## [1.1.11] - 2025-07-25

### Fixed
- Added executable permissions to compiled index.js for proper npx execution
- Updated build script to include `chmod 755` command following Mssql-Mcp pattern
- Resolved npx execution issues on Unix-like systems

## [1.1.10] - 2025-07-25

### Changed
- Refactored to follow @yuuzu/mssql-mcp project structure
- Changed bin command from `swagger-mcp` to `swagger-mcp-server`
- Updated GitHub Actions workflow to match best practices
- Simplified package structure by removing separate bin directory

### Fixed
- Improved cross-platform compatibility
- Better npx execution support

## [1.1.9] - 2025-07-25

### Fixed
- Fixed npx execution issue on Windows
- Added proper bin scripts for cross-platform compatibility
- Created dedicated bin directory with platform-specific launchers

### Added
- bin/swagger-mcp for Unix-like systems
- bin/swagger-mcp.cmd for Windows systems

## [1.1.8] - 2025-07-25

### Fixed
- Fixed NPM publishing error for scoped package
- Added publishConfig with public access to package.json
- Updated GitHub Actions to publish with --access public flag

## [1.1.7] - 2025-07-25

### Changed
- Changed package name to scoped package `@yuuzu/swagger-mcp`
- Updated installation instructions to use npx
- Updated Claude Desktop configuration examples

### Added
- Support for installing via `npx @yuuzu/swagger-mcp`
- Global installation option via npm

## [1.1.6] - 2025-07-25

### Fixed
- Fixed NPM package.json bin field formatting issue
- Corrected bin path to use relative path instead of absolute

### Changed
- Ran `npm pkg fix` to address NPM publishing warnings

## [1.1.5] - 2025-07-25

### Fixed
- Cleaned up codebase by removing ESLint from scripts
- Fixed various code quality issues
- Ensured proper build process

### Changed
- Updated repository URL to use lowercase username
- Improved code organization and structure
- Enhanced tool generation logic for better operationId handling

## [1.1.1] - 2025-07-25

### 🔧 Critical Fix
- **Fixed Duplicate operationId Error**: Automatically handles Swagger documents with duplicate operationIds
  - Resolves "Validation failed. Duplicate operation id" errors that prevented certain Swagger documents from loading
  - Automatically adds unique suffixes to duplicate operationIds (e.g., `App_GetRainHourInfos_2`, `App_GetRainHourInfos_3`)
  - Specifically fixes compatibility with Taiwan WRA (Water Resources Agency) API: https://web.wra.gov.tw/wracbhydro2/WracbApi/swagger/docs/v1
  - Maintains backward compatibility and doesn't affect well-formed Swagger documents

### Technical Details
- Added `fixDuplicateOperationIds()` method to pre-process Swagger documents before validation
- Two-pass algorithm: first identifies duplicates, then systematically renames them with unique suffixes
- Comprehensive logging shows which operationIds were renamed and why
- Preserves original operationId for the first occurrence, only renames subsequent duplicates

## [1.1.0] - 2025-07-25

### 🎉 Major Enhancement
- **Improved Tool Naming Convention**: Tools now use a more readable `method-path-group-endpoint` format with hyphens
  - Example: `POST /api/Auth/SignIn` → `post-api-auth-signin`
  - Example: `GET /api/Api/{id}` → `get-api-api-id`
  - Example: `PUT /api/Application/settings` → `put-api-application-settings`
- Better tool organization and readability in Claude Desktop
- Maintains backward compatibility with existing operationId values

### Technical Details
- Updated `ToolGenerator.generateToolName()` method
- Improved path parameter handling (`{id}` → `id`)
- Enhanced character cleaning and validation
- All generated names are lowercase with hyphens for consistency

## [1.0.2] - 2025-07-25

### Fixed
- Fixed "getaddrinfo ENOTFOUND" error when Swagger documents use relative server URLs
- Improved base URL extraction logic for both OpenAPI 2.0 and 3.x documents
- Added automatic host extraction from SWAGGER_URL when server URLs are relative
- Enhanced logging for debugging base URL issues

### Added
- Better documentation for API_BASE_URL configuration
- Instructions for handling APIs with relative server URLs

## [1.0.1] - 2025-07-25

### Updated
- Updated all dependencies to latest versions:
  - `axios`: 1.7.9 → 1.11.0
  - `dotenv`: 16.4.7 → 17.2.1
  - `@types/node`: 22.10.2 → 24.1.0
  - `@types/jest`: 29.5.14 → 30.0.0
  - `jest`: 29.7.0 → 30.0.5
- Added Node.js version requirement (>=18.0.0)
- Added `clean` script to package.json

### Fixed
- TypeScript compilation issues with latest SDK
- Import path compatibility with latest MCP SDK

### Notes
- Kept `zod` at version 3.x to avoid breaking changes (v4.x has significant API changes)
- All deprecated npm warnings are from transitive dependencies and don't affect functionality

## [1.0.0] - 2025-07-25

### Initial Release
- Support for all Swagger/OpenAPI versions (2.0, 3.0, 3.1)
- Dynamic MCP tool generation from API endpoints
- Multiple authentication methods (Bearer, API Key, Basic)
- Environment variable configuration
- Automatic Swagger document reloading
- Comprehensive error handling and logging