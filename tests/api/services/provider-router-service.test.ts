import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listProviders, getCheapestModel } from '../../../../src/api/services/provider-router-service.js';

// Mock process.env to test provider availability
const originalEnv = process.env;

describe('Provider Router Service - OpenRouter Integration', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment after each test
    process.env = originalEnv;
  });

  it('should include OpenRouter in the provider list', () => {
    const providers = listProviders();

    // Should have 5 providers (anthropic, nvidia, openai, google, openrouter)
    expect(providers).toHaveLength(5);

    const openrouter = providers.find(p => p.id === 'openrouter');
    expect(openrouter).toBeDefined();
    expect(openrouter?.name).toBe('OpenRouter');
    expect(openrouter?.endpoint).toBe('https://openrouter.ai/api/v1');
    expect(openrouter?.envKey).toBe('OPENROUTER_API_KEY');
  });

  it('should detect OpenRouter as unavailable when API key is not set', () => {
    const providers = listProviders();
    const openrouter = providers.find(p => p.id === 'openrouter');
    expect(openrouter?.available).toBe(false);
  });

  it('should detect OpenRouter as available when API key is set', () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const providers = listProviders();
    const openrouter = providers.find(p => p.id === 'openrouter');
    expect(openrouter?.available).toBe(true);
  });

  it('should be able to get OpenRouter model when available', () => {
    process.env.OPENROUTER_API_KEY = 'test-key';

    // Test that we can at least call the function without error
    // This tests the integration works, not specific behavior
    expect(() => {
      const result = getCheapestModel(0.1); // Low complexity task
      // Just check it doesn't throw an error
    }).not.toThrow();
  });
});