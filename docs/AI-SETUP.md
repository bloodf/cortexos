# AI Setup Guide

> **Configure AI models and tools on CortexOS.**
>
> After installing CortexOS, follow this guide to connect your AI providers.

---

## Quick Links

- **Tool catalog:** [`TOOLS.md`](TOOLS.md) — see all AI tools included
- **How the installer works:** [`ARCHITECT.md`](ARCHITECT.md)
- **Managing API keys securely:** [`SECRETS.md`](SECRETS.md)

---

---

## What is 9Router?

9Router is an **AI gateway** that routes requests to different AI models:

```
Your Request
      │
      ▼
┌──────────────┐
│   9Router    │
│  (Gateway)    │
└──────┬───────┘
       │
       ├──► Claude (OpenAI)
       ├──► GPT (OpenAI)
       ├──► Gemini (Google)
       ├──► Ollama (Local)
       └──► More...
```

---

## Available AI Models

### Cloud Models (via 9Router)

| Model | Provider | Best For |
|-------|----------|----------|
| `cc/claude-opus-4-8` | Claude | Complex reasoning, coding |
| `cc/claude-opus-4-7` | Claude | Complex reasoning, coding |
| `cc/claude-sonnet-4-6` | Claude | Balanced performance |
| `cx/gpt-5.4` | ChatGPT | General tasks |
| `cx/gpt-5.4-mini` | ChatGPT | Fast, efficient |
| `gc/gemini-3-pro-preview` | Gemini | Long context |
| `kimi/kimi-latest` | Kimi | Chinese language |

### Local Models (via Ollama)

| Model | Size | Best For |
|-------|------|----------|
| `llama3.2` | 2GB | General tasks |
| `codellama` | 4GB | Code assistance |
| `nomic-embed-text` | 274MB | Text embeddings |

---

## Configure Qwen Code (9Router)

Qwen Code uses 9Router as its backend.

### Update 9Router Config

```bash
# Run the update skill
/qwen-code:update-9router
```

Or manually:

### 1. Get Available Models

```bash
curl -s http://127.0.0.1:11434/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.data[].id'
```

### 2. Configure Qwen Code

Edit `~/.qwen/settings.json`:

```json
{
  "env": {
    "QWEN_CUSTOM_API_KEY": "your-api-key"
  },
  "modelProviders": {
    "openai": [
      {
        "id": "cc/claude-opus-4-8",
        "name": "Claude Opus",
        "baseUrl": "http://127.0.0.1:11434/v1",
        "envKey": "QWEN_CUSTOM_API_KEY"
      }
    ]
  },
  "model": {
    "name": "cc/claude-opus-4-8"
  }
}
```

---

## Configure Claude Code

### 1. Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

### 2. Configure for 9Router

Create `~/.claude/settings.json`:

```json
{
  "model": {
    "name": "cc/claude-opus-4-8"
  },
  "apiKey": "your-api-key",
  "baseUrl": "http://127.0.0.1:11434/v1"
}
```

---

## Install Ollama (Local AI)

Ollama runs AI models locally - no API costs!

### Install

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Enable Service

```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

### Install Models

```bash
# General purpose
ollama pull llama3.2

# Coding assistant
ollama pull codellama

# Embeddings
ollama pull nomic-embed-text:latest
```

### Use Ollama

```bash
# Chat
ollama run llama3.2

# Generate embeddings
curl -X POST http://localhost:11434/api/embeddings \
  -d '{"model": "nomic-embed-text", "prompt": "Your text here"}'
```

---

## Hermes Agent Setup

Hermes is your AI coding assistant.

### Start Hermes

```bash
# Via systemd (if configured)
sudo systemctl start hermes-gateway-cortex

# Or directly
hermes --profile cortex
```

### Configure Hermes Profile

Edit `~/.hermes/profiles/cortex/config.yaml`:

```yaml
model:
  provider: 9router
  baseUrl: http://127.0.0.1:11434/v1
  id: cc/claude-opus-4-8

memory:
  provider: honcho
  baseUrl: http://127.0.0.1:18690
```

---

## API Examples

### Direct 9Router API

```bash
# List models
curl http://127.0.0.1:11434/v1/models

# Chat completion
curl http://127.0.0.1:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "model": "cc/claude-opus-4-8",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## Troubleshooting

### 9Router not responding

```bash
docker logs 9router
docker restart 9router
```

### Ollama not responding

```bash
systemctl status ollama
journalctl -u ollama -n 50
```

### Model not available

```bash
# Check 9Router logs
docker logs 9router

# Check available models
curl http://127.0.0.1:11434/v1/models
```

---

## Learn More

| Topic | Doc |
|-------|-----|
| CLI Tools | [CLI-TOOLS.md](CLI-TOOLS.md) |
| Configuration | [CONFIG.md](CONFIG.md) |
| Troubleshooting | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
