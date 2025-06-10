# Botanika

A local LLM + tooling (with MCP support) client. All data is stored locally. Bring your own API keys.

## Client Features

| Support  | TTS | STT | Open source | MCP Support | Desktop App | Web App |
|----------|-----|-----|-------------|-------------|-------------|---------|
| Botanika | ✅   | ✅   | ✅           | ✅           | ✅           | ✅       |
| ChatGPT  | ✅   | ✅   | ❌           | ❌           | ❌           | ✅       |
| Copilot  | ✅   | ✅   | ❌           | ❌           | ❌           | ✅       |
| Claude   | ❌   | ❌   | ❌           | ✅           | ✅           | ✅       |
| T3.Chat  | ❌   | ❌   | ❌           | ❌           | ❌           | ✅       |

### Native integrations

If you want to use any of these integrations, add them on the "Settings" page.

| Integration name | Required settings         |
|------------------|---------------------------|
| Google Search    | API key, Search engine ID |
| Spotify          | Client ID, Client Secret  |

### Supported LLM providers

Depending on the provider and model you select, requests might not work reliably.

| Provider   | API key link                                           | Environment variable               |
|------------|--------------------------------------------------------|------------------------------------|
| OpenAI     | [OpenAI](https://platform.openai.com/account/api-keys) | OPENAI_API_KEY                     |
| Groq       | [Groq](https://console.groq.com/keys)                  | GROQ_API_KEY                       |
| OpenRouter | [OpenRouter](https://openrouter.ai/settings/keys)      | OPENROUTER_API_KEY                 |
| Azure      |                                                        | AZURE_RESOURCE_NAME, AZURE_API_KEY |
| Ollama     |                                                        | OLLAMA_URL                         |

### Transcription

If you **don't** want to use OpenAI for transcription, you can use Whisper locally. This requires a bit of setup:

Install [pnpm](https://pnpm.io/installation), then run the following command and wait until the model is downloaded:

```bash
pnpm whisper-tnode download --model large-v1
```

# Run

**You can set your environment variables in the `.env` file or through the "Settings" page.**

```bash
bun install
```

Continuous build
```bash
bun build-ui-dev
```

Start
```bash
bun start-ui-dev
```

## LLM provider

An LLM provider is used to generate most responses.

| Provider name | ENV variable   | API key link                                           |
|---------------|----------------|--------------------------------------------------------|
| OpenAI        | OPENAI_API_KEY | [OpenAI](https://platform.openai.com/account/api-keys) |
| Groq          | GROQ_API_KEY   | [Groq](https://console.groq.com/keys)                  |
