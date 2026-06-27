# Configuration Prompting for Swarms Implementation Guide

This document outlines how to implement configuration prompting for swarms based on their capabilities, with focus on the prompt-to-swarm feature and deployment workflows.

## Core Architecture

The system implements a comprehensive swarm management architecture with several key components:

### 1. Swarm Service
- Handles core swarm lifecycle including creation, updates, and deletion
- Manages agents, relationships, and layers within swarms
- Includes specialized methods for configuration detection

### 2. Deployment Service
- Manages deployment configurations and requirements collection
- Implements configuration validation and error handling
- Supports partial configuration updates

### 3. Prompt-to-Swarm Generator
- Converts natural language prompts into structured swarm configurations
- Uses Zod schemas for structured LLM output
- Provides heuristic fallbacks when API keys are unavailable

### 4. Provider Router Service  
- Abstracts LLM provider selection across multiple tiers (NVIDIA NIM, Anthropic, etc.)
- Implements 3-tier routing system for optimal cost/quality balance
- Supports automatic fallback mechanisms

## Configuration Prompting Implementation

### Email Service Detection and Requirements

The system automatically detects when swarms require email configuration:

```typescript
// In swarm-generator-service.ts
export function checkForEmailService(swarm: Swarm): boolean {
  if (!swarm || !swarm.agents) return false;

  // Check for email-related agents or keywords in agent names/descriptions
  return swarm.agents.some(agent =>
    agent.nickname?.toLowerCase().includes('email') ||
    agent.formalName?.toLowerCase().includes('email') ||
    agent.descriptor?.toLowerCase().includes('email') ||
    agent.config?.skills?.some(skill => skill.includes('email')) ||
    agent.config?.emailConfig
  );
}

export function getEmailServiceConfigParams(swarm: Swarm): string[] {
  if (!checkForEmailService(swarm)) return [];

  // Return standard email configuration parameters needed
  return ['email_host', 'email_port', 'email_username', 'email_password'];
}
```

### Deployment Configuration Management

The deployment workflow handles configuration requirements through:

1. **Configuration Creation**:
   ```typescript
   function createDeploymentConfig(
     swarmId: string,
     configParams: Record<string, any>
   ): DeploymentConfig {
     // Creates initial deployment configuration
   }
   ```

2. **Parameter Validation**:
   ```typescript
   async function deploySwarmWithConfig(
     swarmId: string,
     query: string,
     schedule: 'once' | 'hourly' | 'daily' | 'weekly',
     swarmService: SwarmService,
     budgetLimit?: number,
     requiredConfigs?: string[]
   ): Promise<DeployConfig> {
     // Validates required configurations before deployment
   }
   ```

3. **Error Handling for Missing Configurations**:
   ```typescript
   // When config is missing, returns 400 error with details
   throw new Error(`Configuration required for swarm deployment. Required parameters: ${requiredConfigs.join(', ')}`);
   ```

## Prompt-to-Swarm Integration

The prompt-to-swarm feature uses structured LLM output to create swarms with appropriate configurations:

### Agent Schema Definition
```typescript
const AgentSchema = z.object({
  nickname: z.string().describe('Short memorable name, e.g. "Sentinel"'),
  formalName: z.string().describe('Full role name, e.g. "Content Moderation Agent"'),
  descriptor: z.string().describe('One-sentence description of what this agent does'),
  layerName: z.string().describe('Which layer: Interface, Processing, Intelligence, or Operations'),
  badges: z.array(z.string()).describe('Badges like HUB, CRITICAL, ENTRY, AUTO, HUMAN, ALWAYS_ON'),
  skills: z.array(z.string()).describe('Core capabilities, e.g. ["web-search", "summarization"]'),
  modelProvider: z.string().optional().describe('Provider: anthropic, nvidia, openai, google'),
  modelName: z.string().optional().describe('Specific model, e.g. claude-sonnet-4-6'),
});
```

### System Prompt Guidance
The system prompt guides LLM to create:
- Appropriate agent roles with memorable nicknames
- Clear descriptions of each agent's function
- Proper layer assignments (Interface, Processing, Intelligence, Operations)
- Relevant badges for agent importance and capabilities
- Suitable topology recommendations (hierarchical, mesh, ring, star)

## Tier-Based Capabilities

### Provider Selection Logic
```typescript
// Selects cheapest available model based on complexity level
export function getCheapestModel(complexity: number): { model: LanguageModel; route: ModelRoute } {
  // Low complexity: try NVIDIA first, then OpenAI, then Anthropic
  // High complexity: try Tier 3 first, then degrade to cheaper providers
}
```

### Subscription Integration
The system supports different license plans:
- Free, Starter, Pro, Enterprise
- Tier-based feature availability 
- Paddle integration for subscription management

## Deployment Workflow

### Scheduled Execution
Supports multiple scheduling options:
- "once" (run immediately)
- "hourly", "daily", "weekly" (recurring execution)

### Budget Management
- Set budget limits to control costs
- Automatic stopping when budget is reached
- Cost tracking and reporting

### Runtime Monitoring
- Tracks duration, token usage, and cost per execution
- Maintains detailed run history
- Stores execution results for analysis

## Implementation Recommendations

1. **Intelligent Configuration Detection**
   - Automatically detect agent requirements (email, database, cloud services)
   - Implement functions to identify what configuration parameters are needed
   - Provide clear error messages when configurations are missing

2. **Prompt Engineering**
   - Leverage existing system prompts in swarm-generator-service.ts
   - Add guidance for configuration requirements based on agent types
   - Use structured output schemas to ensure consistent formats

3. **Deployment Workflow Integration**
   - Implement proper error handling for missing configurations
   - Provide clear feedback to users about required parameters
   - Support partial configuration updates via the config endpoint

4. **Tier Selection Based on Requirements**
   - Use provider router to select appropriate models based on swarm complexity
   - Consider subscription tier when determining model selection and features
   - Implement fallback strategies for missing API keys

This architecture provides a robust foundation for managing complex swarm configurations while maintaining flexibility in deployment workflows and configuration requirements.