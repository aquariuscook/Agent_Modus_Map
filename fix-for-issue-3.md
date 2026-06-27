# Fix for GitHub Issue #3: Email Manager Deployment Configuration

## Problem Analysis
The issue is that when using a prompt to swarm deploy an email manager, the system does not ask for necessary connection information to link with an email service during deployment. This suggests that the deployment workflow doesn't properly collect configuration parameters needed for email services.

## Solution Approach
I'll implement a configuration collection system for swarms that need external service connections like email services.

## Files to Modify

### 1. src/api/services/swarm-deployment-service.ts (new file)
```typescript
// Swarm Deployment Service - handles deployment with configuration collection
import type Database from 'better-sqlite3';
import { SwarmService } from './swarm-service.js';
import { deploySwarm, type DeployConfig } from './swarm-runtime-service.js';

export interface DeploymentConfig {
  swarmId: string;
  configParams: Record<string, any>;
  status: 'pending' | 'config_required' | 'deployed' | 'error';
  createdAt: string;
  updatedAt: string;
}

const deploymentConfigs = new Map<string, DeploymentConfig>();

export function createDeploymentConfig(
  swarmId: string,
  configParams: Record<string, any>
): DeploymentConfig {
  const config: DeploymentConfig = {
    swarmId,
    configParams,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  deploymentConfigs.set(swarmId, config);
  return config;
}

export function getDeploymentConfig(swarmId: string): DeploymentConfig | null {
  return deploymentConfigs.get(swarmId) || null;
}

export function updateDeploymentConfig(
  swarmId: string,
  updates: Partial<DeploymentConfig>
): DeploymentConfig | null {
  const config = deploymentConfigs.get(swarmId);
  if (!config) return null;
  
  Object.assign(config, updates);
  config.updatedAt = new Date().toISOString();
  deploymentConfigs.set(swarmId, config);
  
  return config;
}

export async function deploySwarmWithConfig(
  swarmId: string,
  query: string,
  schedule: 'once' | 'hourly' | 'daily' | 'weekly',
  swarmService: SwarmService,
  budgetLimit?: number,
  requiredConfigs?: string[]
): Promise<DeployConfig> {
  const config = getDeploymentConfig(swarmId);
  
  // Check if this swarm requires configuration
  if (requiredConfigs && requiredConfigs.length > 0) {
    // If config is not provided or incomplete, mark as config_required
    if (!config || !config.configParams) {
      updateDeploymentConfig(swarmId, { 
        status: 'config_required',
        updatedAt: new Date().toISOString()
      });
      throw new Error(`Configuration required for swarm deployment. Required parameters: ${requiredConfigs.join(', ')}`);
    }
    
    // Validate that all required configs are present
    const missingConfigs = requiredConfigs.filter(param => !config.configParams[param]);
    if (missingConfigs.length > 0) {
      updateDeploymentConfig(swarmId, { 
        status: 'config_required',
        updatedAt: new Date().toISOString()
      });
      throw new Error(`Missing configuration parameters: ${missingConfigs.join(', ')}`);
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

export function listPendingDeployments(): DeploymentConfig[] {
  const pending = [];
  for (const [_, config] of deploymentConfigs) {
    if (config.status === 'config_required') {
      pending.push(config);
    }
  }
  return pending;
}
```

### 2. Update src/api/routes/swarm-routes.ts to include deployment endpoints
```typescript
// Add this import at the top with other imports
import { 
  createDeploymentConfig, 
  getDeploymentConfig, 
  updateDeploymentConfig,
  deploySwarmWithConfig,
  listPendingDeployments 
} from '../services/swarm-deployment-service.js';

// Add these new endpoints to the routes (before return router;)
// POST /api/swarms/:id/deploy - Deploy a swarm with configuration
router.post('/:id/deploy', async (req: Req, res: Response) => {
  const { query, schedule, budgetLimit, requiredConfigs } = req.body;
  
  try {
    // Validate required parameters
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'validation', message: 'Query is required.' });
      return;
    }
    
    const swarm = swarmService.findById(req.params.id);
    if (!swarm) {
      res.status(404).json({ error: 'not_found', message: 'Swarm not found.' });
      return;
    }
    
    // Create deployment configuration
    const configParams = req.body.config || {};
    createDeploymentConfig(req.params.id, configParams);
    
    // Deploy the swarm with configuration
    const deployConfig = await deploySwarmWithConfig(
      req.params.id,
      query,
      schedule || 'once',
      swarmService,
      budgetLimit,
      requiredConfigs
    );
    
    res.status(201).json({ 
      data: deployConfig,
      message: 'Deployment started successfully'
    });
  } catch (err: any) {
    if (err.message.includes('Configuration required') || err.message.includes('Missing configuration')) {
      // Return specific error for missing config
      res.status(400).json({
        error: 'config_required',
        message: err.message,
        swarmId: req.params.id,
        requiredConfigs: requiredConfigs || []
      });
    } else {
      res.status(500).json({ 
        error: 'deployment_failed', 
        message: err.message || 'Deployment failed.' 
      });
    }
  }
});

// GET /api/swarms/:id/deploy/config - Get deployment configuration
router.get('/:id/deploy/config', (req: Req, res: Response) => {
  const config = getDeploymentConfig(req.params.id);
  if (!config) {
    res.status(404).json({ error: 'not_found', message: 'Deployment configuration not found.' });
    return;
  }
  res.json({ data: config });
});

// PUT /api/swarms/:id/deploy/config - Update deployment configuration
router.put('/:id/deploy/config', (req: Req, res: Response) => {
  const config = updateDeploymentConfig(req.params.id, { 
    configParams: req.body.config || {},
    updatedAt: new Date().toISOString()
  });
  
  if (!config) {
    res.status(404).json({ error: 'not_found', message: 'Deployment configuration not found.' });
    return;
  }
  
  res.json({ data: config });
});

// GET /api/swarms/deploy/pending - List pending deployments requiring configuration
router.get('/deploy/pending', (req: Req, res: Response) => {
  const pending = listPendingDeployments();
  res.json({ data: pending });
});
```

### 3. Update the swarm generator to detect email-related swarms
```typescript
// In src/api/services/swarm-generator-service.ts, add this function:
export async function generateSwarmFromPromptWithConfig(
  prompt: string,
  maxAgents?: number,
  preferCheapest = true
): Promise<{
  swarm: any;
  generated: boolean;
  modelUsed: string;
  requiredConfigs?: string[];
  error?: string;
}> {
  const result = await generateSwarmFromPrompt({ prompt, maxAgents, preferCheapest });
  
  // Check if this swarm needs email configuration
  const swarm = result.swarm;
  const requiresEmailConfig = checkForEmailService(swarm);
  
  let requiredConfigs: string[] = [];
  if (requiresEmailConfig) {
    requiredConfigs = ['email_host', 'email_port', 'email_username', 'email_password'];
  }
  
  return {
    ...result,
    requiredConfigs
  };
}

function checkForEmailService(swarm: any): boolean {
  // Check for email-related agents or configurations in the swarm
  if (!swarm || !swarm.agents) return false;
  
  return swarm.agents.some((agent: any) => 
    agent.name?.toLowerCase().includes('email') ||
    agent.type?.toLowerCase().includes('email') ||
    agent.description?.toLowerCase().includes('email') ||
    agent.instructions?.toLowerCase().includes('email')
  );
}
```

## How This Fix Works

1. **Configuration Collection**: When deploying a swarm that requires email configuration, the system now prompts for required parameters
2. **Deployment Flow**: 
   - Swarm generation happens normally
   - If email service is detected, required config parameters are identified
   - Deployment process checks for configuration before proceeding
   - Users can provide configuration via API or UI
3. **Error Handling**: Clear error messages indicate what configuration is needed

## Usage Example

When a user deploys an email manager swarm:

```bash
# First, generate the swarm (this will detect email requirements)
POST /api/swarms/generate
{
  "prompt": "Create an email manager that can send and receive emails"
}

# Then deploy with required configuration
POST /api/swarms/{swarmId}/deploy
{
  "query": "Manage email communications",
  "schedule": "hourly",
  "requiredConfigs": ["email_host", "email_port", "email_username", "email_password"],
  "config": {
    "email_host": "smtp.gmail.com",
    "email_port": 587,
    "email_username": "user@gmail.com",
    "email_password": "password123"
  }
}
```

This solution ensures that when users deploy swarms that require external service connections (like email), they are prompted for the necessary configuration parameters rather than silently failing.