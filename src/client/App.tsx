import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Dashboard } from './components/Dashboard.js';
import { SwarmCanvas } from './components/SwarmCanvas.js';
import { EditorToolbar, type EditorMode } from './components/EditorToolbar.js';
import { AgentPalette } from './components/AgentPalette.js';
import { AgentModusModal } from './components/AgentModusModal.js';
import { AgentBuilderWizard, type AgentFormData } from './components/AgentBuilderWizard.js';
import { RelationshipOrchestrator } from './components/RelationshipOrchestrator.js';
import { ValidationPanel, validateSwarm } from './components/ValidationPanel.js';
import { ChatPanel } from './components/ChatPanel.js';
import { HealthDashboard } from './components/HealthDashboard.js';
import { DecisionTraceViewer } from './components/DecisionTraceViewer.js';
import { GovernancePanel } from './components/GovernancePanel.js';
import { CollaborationPanel } from './components/CollaborationPanel.js';
import { OptimizationPanel } from './components/OptimizationPanel.js';
import { SimulationPanel } from './components/SimulationPanel.js';
import { DocViewer } from './components/DocViewer.js';
import { OnboardingOverlay } from './components/OnboardingOverlay.js';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp.js';
import { CollaborationCursors } from './components/CollaborationCursors.js';
import { useCollaboration } from './hooks/useCollaboration.js';
import {
  getSwarm, getBlastRadius, exportSwarm, importSwarm,
  getSwarmHealthSummary, getSwarmHealth, getHTMLExportUrl, getHandoffDocUrl,
  type AgentHealthSummary,
  createAgent, updateAgent, deleteAgent,
  createRelationship, deleteRelationship,
} from './api.js';
import type { SwarmHealthSummary } from './api.js';
import type { Swarm, Agent, BlastRadiusResult, RelationshipType, Badge } from '../shared/types/index.js';

const ONBOARDING_KEY = 'agent-modus-onboarding-v2';

type AppView = 'dashboard' | 'editor';

export function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const [swarmId, setSwarmId] = useState('');
  const [swarm, setSwarm] = useState<Swarm | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [blastRadius, setBlastRadius] = useState<BlastRadiusResult[]>([]);
  const [showBlastRadius, setShowBlastRadius] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('build');

  // Panel state: only one panel open at a time (except editor modal and chat which overlay)
  type Panel = null | 'palette' | 'validation' | 'orchestrator' | 'wizard'
    | 'health' | 'traces' | 'governance' | 'collaboration'
    | 'optimization' | 'simulation' | 'docs' | 'shortcuts';
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);

  // Panel helpers
  const togglePanel = (p: Panel) => setOpenPanel(prev => prev === p ? null : p);
  const paletteOpen = openPanel === 'palette';
  const validationOpen = openPanel === 'validation';
  const orchestratorOpen = openPanel === 'orchestrator';
  const wizardOpen = openPanel === 'wizard';
  const healthDashboardOpen = openPanel === 'health';
  const tracesOpen = openPanel === 'traces';
  const governanceOpen = openPanel === 'governance';
  const collaborationOpen = openPanel === 'collaboration';
  const optimizationOpen = openPanel === 'optimization';
  const simulationOpen = openPanel === 'simulation';
  const docsOpen = openPanel === 'docs';
  const shortcutsOpen = openPanel === 'shortcuts';
  const [healthSummary, setHealthSummary] = useState<SwarmHealthSummary | null>(null);
  const [agentHealthMap, setAgentHealthMap] = useState<Record<string, AgentHealthSummary['status']>>({});
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_KEY));

  const collab = useCollaboration(swarmId);

  const reloadSwarm = useCallback(async (id?: string) => {
    const targetId = id || swarmId;
    if (!targetId) return null;
    const data = await getSwarm(targetId);
    setSwarm(data);
    return data;
  }, [swarmId]);

  // Open a swarm from dashboard
  const handleOpenSwarm = useCallback(async (id: string) => {
    setSwarmId(id);
    setLoading(true);
    setSelectedAgent(null);
    setEditorOpen(false);
    try {
      const data = await getSwarm(id);
      setSwarm(data);
      setView('editor');
    } catch (err) {
      console.error('Failed to load swarm:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    setView('dashboard');
    setSwarm(null);
    setSwarmId('');
    setSelectedAgent(null);
  }, []);

  // Poll health
  useEffect(() => {
    if (!swarmId || view !== 'editor') return;
    const fetchHealth = () => {
      getSwarmHealthSummary(swarmId).then(setHealthSummary).catch(() => {});
      getSwarmHealth(swarmId).then(agents => {
        const map: Record<string, AgentHealthSummary['status']> = {};
        for (const a of agents) map[a.agentId] = a.status;
        setAgentHealthMap(map);
      }).catch(() => {});
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [swarmId, view]);

  // Keyboard shortcuts
  useEffect(() => {
    if (view !== 'editor') return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case '?': togglePanel('shortcuts'); break;
        case 'Escape': setSelectedAgent(null); setEditorOpen(false); setOpenPanel(null); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view]);

  // Agent interactions
  const handleSelectAgent = useCallback(async (agent: Agent | null) => {
    setSelectedAgent(agent);
    if (agent) {
      if (showBlastRadius) {
        const results = await getBlastRadius(swarmId, agent.nickname);
        setBlastRadius(results);
      }
    } else {
      setEditorOpen(false);
      setBlastRadius([]);
    }
  }, [showBlastRadius, swarmId]);

  const handleOpenAgentDetail = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setEditorOpen(true);
  }, []);

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
      const template = JSON.parse(templateJson);
      const existing = swarm?.agents.map(a => a.nickname) || [];
      let nickname = template.nickname;
      let counter = 2;
      while (existing.includes(nickname)) { nickname = `${template.nickname}${counter}`; counter++; }
      await createAgent(swarmId, {
        nickname, formalName: template.formalName, descriptor: template.descriptor,
        badges: template.badges, layerId: template.layerId, position, config: {},
      });
      await reloadSwarm();
    } catch (err) { console.error('Failed to create agent:', err); }
  }, [swarm, swarmId, reloadSwarm]);

  const handleCreateFromWizard = useCallback(async (data: AgentFormData) => {
    try {
      await createAgent(swarmId, data);
      await reloadSwarm();
      setOpenPanel(null);
    } catch (err) { console.error('Failed to create agent:', err); }
  }, [swarmId, reloadSwarm]);

  const handleDeleteAgent = useCallback(async (agentId: string) => {
    await deleteAgent(swarmId, agentId);
    setSelectedAgent(null);
    setEditorOpen(false);
    await reloadSwarm();
  }, [swarmId, reloadSwarm]);

  const handleSaveAgent = useCallback(async (agentId: string, changes: Partial<Agent>) => {
    await updateAgent(swarmId, agentId, changes);
    const updated = await reloadSwarm();
    const refreshed = updated?.agents.find(a => a.id === agentId);
    if (refreshed) setSelectedAgent(refreshed);
  }, [swarmId, reloadSwarm]);

  const handleNodeDragStop = useCallback(async (agentId: string, position: { x: number; y: number }) => {
    await updateAgent(swarmId, agentId, { position } as Partial<Agent>);
  }, [swarmId]);

  const handleConnect = useCallback(async (sourceId: string, targetId: string, type: RelationshipType) => {
    try {
      await createRelationship(swarmId, { sourceAgentId: sourceId, targetAgentId: targetId, type });
      await reloadSwarm();
    } catch (err) { console.error('Failed to create relationship:', err); }
  }, [swarmId, reloadSwarm]);

  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    await deleteRelationship(swarmId, edgeId);
    await reloadSwarm();
  }, [swarmId, reloadSwarm]);

  const handleExportJSON = useCallback(async () => {
    const data = await exportSwarm(swarmId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${swarm?.name || 'swarm'}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [swarmId, swarm]);

  const handleExportHTML = useCallback(() => {
    window.open(getHTMLExportUrl(swarmId), '_blank');
  }, [swarmId]);

  const handleExportHandoff = useCallback(() => {
    window.open(getHandoffDocUrl(swarmId), '_blank');
  }, [swarmId]);

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
        handleOpenSwarm(imported.id);
      } catch (err) { console.error('Import failed:', err); }
    };
    input.click();
  }, [handleOpenSwarm]);

  const validationMessages = useMemo(() => {
    if (!swarm) return [];
    return validateSwarm(swarm);
  }, [swarm]);

  const selectedAgentDependents = useMemo(() => {
    if (!selectedAgent || !swarm) return 0;
    return swarm.relationships.filter(r => r.targetAgentId === selectedAgent.id && r.type === 'dependsOn').length;
  }, [selectedAgent, swarm]);

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  }, []);

  // Dashboard view
  if (view === 'dashboard') {
    return (
      <>
        <Dashboard onOpenSwarm={handleOpenSwarm} />
        {showOnboarding && <OnboardingOverlay onDismiss={dismissOnboarding} />}
      </>
    );
  }

  // Loading state
  if (loading || !swarm) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#00d9ff', fontSize: 20 }}>
        Loading swarm...
      </div>
    );
  }

  // Editor view
  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <EditorToolbar
          swarmName={swarm.name}
          agentCount={swarm.agents.length}
          relationshipCount={swarm.relationships.length}
          mode={editorMode}
          onModeChange={setEditorMode}
          onBack={handleBack}
          healthStatus={healthSummary?.overall}
          onTogglePalette={() => setOpenPanel('wizard')}
          onToggleChat={() => setChatOpen(!chatOpen)}
          onToggleValidation={() => togglePanel('validation')}
          onToggleOrchestrator={() => togglePanel('orchestrator')}
          onOpenHealth={() => setOpenPanel('health')}
          onOpenTraces={() => setOpenPanel('traces')}
          onOpenGovernance={() => setOpenPanel('governance')}
          onOpenCollaboration={() => setOpenPanel('collaboration')}
          onOpenOptimization={() => setOpenPanel('optimization')}
          onOpenDocs={() => setOpenPanel('docs')}
          onExportJSON={handleExportJSON}
          onExportHTML={handleExportHTML}
          onExportHandoff={handleExportHandoff}
          onToggleSimulation={() => editorMode === 'ship' ? setDeployOpen(!deployOpen) : togglePanel('simulation')}
          onImport={handleImport}
          showBlastRadius={showBlastRadius}
          onToggleBlastRadius={handleToggleBlastRadius}
        />

        <div style={{ flex: 1, position: 'relative' }}>
          <CollaborationCursors cursors={collab.cursors} users={collab.users} connected={collab.connected} />

          {editorMode === 'build' && (
            <AgentPalette layers={swarm.layers} onDragStart={() => {}} isOpen={paletteOpen} onToggle={() => togglePanel('palette')} />
          )}

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
            agentHealthMap={agentHealthMap}
            onOpenAgentDetail={handleOpenAgentDetail}
          />

          {editorMode === 'build' && (
            <ValidationPanel messages={validationMessages} isOpen={validationOpen} onToggle={() => togglePanel('validation')} />
          )}

          <ChatPanel swarmId={swarmId} isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />

          {selectedAgent && editorOpen && (
            <AgentModusModal
              agent={selectedAgent}
              swarm={swarm}
              layers={swarm.layers}
              onSave={handleSaveAgent}
              onDelete={handleDeleteAgent}
              onClose={() => setEditorOpen(false)}
              dependentCount={selectedAgentDependents}
            />
          )}

          {editorMode === 'build' && (
            <RelationshipOrchestrator
              swarm={swarm}
              isOpen={orchestratorOpen}
              onToggle={() => togglePanel('orchestrator')}
              onCreateRelationship={handleConnect}
              onDeleteRelationship={handleDeleteEdge}
            />
          )}
        </div>
      </div>

      <HealthDashboard swarmId={swarmId} isOpen={healthDashboardOpen} onClose={() => setOpenPanel(null)} />
      <DecisionTraceViewer swarmId={swarmId} isOpen={tracesOpen} onClose={() => setOpenPanel(null)} />
      <GovernancePanel swarmId={swarmId} isOpen={governanceOpen} onClose={() => setOpenPanel(null)} />
      <CollaborationPanel swarmId={swarmId} swarm={swarm} isOpen={collaborationOpen} onClose={() => setOpenPanel(null)} />
      <OptimizationPanel swarmId={swarmId} isOpen={optimizationOpen} onClose={() => setOpenPanel(null)} />
          <SimulationPanel swarmId={swarmId} isOpen={simulationOpen} onToggle={() => togglePanel('simulation')} defaultTab="simulate"
            onOpenAgent={(agentId) => {
              const agent = swarm.agents.find(a => a.id === agentId);
              if (agent) { setSelectedAgent(agent); setEditorOpen(true); }
            }}
          />
          <SimulationPanel swarmId={swarmId} isOpen={deployOpen} onToggle={() => setDeployOpen(false)} defaultTab="deploy"
            onOpenAgent={(agentId) => {
              const agent = swarm.agents.find(a => a.id === agentId);
              if (agent) { setSelectedAgent(agent); setEditorOpen(true); }
            }}
          />
      <DocViewer swarmId={swarmId} isOpen={docsOpen} onClose={() => setOpenPanel(null)} />
      <KeyboardShortcutsHelp isOpen={shortcutsOpen} onClose={() => setOpenPanel(null)} />

      {wizardOpen && swarm && (
        <AgentBuilderWizard
          layers={swarm.layers}
          existingNicknames={swarm.agents.map(a => a.nickname)}
          onCreate={handleCreateFromWizard}
          onCancel={() => setOpenPanel(null)}
        />
      )}
    </ReactFlowProvider>
  );
}
