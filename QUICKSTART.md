# SwaggerMcp 快速開始指南

## 1. 安裝依賴

```bash
npm install
```

## 2. 建構專案

```bash
npm run build
```

## 3. 設定環境變數

建立 `.env` 檔案（從 `.env.sample` 複製）：

```bash
cp .env.sample .env
```

編輯 `.env` 設定您的 API：

```env
SWAGGER_URL=https://your-api.com/swagger.json
AUTH_TYPE=bearer
AUTH_TOKEN=your-token-here
```

## 4. 設定 Claude Desktop

找到您的 Claude Desktop 設定檔：
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

加入 SwaggerMcp 設定：

```json
{
  "mcpServers": {
    "swagger-mcp": {
      "command": "node",
      "args": ["完整路徑/SwaggerMcp/dist/index.js"],
      "env": {
        "SWAGGER_URL": "https://your-api.com/swagger.json",
        "AUTH_TYPE": "bearer",
        "AUTH_TOKEN": "your-token-here"
      }
    }
  }
}
```

## 5. 重新啟動 Claude Desktop

關閉並重新開啟 Claude Desktop，您的 API 工具應該就會出現在對話中。

## 測試範例

使用一般 Swagger API：

```json
{
  "mcpServers": {
    "swagger-api": {
      "command": "node",
      "args": ["D:/Coding/js/SwaggerMcp/dist/index.js"],
      "env": {
        "SWAGGER_URL": "https://api.example.com/swagger.json",
        "AUTH_TYPE": "bearer",
        "AUTH_TOKEN": "your-jwt-token",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

**提示**：如果 API 使用相對 URL，請設定 `API_BASE_URL` 環境變數。

啟動後，您可以在 Claude 中說：
- "列出所有可用的 API"
- "使用 signin API 登入"
- "建立一個新的應用程式"

## 疑難排解

### 檢查日誌

設定 `LOG_LEVEL=debug` 可以看到詳細的日誌資訊。

### 常見問題

1. **工具未出現**：確認路徑正確且 Claude Desktop 已重新啟動
2. **認證失敗**：檢查 token 是否正確且未過期
3. **無法載入 Swagger**：確認 URL 可以存取且格式正確