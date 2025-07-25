# @yuuzu/swagger-mcp

基於 [TypeScript SDK MCP](https://github.com/modelcontextprotocol/typescript-sdk) 的 Swagger/OpenAPI MCP 服務器。此工具能夠從 Swagger/OpenAPI 文檔動態生成 MCP 工具，讓 Claude Desktop 可以直接調用 REST API。

## 功能特色

- ✅ 支援所有 Swagger/OpenAPI 版本（2.0、3.0、3.1）
- ✅ 從 URL 或本地文件載入 Swagger 文檔
- ✅ 動態生成 MCP 工具
- ✅ **優化的工具命名格式**：使用 `method-path-group-endpoint` 格式（如：`post-api-auth-signin`）
- ✅ 支援多種認證方式（Bearer Token、API Key、Basic Auth）
- ✅ 自動參數驗證（使用 Zod）
- ✅ 請求/回應日誌記錄
- ✅ 自動重新載入 Swagger 文檔
- ✅ 完整的錯誤處理

## 系統需求

- Node.js >= 20.14

## 安裝

```bash
# Clone 專案
# 使用 npx（推薦）
npx @yuuzu/swagger-mcp

# 或全域安裝
npm install -g @yuuzu/swagger-mcp

# 或從源碼安裝
git clone https://github.com/nakiriyuuzu/swagger-mcp.git
cd swagger-mcp

# 安裝依賴
npm install

# 建構專案
npm run build
```

## 設定

### 1. 環境變數設定

複製 `.env.sample` 並重新命名為 `.env`：

```bash
cp .env.sample .env
```

編輯 `.env` 檔案，設定您的 Swagger 文檔來源和認證資訊：

```env
# Swagger 文檔來源（擇一）
SWAGGER_URL=https://api.example.com/swagger.json
# 或使用本地檔案
# SWAGGER_PATH=/path/to/swagger.json

# 認證設定
AUTH_TYPE=bearer
AUTH_TOKEN=your-jwt-token-here

# 其他選項
LOG_LEVEL=info
```

### 2. Claude Desktop 設定

在 Claude Desktop 的設定檔中加入 SwaggerMcp 服務器：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "swagger-mcp": {
      "command": "npx",
      "args": ["@yuuzu/swagger-mcp"],
      "env": {
        "SWAGGER_URL": "https://api.example.com/swagger.json",
        "AUTH_TYPE": "bearer",
        "AUTH_TOKEN": "your-jwt-token-here"
      }
    }
  }
}
```

## 使用方式

1. 重新啟動 Claude Desktop
2. 在對話中，您可以看到從 Swagger 文檔生成的工具
3. 使用工具時，Claude 會自動調用對應的 API

### 範例對話

```
User: 使用 API 登入，帳號是 test@example.com，密碼是 password123

Claude: 我會使用 post-api-auth-signin 工具來幫您登入。

[調用工具 post-api-auth-signin]

登入成功！這是您的認證資訊：
- Token: eyJhbGciOiJIUzI1NiIs...
- 過期時間: 2024-01-25T12:00:00Z
```

## 環境變數說明

### 必要設定

| 變數 | 說明 | 範例 |
|------|------|------|
| `SWAGGER_URL` 或 `SWAGGER_PATH` | Swagger 文檔來源 | `https://api.example.com/swagger.json` |

### 認證設定

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `AUTH_TYPE` | 認證類型：bearer、apikey、basic、none | none |
| `AUTH_TOKEN` | 認證 token 或憑證 | - |
| `AUTH_HEADER` | 認證標頭名稱 | Authorization |
| `API_KEY_HEADER` | API Key 標頭名稱（apikey 類型） | X-API-Key |

### 進階設定

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `API_BASE_URL` | 覆蓋 Swagger 中的 base URL（**重要**：如果 Swagger 使用相對 URL，必須設定此項） | - |
| `API_TIMEOUT` | 請求超時時間（毫秒） | 30000 |
| `REFRESH_INTERVAL` | Swagger 文檔重新載入間隔（毫秒） | 3600000 |
| `LOG_LEVEL` | 日誌等級：debug、info、warn、error | info |
| `ENABLE_REQUEST_LOGGING` | 啟用請求/回應日誌 | false |

#### API_BASE_URL 設定說明

某些 Swagger 文檔使用相對 URL 作為服務器地址（例如 `/api`）。在這種情況下，您需要設定 `API_BASE_URL` 來指定完整的 API 基礎 URL：

```env
# 使用相對 URL 的 API 範例
SWAGGER_URL=https://example.com/api/swagger.json
API_BASE_URL=https://example.com/api
```

## 支援的認證方式

### Bearer Token
```env
AUTH_TYPE=bearer
AUTH_TOKEN=eyJhbGciOiJIUzI1NiIs...
```

### API Key
```env
AUTH_TYPE=apikey
AUTH_TOKEN=your-api-key
API_KEY_HEADER=X-API-Key
```

### Basic Auth
```env
AUTH_TYPE=basic
AUTH_TOKEN=username:password
```

## 開發

### 開發模式
```bash
npm run dev
```

### 執行測試
```bash
npm test
```

### 程式碼檢查
```bash
npm run lint
npm run typecheck
```

## 專案結構

```
SwaggerMcp/
├── src/
│   ├── index.ts              # 入口點
│   ├── SwaggerMcpServer.ts   # 主服務器類
│   ├── parsers/              # Swagger 解析器
│   │   ├── SwaggerParser.ts  # 基礎解析器
│   │   ├── OpenApi2Parser.ts # OpenAPI 2.0 解析器
│   │   └── OpenApi3Parser.ts # OpenAPI 3.x 解析器
│   ├── generators/           # 工具生成器
│   │   ├── ToolGenerator.ts  # MCP 工具生成
│   │   └── SchemaConverter.ts # Schema 轉換
│   ├── proxy/                # API 代理
│   │   ├── ApiProxy.ts       # 請求代理
│   │   └── AuthManager.ts    # 認證管理
│   └── utils/                # 工具函數
│       ├── config.ts         # 設定管理
│       └── logger.ts         # 日誌工具
├── package.json
├── tsconfig.json
└── README.md
```

## 疑難排解

### 無法載入 Swagger 文檔
- 確認 URL 或檔案路徑正確
- 檢查網路連線
- 確認 Swagger 文檔格式正確

### 認證失敗
- 確認 AUTH_TYPE 設定正確
- 檢查 token 是否過期
- 確認認證標頭名稱正確

### 工具未出現在 Claude Desktop
- 確認 SwaggerMcp 服務器正在執行
- 檢查 Claude Desktop 設定檔路徑
- 重新啟動 Claude Desktop

## 授權

MIT License