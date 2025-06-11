# Botanika

A chat app. Bring your own API keys.

## Client Features

| Support  | TTS | STT | Open source | MCP Support | Desktop App | Web App |
|----------|-----|-----|-------------|-------------|-------------|---------|
| Botanika | ✅   | ✅   | ✅           | ✅           | ✅           | ✅       |
| ChatGPT  | ✅   | ✅   | ❌           | ❌           | ❌           | ✅       |
| Copilot  | ✅   | ✅   | ❌           | ❌           | ❌           | ✅       |
| Claude   | ❌   | ❌   | ❌           | ✅           | ✅           | ✅       |
| T3.Chat  | ❌   | ❌   | ❌           | ❌           | ❌           | ✅       |

# Run

This app uses [Supabase](https://supabase.com/) as a database. It is stronlgy recommended to self-host - the free tier should suffice if you use it alone.

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

If you **don't** want to use OpenAI for transcription, you can use Whisper locally. This requires a bit of setup:

Install [pnpm](https://pnpm.io/installation), then run the following command and wait until the model is downloaded:

```bash
pnpm whisper-tnode download --model large-v1
```
