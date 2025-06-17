# Botanika

A chat app. Bring your own API keys.

## Client Features

- ✅ Fully supported
- 🆗 Partially supported
- ❌ Not supported

| Support  | TTS | STT | Open source | MCP Support | Desktop App | Web App | BYOK | File support | Image generation |
|----------|-----|-----|-------------|-------------|-------------|---------|------|--------------|------------------|
| Botanika | ✅   | ✅   | ✅           | ✅           | 🆗          | ✅       | ✅    | ✅            | ❌                |
| T3.Chat  | ❌   | ❌   | ❌           | ❌           | ❌           | ✅       | 🆗   | ✅            | ✅                |
| ChatGPT  | ✅   | ✅   | ❌           | ❌           | ❌           | ✅       | ❌    | ✅            | ✅                |
| Copilot  | ✅   | ✅   | ❌           | ❌           | ❌           | ✅       | ❌    | ✅            | ✅                |
| Claude   | ❌   | ❌   | ❌           | ✅           | ✅           | ✅       | ❌    | ✅            | ❌                |
| Gemini   | ✅   | ✅   | ❌           | ❌           | ❌           | ✅       | ❌    | ✅            | ✅                |

## Run

This app uses PostgreSQL as a database. You can run it locally or use Docker Compose for a complete setup.

**You can set your environment variables in the `.env` file. Copy [.env.example](.env.example) and fill in the values.**

### Local Development

```bash
bun install

# Generate Prisma client
bunx prisma generate

bun build-ui-dev

bun start-ui-dev
```

### Docker Compose

The easiest way to run the application is using Docker Compose, which will set up both the application and the PostgreSQL database:

```bash
docker-compose up -d -f docker-compose.prod.yml
```

Make sure you have all necessary [environment variables](.env.example) configured.

The PostgreSQL database will be initialized with the schema defined in [db_setup.sql](src/api/database/db_setup.sql).

## Integrations

If you want to use any of these integrations, add them on the "Settings" page.

| Integration name | Required settings                                                                                                                                     |
|------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| Google Search    | [Get API key](https://console.cloud.google.com/apis/dashboard) - [Get Search engine ID](https://programmablesearchengine.google.com/controlpanel/all) |

### Supported LLM providers

Depending on the provider and model you select, requests might not work reliably.

| Provider   | API key link                                                                          |
|------------|---------------------------------------------------------------------------------------|
| OpenAI     | [OpenAI](https://platform.openai.com/account/api-keys)                                |
| Groq       | [Groq](https://console.groq.com/keys)                                                 |
| OpenRouter | [OpenRouter](https://openrouter.ai/settings/keys)                                     |
| Azure      | Needs resource name and api key                                                       |
| Ollama     | No key, use Ollama URL - if you host locally, you can use [ngrok](https://ngrok.com/) |
