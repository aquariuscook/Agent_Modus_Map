# Generic Configuration Prompting Solution

## Problem Statement
The current system only handles email configuration specifically, but a truly generic configuration prompting solution should collect ALL required configuration parameters during the prompt-to-swarm process and make them available at deployment time for any type of swarm.

## Solution Overview

I'll implement a generic configuration prompting system that:

1. **Detects configuration requirements during prompt-to-swarm generation**
2. **Collects all necessary configuration parameters automatically** 
3. **Stores these requirements with the swarm definition**
4. **Provides configuration prompts at deployment time**
5. **Supports any type of service or external dependency**

## Implementation Plan

### 1. Enhanced Swarm Type Definition

First, I'll modify the Swarm type to include configuration requirements:

```typescript
// In src/shared/types/index.ts (or create a new file)
export interface SwarmConfigRequirement {
  id: string;
  parameterName: string;
  type: 'string' | 'number' | 'boolean' | 'password' | 'select' | 'multiselect';
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For select/multiselect types
  validationRegex?: string;
  validationMessage?: string;
}

export interface Swarm {
  id: string;
  name: string;
  description: string;
  templateSource?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  layers: LayerDefinition[];
  agents: Agent[];
  relationships: Relationship[];
  configRequirements?: SwarmConfigRequirement[]; // NEW FIELD
}
```

### 2. Enhanced Swarm Generator Service

```typescript
// In src/api/services/swarm-generator-service.ts
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import { getModelForTier, getCheapestModel, NoProviderAvailableError, callGenerateObject } from './provider-router-service.js';
import type { ModelRoute } from './provider-router-service.js';
import type { Swarm, Agent, Relationship, LayerDefinition, Badge, RelationshipType, SwarmConfigRequirement } from '../../shared/types/index.js';
import { v7 as uuidv7 } from 'uuid';

// ... existing code ...

/**
 * Enhanced function to generate swarm with configuration requirements
 */
export async function generateSwarmFromPromptWithConfig(
  prompt: string,
  maxAgents?: number,
  preferCheapest = true
): Promise<{
  swarm: Swarm;
  generated: boolean;
  modelUsed: string;
  configRequirements?: SwarmConfigRequirement[]; // Return detected requirements
  error?: string;
}> {
  const result = await generateSwarmFromPrompt({ prompt, maxAgents, preferCheapest });
  
  // Detect and create configuration requirements based on swarm content
  const configRequirements = detectConfigurationRequirements(result.swarm, prompt);
  
  return {
    ...result,
    configRequirements
  };
}

/**
 * Detect configuration requirements for a generated swarm
 */
function detectConfigurationRequirements(swarm: Swarm, prompt: string): SwarmConfigRequirement[] {
  const requirements: SwarmConfigRequirement[] = [];
  
  // Check for email services
  if (checkForEmailService(swarm)) {
    requirements.push(
      {
        id: 'email-host',
        parameterName: 'email_host',
        type: 'string',
        label: 'Email Host',
        description: 'SMTP server hostname or IP address',
        required: true,
        validationRegex: '^[a-zA-Z0-9.-]+$',
        validationMessage: 'Please enter a valid email host name'
      },
      {
        id: 'email-port',
        parameterName: 'email_port',
        type: 'number',
        label: 'Email Port',
        description: 'SMTP server port number (typically 587 or 465)',
        required: true,
        defaultValue: 587
      },
      {
        id: 'email-username',
        parameterName: 'email_username',
        type: 'string',
        label: 'Email Username',
        description: 'Email account username for authentication',
        required: true
      },
      {
        id: 'email-password',
        parameterName: 'email_password',
        type: 'password',
        label: 'Email Password',
        description: 'Email account password for authentication',
        required: true
      }
    );
  }
  
  // Check for database services
  if (checkForDatabaseService(swarm)) {
    requirements.push(
      {
        id: 'db-host',
        parameterName: 'db_host',
        type: 'string',
        label: 'Database Host',
        description: 'Database server hostname or IP address',
        required: true
      },
      {
        id: 'db-port',
        parameterName: 'db_port',
        type: 'number',
        label: 'Database Port',
        description: 'Database server port number',
        required: true,
        defaultValue: 5432
      },
      {
        id: 'db-name',
        parameterName: 'db_name',
        type: 'string',
        label: 'Database Name',
        description: 'Name of the database to connect to',
        required: true
      },
      {
        id: 'db-username',
        parameterName: 'db_username',
        type: 'string',
        label: 'Database Username',
        description: 'Database user account name',
        required: true
      },
      {
        id: 'db-password',
        parameterName: 'db_password',
        type: 'password',
        label: 'Database Password',
        description: 'Database user password',
        required: true
      }
    );
  }
  
  // Check for API services (e.g., OpenAI, GitHub, etc.)
  if (checkForApiService(swarm)) {
    requirements.push(
      {
        id: 'api-key',
        parameterName: 'api_key',
        type: 'password',
        label: 'API Key',
        description: 'Authentication key for external API service',
        required: true
      }
    );
  }
  
  // Check for cloud services (AWS, GCP, Azure)
  if (checkForCloudService(swarm)) {
    requirements.push(
      {
        id: 'cloud-provider',
        parameterName: 'cloud_provider',
        type: 'select',
        label: 'Cloud Provider',
        description: 'Select your cloud provider',
        required: true,
        options: ['aws', 'gcp', 'azure'],
        defaultValue: 'aws'
      },
      {
        id: 'region',
        parameterName: 'region',
        type: 'string',
        label: 'Region',
        description: 'Cloud region for deployment',
        required: true
      }
    );
  }
  
  // Check for file system requirements
  if (checkForFileSystemService(swarm)) {
    requirements.push(
      {
        id: 'storage-path',
        parameterName: 'storage_path',
        type: 'string',
        label: 'Storage Path',
        description: 'File system path for data storage',
        required: true
      }
    );
  }
  
  // Check for prompt keywords that might indicate other requirements
  const promptLower = prompt.toLowerCase();
  if (promptLower.includes('slack') || promptLower.includes('messaging')) {
    requirements.push({
      id: 'slack-token',
      parameterName: 'slack_token',
      type: 'password',
      label: 'Slack Bot Token',
      description: 'Slack bot token for integration',
      required: true
    });
  }
  
  if (promptLower.includes('twitter') || promptLower.includes('social')) {
    requirements.push({
      id: 'twitter-api-key',
      parameterName: 'twitter_api_key',
      type: 'password',
      label: 'Twitter API Key',
      description: 'Twitter API authentication key',
      required: true
    });
  }
  
  return requirements;
}

/**
 * Service detection functions
 */
function checkForEmailService(swarm: Swarm): boolean {
  if (!swarm || !swarm.agents) return false;
  
  const emailKeywords = ['email', 'mail', 'smtp', 'imap'];
  return swarm.agents.some(agent =>
    agent.nickname?.toLowerCase().includes('email') ||
    agent.formalName?.toLowerCase().includes('email') ||
    agent.descriptor?.toLowerCase().includes('email') ||
    agent.config?.skills?.some(skill => skill.includes('email')) ||
    agent.config?.emailConfig
  );
}

function checkForDatabaseService(swarm: Swarm): boolean {
  if (!swarm || !swarm.agents) return false;
  
  const dbKeywords = ['database', 'db', 'sql', 'postgres', 'mysql', 'mongodb'];
  return swarm.agents.some(agent =>
    agent.nickname?.toLowerCase().includes('db') ||
    agent.formalName?.toLowerCase().includes('database') ||
    agent.descriptor?.toLowerCase().includes('database') ||
    agent.config?.skills?.some(skill => skill.includes('database'))
  );
}

function checkForApiService(swarm: Swarm): boolean {
  if (!swarm || !swarm.agents) return false;
  
  const apiKeywords = ['api', 'openai', 'anthropic', 'github', 'rest', 'graphql'];
  return swarm.agents.some(agent =>
    agent.config?.skills?.some(skill => skill.includes('api')) ||
    agent.descriptor?.toLowerCase().includes('api')
  );
}

function checkForCloudService(swarm: Swarm): boolean {
  if (!swarm || !swarm.agents) return false;
  
  const cloudKeywords = ['cloud', 'aws', 'gcp', 'azure', 'ec2', 'compute'];
  return swarm.agents.some(agent =>
    agent.descriptor?.toLowerCase().includes('cloud') ||
    agent.config?.skills?.some(skill => skill.includes('cloud'))
  );
}

function checkForFileSystemService(swarm: Swarm): boolean {
  if (!swarm || !swarm.agents) return false;
  
  const fsKeywords = ['file', 'storage', 'disk', 'path', 'directory'];
  return swarm.agents.some(agent =>
    agent.descriptor?.toLowerCase().includes('file') ||
    agent.config?.skills?.some(skill => skill.includes('file'))
  );
}
```

### 3. Enhanced Swarm Service

```typescript
// In src/api/services/swarm-service.ts
// Add this method to get configuration requirements for a swarm
export function getSwarmConfigRequirements(swarmId: string): SwarmConfigRequirement[] | null {
  const swarm = this.loadSwarm(swarmId);
  if (!swarm) return null;
  
  return swarm.configRequirements || [];
}

// Add this method to update swarm with configuration requirements
export function updateSwarmConfigRequirements(swarmId: string, requirements: SwarmConfigRequirement[]): boolean {
  const existing = this.db.prepare('SELECT id FROM swarms WHERE id = ?').get(swarmId);
  if (!existing) return false;
  
  // Update the swarm with configuration requirements
  this.db.prepare(
    'UPDATE swarms SET config_requirements = ? WHERE id = ?'
  ).run(JSON.stringify(requirements), swarmId);
  
  this.touchSwarm(swarmId);
  return true;
}
```

### 4. Enhanced Deployment Service

```typescript
// In src/api/services/swarm-deployment-service.ts
import type Database from 'better-sqlite3';
import { SwarmService } from './swarm-service.js';
import { deploySwarm, type DeployConfig } from './swarm-runtime-service.js';
import type { SwarmConfigRequirement } from '../../shared/types/index.js';

export interface DeploymentConfig {
  swarmId: string;
  configParams: Record<string, any>;
  status: 'pending' | 'config_required' | 'deployed' | 'error';
  createdAt: string;
  updatedAt: string;
  requiredConfigs?: SwarmConfigRequirement[]; // Store the requirements for reference
}

const deploymentConfigs = new Map<string, DeploymentConfig>();

// ... existing code ...

export async function deploySwarmWithConfig(
  swarmId: string,
  query: string,
  schedule: 'once' | 'hourly' | 'daily' | 'weekly',
  swarmService: SwarmService,
  budgetLimit?: number
): Promise<DeployConfig> {
  const config = getDeploymentConfig(swarmId);
  
  // Get the swarm to check for required configurations
  const swarm = swarmService.findById(swarmId);
  if (!swarm) {
    throw new Error('Swarm not found');
  }
  
  // Check if this swarm requires configuration
  if (swarm.configRequirements && swarm.configRequirements.length > 0) {
    // If config is not provided or incomplete, mark as config_required
    if (!config || !config.configParams) {
      updateDeploymentConfig(swarmId, { 
        status: 'config_required',
        requiredConfigs: swarm.configRequirements,
        updatedAt: new Date().toISOString()
      });
      throw new Error(`Configuration required for swarm deployment. Required parameters: ${swarm.configRequirements.map(r => r.parameterName).join(', ')}`);
    }
    
    // Validate that all required configs are present
    const missingConfigs = swarm.configRequirements.filter(req => req.required && !config.configParams[req.parameterName]);
    if (missingConfigs.length > 0) {
      updateDeploymentConfig(swarmId, { 
        status: 'config_required',
        requiredConfigs: swarm.configRequirements,
        updatedAt: new Date().toISOString()
      });
      throw new Error(`Missing configuration parameters: ${missingConfigs.map(r => r.parameterName).join(', ')}`);
    }
  }
  
  // Proceed with deployment
  const deployConfig = deploySwarm(swarmId, query, schedule, swarmService, budgetLimit);
  
  // Mark as deployed
  updateDeploymentConfig(swarmId, { 
    status: 'deployed',
    updatedAt: new Date().toISOString()
  });
  
  return deployConfig;
}
```

### 5. Enhanced API Routes

```typescript
// In src/api/routes/swarm-routes.ts
// Add endpoint to get swarm configuration requirements
router.get('/:id/config-requirements', (req: Req, res: Response) => {
  try {
    const requirements = swarmService.getSwarmConfigRequirements(req.params.id);
    if (!requirements) {
      res.status(404).json({ error: 'not_found', message: 'Swarm or configuration requirements not found.' });
      return;
    }
    res.json({ data: requirements });
  } catch (err) {
    res.status(500).json({ error: 'internal_error', message: 'Failed to retrieve configuration requirements.' });
  }
});

// Add endpoint to update swarm with configuration requirements
router.put('/:id/config-requirements', (req: Req, res: Response) => {
  try {
    const success = swarmService.updateSwarmConfigRequirements(req.params.id, req.body.requirements || []);
    if (!success) {
      res.status(404).json({ error: 'not_found', message: 'Swarm not found.' });
      return;
    }
    res.json({ message: 'Configuration requirements updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'internal_error', message: 'Failed to update configuration requirements.' });
  }
});
```

## Usage Example

### 1. Generate swarm with configuration requirements:
```bash
POST /api/swarms/generate
{
  "prompt": "Create an email management system that can send and receive emails using SMTP"
}

// Response includes configRequirements:
{
  "data": {
    "swarm": { /* swarm definition */ },
    "configRequirements": [
      {
        "id": "email-host",
        "parameterName": "email_host",
        "type": "string",
        "label": "Email Host",
        "description": "SMTP server hostname or IP address",
        "required": true
      },
      {
        "id": "email-port",
        "parameterName": "email_port",
        "type": "number",
        "label": "Email Port",
        "description": "SMTP server port number",
        "required": true,
        "defaultValue": 587
      }
    ]
  }
}
```

### 2. Deploy swarm with configuration:
```bash
POST /api/swarms/{swarmId}/deploy
{
  "query": "Manage email communications",
  "schedule": "hourly",
  "config": {
    "email_host": "smtp.gmail.com",
    "email_port": 587,
    "email_username": "user@gmail.com",
    "email_password": "password123"
  }
}
```

## Benefits of This Generic Solution

1. **Comprehensive Coverage**: Automatically detects configuration requirements for any service type
2. **Extensible Design**: Easy to add new service detection and configuration types
3. **User-Friendly**: Clear prompts with descriptive labels and validation
4. **Future-Proof**: Can handle any new external services without major code changes
5. **Consistent Interface**: Uniform configuration parameter handling across all swarm types

This generic solution provides a robust framework that can be extended to support any type of external service configuration while maintaining the flexibility to prompt for exactly what's needed for each specific swarm.