# Ollama Integration Guide

## Overview

Agent Modus Map now supports local LLM processing via Ollama. This enables running large language models locally without requiring internet connectivity or cloud API keys.

## Installation and Setup

1. Install [Ollama](https://ollama.com/download) on your system
2. Pull a model for use with Agent Modus Map:
   ```bash
   ollama pull qwen3-coder:30b
   ```
3. Start Ollama service (typically runs automatically on startup)

## Configuration

Ollama integration works locally without requiring API keys:

- **Endpoint**: `http://localhost:11434/v1`
- **No API key required** - Ollama local instances don't require authentication
- **Model**: Default is `qwen3-coder:30b` (can be overridden)

## Usage

### In the Application

Ollama will automatically be available for all prompt-to-swarm generation tasks when running locally. It's configured as Tier 3 provider in the routing system.

### Via CLI Agents

```bash
npx claude-flow agent spawn -t coder -p ollama
```

## Benefits

- **Local Processing**: No network connectivity required
- **Privacy**: All processing stays local
- **Cost**: Free to use (no API costs)
- **Performance**: Can be faster than cloud APIs for local setups

## Limitations

- Requires Ollama installation and running service
- Model availability depends on what's pulled in your local Ollama instance
- May have different performance characteristics than cloud providers