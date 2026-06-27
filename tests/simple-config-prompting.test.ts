import { describe, it, expect } from 'vitest';
import { detectConfigurationRequirements } from '../src/api/services/swarm-generator-service.js';

describe('Simple Configuration Prompting Tests', () => {
  it('should detect email configuration requirements', () => {
    // Test with an email-related prompt
    const prompt = 'Create an email manager that can send and receive emails using SMTP';
    const requirements = detectConfigurationRequirements({ agents: [] } as any, prompt);

    expect(requirements).toBeDefined();
    expect(requirements.length).toBeGreaterThan(0);

    // Should contain email-related requirements
    const hasEmailHost = requirements.some(r => r.parameterName === 'email_host');
    expect(hasEmailHost).toBe(true);
  });

  it('should detect database configuration requirements', () => {
    // Test with a database-related prompt
    const prompt = 'Create a PostgreSQL database connection service';
    const requirements = detectConfigurationRequirements({ agents: [] } as any, prompt);

    expect(requirements).toBeDefined();
    expect(requirements.length).toBeGreaterThan(0);

    // Should contain database-related requirements
    const hasDbHost = requirements.some(r => r.parameterName === 'db_host');
    expect(hasDbHost).toBe(true);
  });

  it('should detect API configuration requirements', () => {
    // Test with an API-related prompt
    const prompt = 'Create an OpenAI integration service';
    const requirements = detectConfigurationRequirements({ agents: [] } as any, prompt);

    expect(requirements).toBeDefined();
    expect(requirements.length).toBeGreaterThan(0);

    // Should contain API-related requirements
    const hasApiKey = requirements.some(r => r.parameterName === 'api_key');
    expect(hasApiKey).toBe(true);
  });

  it('should handle empty prompts gracefully', () => {
    const prompt = '';
    const requirements = detectConfigurationRequirements({ agents: [] } as any, prompt);

    // Should return empty array for no requirements
    expect(requirements).toBeDefined();
    expect(requirements.length).toBe(0);
  });
});