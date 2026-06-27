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
  budgetLimit?: number
): Promise<DeployConfig> {
  const config = getDeploymentConfig(swarmId);

  // Get the swarm to check for required configurations
  const swarm = swarmService.findById(swarmId);
  if (!swarm) {
    throw new Error('Swarm not found');
  }

  // Check if this swarm requires configuration from its own stored requirements
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

export function listPendingDeployments(): DeploymentConfig[] {
  const pending = [];
  for (const [_, config] of deploymentConfigs) {
    if (config.status === 'config_required') {
      pending.push(config);
    }
  }
  return pending;
}