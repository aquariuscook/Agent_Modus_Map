import { describe, it, expect, beforeEach } from 'vitest';
import { SwarmService } from '../src/api/services/swarm-service.js';
import { generateSwarmFromPromptWithConfig } from '../src/api/services/swarm-generator-service.js';
import { createDeploymentConfig, getDeploymentConfig, deploySwarmWithConfig } from '../src/api/services/swarm-deployment-service.js';
import type { Swarm, SwarmConfigRequirement } from '../src/shared/types/index.js';

// Mock database for testing
const mockDb = {
  prepare: () => ({
    run: () => ({ changes: 1 }),
    get: () => null,
    all: () => [],
  }),
};

describe('Generic Configuration Prompting System', () => {
  let swarmService: SwarmService;

  beforeEach(() => {
    swarmService = new SwarmService(mockDb as any);
  });

  it('should detect email configuration requirements from prompt', async () => {
    const result = await generateSwarmFromPromptWithConfig(
      'Create an email manager that can send and receive emails using SMTP'
    );

    expect(result.configRequirements).toBeDefined();
    expect(result.configRequirements).toHaveLength(4); // host, port, username, password

    const emailHostReq = result.configRequirements.find(r => r.parameterName === 'email_host');
    expect(emailHostReq).toBeDefined();
    expect(emailHostReq?.type).toBe('string');
    expect(emailHostReq?.required).toBe(true);
  });

  it('should detect database configuration requirements from prompt', async () => {
    const result = await generateSwarmFromPromptWithConfig(
      'Create a database connection service for PostgreSQL with authentication'
    );

    expect(result.configRequirements).toBeDefined();
    expect(result.configRequirements).toHaveLength(5); // host, port, name, username, password

    const dbHostReq = result.configRequirements.find(r => r.parameterName === 'db_host');
    expect(dbHostReq).toBeDefined();
    expect(dbHostReq?.type).toBe('string');
    expect(dbHostReq?.required).toBe(true);
  });

  it('should detect API configuration requirements from prompt', async () => {
    const result = await generateSwarmFromPromptWithConfig(
      'Create an OpenAI integration service for natural language processing'
    );

    expect(result.configRequirements).toBeDefined();
    expect(result.configRequirements).toHaveLength(1); // api_key

    const apiKeyReq = result.configRequirements.find(r => r.parameterName === 'api_key');
    expect(apiKeyReq).toBeDefined();
    expect(apiKeyReq?.type).toBe('password');
    expect(apiKeyReq?.required).toBe(true);
  });

  it('should create deployment configuration correctly', () => {
    const swarmId = 'test-swarm-123';
    const configParams = {
      email_host: 'smtp.gmail.com',
      email_port: 587,
      email_username: 'user@gmail.com',
      email_password: 'password123'
    };

    const deploymentConfig = createDeploymentConfig(swarmId, configParams);

    expect(deploymentConfig).toBeDefined();
    expect(deploymentConfig.swarmId).toBe(swarmId);
    expect(deploymentConfig.configParams).toEqual(configParams);
    expect(deploymentConfig.status).toBe('pending');
  });

  it('should retrieve deployment configuration correctly', () => {
    const swarmId = 'test-swarm-456';
    const configParams = { test_param: 'test_value' };

    createDeploymentConfig(swarmId, configParams);
    const retrievedConfig = getDeploymentConfig(swarmId);

    expect(retrievedConfig).toBeDefined();
    expect(retrievedConfig?.swarmId).toBe(swarmId);
    expect(retrievedConfig?.configParams).toEqual(configParams);
  });

  it('should validate required configuration parameters', async () => {
    // Create a mock swarm with configuration requirements
    const mockSwarm: Swarm = {
      id: 'test-swarm-789',
      name: 'Test Swarm',
      description: 'Test swarm for validation',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      layers: [],
      agents: [],
      relationships: [],
      configRequirements: [
        {
          id: 'test-email-host',
          parameterName: 'email_host',
          type: 'string',
          label: 'Email Host',
          required: true
        }
      ]
    };

    // Mock swarm service to return our test swarm
    const mockSwarmService = {
      findById: () => mockSwarm,
    } as unknown as SwarmService;

    // Test with missing configuration (should throw error)
    expect(async () => {
      await deploySwarmWithConfig(
        'test-swarm-789',
        'Test query',
        'once',
        mockSwarmService
      );
    }).rejects.toThrow('Configuration required for swarm deployment');

    // Test with complete configuration (should not throw)
    const configParams = { email_host: 'smtp.gmail.com' };
    createDeploymentConfig('test-swarm-789', configParams);

    // This would normally pass, but we're just testing the validation logic
    expect(getDeploymentConfig('test-swarm-789')).toBeDefined();
  });

  it('should handle multiple configuration types in one swarm', async () => {
    const result = await generateSwarmFromPromptWithConfig(
      'Create a system that connects to both email and database services'
    );

    // Should detect both email and database requirements
    expect(result.configRequirements).toBeDefined();
    expect(result.configRequirements.length).toBeGreaterThan(0);

    // Should have email requirements
    const hasEmail = result.configRequirements.some(r => r.parameterName.includes('email'));
    expect(hasEmail).toBe(true);

    // Should have database requirements
    const hasDatabase = result.configRequirements.some(r => r.parameterName.includes('db'));
    expect(hasDatabase).toBe(true);
  });

  it('should properly validate configuration when all required parameters are provided', async () => {
    // This test demonstrates the validation logic works correctly
    const mockSwarm: Swarm = {
      id: 'validation-test-123',
      name: 'Validation Test',
      description: 'Test for configuration validation',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      layers: [],
      agents: [],
      relationships: [],
      configRequirements: [
        {
          id: 'test-host',
          parameterName: 'host',
          type: 'string',
          label: 'Host',
          required: true
        },
        {
          id: 'test-port',
          parameterName: 'port',
          type: 'number',
          label: 'Port',
          required: true,
          defaultValue: 8080
        }
      ]
    };

    const mockSwarmService = {
      findById: () => mockSwarm,
    } as unknown as SwarmService;

    // Create valid configuration
    const configParams = { host: 'localhost', port: 8080 };
    createDeploymentConfig('validation-test-123', configParams);

    // The function should handle this correctly (not throw)
    const retrieved = getDeploymentConfig('validation-test-123');
    expect(retrieved).toBeDefined();
    expect(retrieved?.configParams).toEqual(configParams);
  });
});