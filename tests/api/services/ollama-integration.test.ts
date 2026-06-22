import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listProviders, getModelForTier } from '../../../src/api/services/provider-router-service.js';

// Mock process.env to test provider availability
const originalEnv = process.env;

describe('Ollama Integration', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment after each test
    process.env = originalEnv;
  });

  it('should include Ollama in the provider list', () => {
    const providers = listProviders();

    // Should have 6 providers (anthropic, nvidia, openai, google, openrouter, ollama)
    expect(providers).toHaveLength(6);

    const ollama = providers.find(p => p.id === 'ollama');
    expect(ollama).toBeDefined();
    expect(ollama?.name).toBe('Ollama Local');
    expect(ollama?.endpoint).toBe('http://localhost:11434/v1');
    expect(ollama?.envKey).toBe('OLLAMA_API_KEY');
  });

  it('should be able to get Ollama model for Tier 3', () => {
    // Test that we can at least call the function without error
    const result = getModelForTier(3);
    expect(result).toBeDefined();
    expect(result.route.provider).toBe('ollama');
  });

  it('should handle missing Ollama gracefully', () => {
    // With no API key set, Ollama should be treated as unavailable but still listed
    const providers = listProviders();
    const ollama = providers.find(p => p.id === 'ollama');
    expect(ollama?.available).toBe(false); // Because env var is not set

    // But the provider itself should exist in the list
    expect(ollama).toBeDefined();
  });
});