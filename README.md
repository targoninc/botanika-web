# Botanika

A chat app. Bring your own API keys.

## Client Features

- ✅ Fully supported
- 🆗 Partially supported
- ❌ Not supported

| Support  | TTS | STT | Open source | MCP Support | Desktop App | Web App | BYOK | File support |
|----------|-----|-----|-------------|-------------|-------------|---------|------|--------------|
| Botanika | ✅   | ✅   | ✅           | ✅           | ✅           | ✅       | ✅    | ✅            |
| T3.Chat  | ❌   | ❌   | ❌           | ❌           | ❌           | ✅       | 🆗   | ✅            |
| ChatGPT  | ✅   | ✅   | ❌           | ❌           | ❌           | ✅       | ❌    | ✅            |
| Copilot  | ✅   | ✅   | ❌           | ❌           | ❌           | ✅       | ❌    | ✅            |
| Claude   | ❌   | ❌   | ❌           | ✅           | ✅           | ✅       | ❌    | ✅            |

# Run

This app uses PostgreSQL as a database. You can run it locally or use Docker Compose for a complete setup.

**You can set your environment variables in the `.env` file. Just copy `.env.example` and fill in the values.**

### Local Development

```bash
# Install dependencies
bun install

# Generate Prisma client
bunx prisma generate

# Continuous build
bun build-ui-dev

# Start the app
bun start-ui-dev

# Or start the app with automatic database initialization
bun run start-with-db
```

### Docker Compose

The easiest way to run the application is using Docker Compose, which will set up both the application and the PostgreSQL database:

```bash
# Start the application and database
docker-compose up -d

# Stop the application and database
docker-compose down
```

The PostgreSQL database will be initialized with the schema defined in [db_setup.sql](src/api/database/db_setup.sql).

### Database Configuration

The application uses the following environment variables for database connection:

- `DATABASE_URL`: The PostgreSQL connection string (used by Prisma)

### Native integrations

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

### Transcription

Available OpenAI transcription models: `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`, `whisper`

If you **don't** want to use OpenAI for transcription, you can use Whisper locally. This requires a bit of setup:

Install [pnpm](https://pnpm.io/installation), then run the following command and wait until the model is downloaded:

```bash
pnpm whisper-tnode download --model large-v1
```
