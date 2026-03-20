import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { SwarmCanvas } from './components/SwarmCanvas.js';
import { RelationshipPanel } from './components/RelationshipPanel.js';
import { Header } from './components/Header.js';
import { AgentPalette } from './components/AgentPalette.js';
import { PropertyEditor } from './components/PropertyEditor.js';
import { ValidationPanel, validateSwarm } from './components/ValidationPanel.js';
import { ChatPanel } from './components/ChatPanel.js';
import { TemplateBrowser } from './components/TemplateBrowser.js';
import { HealthDashboard } from './components/HealthDashboard.js';
import { DecisionTraceViewer } from './components/DecisionTraceViewer.js';
import { GovernancePanel } from './components/GovernancePanel.js';
import { CollaborationPanel } from './components/CollaborationPanel.js';
import { OptimizationPanel } from './components/OptimizationPanel.js';
import { DocViewer } from './components/DocViewer.js';
import { OnboardingOverlay } from './components/OnboardingOverlay.js';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp.js';
import { LoginPanel } from './components/LoginPanel.js';
import { CollaborationCursors } from './components/CollaborationCursors.js';
import { useCollaboration } from './hooks/useCollaboration.js';
import {
  getSwarm, getBlastRadius, exportSwarm, importSwarm,
  getSwarmHealthSummary, getAuthToken, setAuthToken, getHTMLExportUrl,
  createAgent, updateAgent, deleteAgent,
  createRelationship, deleteRelationship,
} from './api.js';
import type { SwarmHealthSummary, AuthToken } from './api.js';
import type { Swarm, Agent, BlastRadiusResult, RelationshipType, Badge } from '../shared/types/index.js';

const DEFAULT_SWARM_ID = 'ecommerce-standard-v1';
const ONBOARDING_KEY = 'agentModusMap_onboardingDismissed';

export function App() {
  const [swarmId, setSwarmId] = useState(DEFAULT_SWARM_ID);
  const [swarm, setSwarm] = useState<Swarm | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [blastRadius, setBlastRadius] = useState<BlastRadiusResult[]>([]);
  const [showBlastRadius, setShowBlastRadius] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [templateBrowserOpen, setTemplateBrowserOpen] = useState(false);
  const [healthDashboardOpen, setHealthDashboardOpen] = useState(false);
  const [healthSummary, setHealthSummary] = useState<SwarmHealthSummary | null>(null);
  const [tracesOpen, setTracesOpen] = useState(false);
  const [governanceOpen, setGovernanceOpen] = useState(false);
  const [collaborationOpen, setCollaborationOpen] = useState(false);
  const [optimizationOpen, setOptimizationOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_KEY));
  const [showLogin, setShowLogin] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthToken['user'] | null>(null);
  const collab = useCollaboration(swarmId);

  const reloadSwarm = useCallback(async (id?: string) => {
    const targetId = id || swarmId;
    const data = await getSwarm(targetId);
    setSwarm(data);
    return data;
  }, [swarmId]);

  useEffect(() => {
    reloadSwarm()
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [reloadSwarm]);

  // Poll health summary
  useEffect(() => {
    getSwarmHealthSummary(swarmId).then(setHealthSummary).catch(() => {});
    const interval = setInterval(() => {
      getSwarmHealthSummary(swarmId).then(setHealthSummary).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [swarmId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case '?': setShortcutsOpen(v => !v); break;
        case 'p': case 'P': setPaletteOpen(v => !v); break;
        case 'v': case 'V': setValidationOpen(v => !v); break;
        case 'c': case 'C': setChatOpen(v => !v); break;
        case 'h': case 'H': setHealthDashboardOpen(v => !v); break;
        case 't': case 'T': setTemplateBrowserOpen(v => !v); break;
        case 'd': case 'D': setTracesOpen(v => !v); break;
        case 'g': case 'G': setGovernanceOpen(v => !v); break;
        case 'o': case 'O': setOptimizationOpen(v => !v); break;
        case 'l': case 'L': setCollaborationOpen(v => !v); break;
        case 'Escape':
          setSelectedAgent(null);
          setEditorOpen(false);
          setShortcutsOpen(false);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  }, []);

  const handleLogin = useCallback((auth: AuthToken) => {
    setCurrentUser(auth.user);
    setShowLogin(false);
  }, []);

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    setCurrentUser(null);
  }, []);

  const handleExportHTML = useCallback(() => {
    window.open(getHTMLExportUrl(swarmId), '_blank');
  }, [swarmId]);

  const handleSelectAgent = useCallback(async (agent: Agent | null) => {
    setSelectedAgent(agent);
    if (agent) {
      setEditorOpen(true);
      if (showBlastRadius) {
        const results = await getBlastRadius(swarmId, agent.nickname);
        setBlastRadius(results);
      }
    } else {
      setEditorOpen(false);
      setBlastRadius([]);
    }
  }, [showBlastRadius, swarmId]);

  const handleToggleBlastRadius = useCallback(async () => {
    const next = !showBlastRadius;
    setShowBlastRadius(next);
    if (next && selectedAgent) {
      const results = await getBlastRadius(swarmId, selectedAgent.nickname);
      setBlastRadius(results);
    } else {
      setBlastRadius([]);
    }
  }, [showBlastRadius, selectedAgent, swarmId]);

  const handleDropAgent = useCallback(async (position: { x: number; y: number }, templateJson: string) => {
    try {
      const template = JSON.parse(templateJson) as {
        nickname: string; formalName: string; descriptor: string;
        badges: Badge[]; layerId: string;
      };
      const existing = swarm?.agents.map(a => a.nickname) || [];
      let nickname = template.nickname;
      let counter = 2;
      while (existing.includes(nickname)) {
        nickname = `${template.nickname}${counter}`;
        counter++;
      }
      await createAgent(swarmId, {
        nickname, formalName: template.formalName, descriptor: template.descriptor,
        badges: template.badges, layerId: template.layerId, position, config: {},
      });
      await reloadSwarm();
    } catch (err) {
      console.error('Failed to create agent:', err);
    }
  }, [swarm, swarmId, reloadSwarm]);

  const handleDeleteAgent = useCallback(async (agentId: string) => {
    await deleteAgent(swarmId, agentId);
    setSelectedAgent(null);
    setEditorOpen(false);
    await reloadSwarm();
  }, [swarmId, reloadSwarm]);

  const handleSaveAgent = useCallback(async (agentId: string, changes: Partial<Agent>) => {
    await updateAgent(swarmId, agentId, changes);
    const updated = await reloadSwarm();
    const refreshed = updated.agents.find(a => a.id === agentId);
    if (refreshed) setSelectedAgent(refreshed);
  }, [swarmId, reloadSwarm]);

  const handleNodeDragStop = useCallback(async (agentId: string, position: { x: number; y: number }) => {
    await updateAgent(swarmId, agentId, { position } as Partial<Agent>);
  }, [swarmId]);

  const handleConnect = useCallback(async (sourceId: string, targetId: string, type: RelationshipType) => {
    try {
      await createRelationship(swarmId, { sourceAgentId: sourceId, targetAgentId: targetId, type });
      await reloadSwarm();
    } catch (err) {
      console.error('Failed to create relationship:', err);
    }
  }, [swarmId, reloadSwarm]);

  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    await deleteRelationship(swarmId, edgeId);
    await reloadSwarm();
  }, [swarmId, reloadSwarm]);

  const handleExport = useCallback(async () => {
    const data = await exportSwarm(swarmId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${swarm?.name || 'swarm'}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [swarmId, swarm]);

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        const imported = await importSwarm(data);
        setSwarmId(imported.id);
        setSwarm(imported);
        setSelectedAgent(null);
      } catch (err) {
        console.error('Import failed:', err);
      }
    };
    input.click();
  }, []);

  const handleSwarmCreated = useCallback(async (newSwarmId: string) => {
    setSwarmId(newSwarmId);
    setSelectedAgent(null);
    setEditorOpen(false);
    setLoading(true);
    try {
      await reloadSwarm(newSwarmId);
    } finally {
      setLoading(false);
    }
  }, [reloadSwarm]);

  const validationMessages = useMemo(() => {
    if (!swarm) return [];
    return validateSwarm(swarm);
  }, [swarm]);

  const selectedAgentDependents = useMemo(() => {
    if (!selectedAgent || !swarm) return 0;
    return swarm.relationships.filter(
      r => r.targetAgentId === selectedAgent.id && r.type === 'dependsOn'
    ).length;
  }, [selectedAgent, swarm]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#00d9ff', fontSize: 20 }}>
        Loading swarm...
      </div>
    );
  }

  if (error || !swarm) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#ef4444', fontSize: 18 }}>
        {error || 'Failed to load swarm. Run `npm run seed` then `npm run dev:api`.'}
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Header
          swarmName={swarm.name}
          agentCount={swarm.agents.length}
          relationshipCount={swarm.relationships.length}
          showBlastRadius={showBlastRadius}
          onToggleBlastRadius={handleToggleBlastRadius}
          onOpenTemplates={() => setTemplateBrowserOpen(true)}
          onExport={handleExport}
          onImport={handleImport}
          onOpenHealth={() => setHealthDashboardOpen(true)}
          onOpenTraces={() => setTracesOpen(true)}
          onOpenGovernance={() => setGovernanceOpen(true)}
          onOpenOptimization={() => setOptimizationOpen(true)}
          onOpenCollaboration={() => setCollaborationOpen(true)}
          onOpenDocs={() => setDocsOpen(true)}
          onExportHTML={handleExportHTML}
          healthStatus={healthSummary?.overall}
        />
        <div style={{ flex: 1, position: 'relative' }}>
          <CollaborationCursors
            cursors={collab.cursors}
            users={collab.users}
            connected={collab.connected}
          />

          <AgentPalette
            layers={swarm.layers}
            onDragStart={() => {}}
            isOpen={paletteOpen}
            onToggle={() => setPaletteOpen(!paletteOpen)}
          />

          <SwarmCanvas
            swarm={swarm}
            selectedAgent={selectedAgent}
            onSelectAgent={handleSelectAgent}
            blastRadius={blastRadius}
            showBlastRadius={showBlastRadius}
            onNodeDragStop={handleNodeDragStop}
            onConnect={handleConnect}
            onDropAgent={handleDropAgent}
            onDeleteEdge={handleDeleteEdge}
          />

          <ValidationPanel
            messages={validationMessages}
            isOpen={validationOpen}
            onToggle={() => setValidationOpen(!validationOpen)}
          />

          <ChatPanel
            swarmId={swarmId}
            isOpen={chatOpen}
            onToggle={() => setChatOpen(!chatOpen)}
          />

          {selectedAgent && !editorOpen && (
            <RelationshipPanel
              agent={selectedAgent}
              swarm={swarm}
              blastRadius={blastRadius}
              showBlastRadius={showBlastRadius}
              onClose={() => handleSelectAgent(null)}
            />
          )}

          {selectedAgent && editorOpen && (
            <PropertyEditor
              agent={selectedAgent}
              layers={swarm.layers}
              onSave={handleSaveAgent}
              onDelete={handleDeleteAgent}
              onClose={() => setEditorOpen(false)}
              dependentCount={selectedAgentDependents}
            />
          )}
        </div>
      </div>

      <TemplateBrowser
        isOpen={templateBrowserOpen}
        onClose={() => setTemplateBrowserOpen(false)}
        onSwarmCreated={handleSwarmCreated}
      />

      <HealthDashboard
        swarmId={swarmId}
        isOpen={healthDashboardOpen}
        onClose={() => setHealthDashboardOpen(false)}
      />

      <DecisionTraceViewer
        swarmId={swarmId}
        isOpen={tracesOpen}
        onClose={() => setTracesOpen(false)}
      />

      <GovernancePanel
        swarmId={swarmId}
        isOpen={governanceOpen}
        onClose={() => setGovernanceOpen(false)}
      />

      <CollaborationPanel
        swarmId={swarmId}
        swarm={swarm}
        isOpen={collaborationOpen}
        onClose={() => setCollaborationOpen(false)}
      />

      <OptimizationPanel
        swarmId={swarmId}
        isOpen={optimizationOpen}
        onClose={() => setOptimizationOpen(false)}
      />

      <DocViewer
        swarmId={swarmId}
        isOpen={docsOpen}
        onClose={() => setDocsOpen(false)}
      />

      <KeyboardShortcutsHelp
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {showOnboarding && <OnboardingOverlay onDismiss={dismissOnboarding} />}
      {showLogin && <LoginPanel onLogin={handleLogin} onSkip={() => setShowLogin(false)} />}
    </ReactFlowProvider>
  );
}
