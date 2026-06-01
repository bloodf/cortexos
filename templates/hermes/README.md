# Hermes Agent Templates

Hermes is the primary Codex-style AI agent running inside CortexOS Incus instances.

## Structure

```
hermes/
├── profile-template.json     # Profile configuration template
├── profile-wrapper.sh       # Wrapper script for profile startup
├── cortex/                  # Default Cortex profile
│   └── SOUL.md            # Agent personality
├── skills/                  # Hermes skills
│   ├── 9router/           # 9Router integration
│   ├── 9router-chat/
│   ├── 9router-web-search/
│   ├── 9router-web-fetch/
│   ├── 9router-image/
│   ├── 9router-tts/
│   ├── 9router-stt/
│   ├── 9router-embeddings/
│   └── cortex-factory-creation/
└── filesystem-mcp.yaml     # MCP server config
```

## Profile Configuration

Each Hermes profile needs:

```json
{
  "profile": "myprofile",
  "home": "/opt/cortexos/hermes/profiles/myprofile",
  "api": {
    "host": "127.0.0.1",
    "port": 8932,
    "publicPath": "/hermes/myprofile/v1"
  },
  "model": {
    "provider": "9router",
    "baseUrl": "http://127.0.0.1:11434/v1",
    "id": "cc/claude-opus-4-8",
    "reasoning": true
  },
  "memory": {
    "provider": "honcho",
    "baseUrl": "http://127.0.0.1:18690",
    "workspace": "myprofile"
  }
}
```

## Running Hermes

```bash
# Start a profile
./profile-wrapper.sh myprofile

# Or via systemd
sudo systemctl start hermes-gateway-myprofile.service
```

## 9Router Skills

Hermes uses 9Router for all AI model access:

| Skill | Purpose |
|-------|---------|
| 9router-chat | Chat completions |
| 9router-web-search | Web search |
| 9router-web-fetch | Web page fetch |
| 9router-image | Image generation |
| 9router-tts | Text-to-speech |
| 9router-stt | Speech-to-text |
| 9router-embeddings | Text embeddings |

## Incus Integration

Hermes runs inside Incus project instances:
1. Each project has its own Hermes profile
2. Profiles connect to host 9Router via proxy
3. Sessions and memory persist in instance storage
