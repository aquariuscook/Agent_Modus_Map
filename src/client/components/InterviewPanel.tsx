import React, { useState, useRef, useEffect, useCallback } from 'react';
import { startInterview, sendInterviewMessage, deployInterviewSwarm, getInterviewState } from '../api.js';

interface InterviewPanelProps {
  onClose: () => void;
  onSwarmCreated: (swarmId: string) => void;
  resumeId?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ExtractedData {
  goal?: string;
  successCriteria?: string;
  dataSources?: string;
  systems?: string;
  volume?: string;
  frequency?: string;
  autonomyPreferences?: string;
  complianceContext?: string;
  apiKeysStatus?: string;
  [key: string]: any;
}

const PHASE_NAMES = ['Prompt', 'Goals', 'Scope', 'Authority', 'Compliance', 'APIs', 'Review'];

const LAYER_COLORS = ['#00d9ff', '#a855f7', '#22c55e', '#fbbf24'];

const AUTONOMY_COLORS: Record<string, string> = {
  'Fully Automated': '#22c55e',
  'Human-in-Loop': '#f59e0b',
  'Hybrid': '#3b82f6',
  'Advisory Only': '#6b7280',
};

function renderFormattedText(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    return (
      <React.Fragment key={i}>
        {rendered}
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

export function InterviewPanel({ onClose, onSwarmCreated, resumeId }: InterviewPanelProps) {
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [extracted, setExtracted] = useState<ExtractedData>({});
  const [swarmConfig, setSwarmConfig] = useState<any>(null);
  const [swarmName, setSwarmName] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [phaseAnimating, setPhaseAnimating] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize interview on mount (start new or resume existing)
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        if (resumeId) {
          // Resume existing interview
          const state = await getInterviewState(resumeId);
          if (cancelled) return;
          setInterviewId(state.id);
          setPhase(state.phase);
          setMessages(state.messages || []);
          setExtracted(state.extracted || {});
          if (state.extracted?.swarmConfig) setSwarmConfig(state.extracted.swarmConfig);
        } else {
          // Start new interview
          const result = await startInterview();
          if (cancelled) return;
          setInterviewId(result.interviewId);
          setPhase(result.phase);
          setMessages([{ role: 'assistant', content: result.welcomeMessage }]);
        }
      } catch (err: any) {
        if (cancelled) return;
        setInitError(err.message || 'Failed to start interview. Check that your API key is configured.');
      }
    }
    init();
    return () => { cancelled = true; };
  }, [resumeId]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !interviewId) return;

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const result = await sendInterviewMessage(interviewId, text);
      setMessages(prev => [...prev, { role: 'assistant', content: result.response }]);

      if (result.phaseAdvanced) {
        setPhaseAnimating(true);
        setTimeout(() => setPhaseAnimating(false), 600);
      }
      setPhase(result.phase);

      if (result.extracted) {
        setExtracted(prev => ({ ...prev, ...result.extracted }));
      }
      if (result.swarmConfig) {
        setSwarmConfig(result.swarmConfig);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      const isCredits = errorMsg.includes('credit') || errorMsg.includes('balance');
      const isNotFound = errorMsg.includes('404') || errorMsg.includes('not found');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isCredits
          ? 'Your API credits ran out. Add more credits at console.anthropic.com to continue.'
          : isNotFound
            ? 'This interview session expired. Close and start a new one.'
            : `Something went wrong: ${errorMsg}. Try again or start a new interview.`,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, interviewId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleDeploy = useCallback(async () => {
    if (!interviewId || deploying) return;
    setDeploying(true);
    try {
      const result = await deployInterviewSwarm(interviewId, swarmName || undefined);
      onSwarmCreated(result.swarmId);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Deploy failed: ${err.message || 'Unknown error'}. Try again or adjust the configuration.`,
      }]);
      setDeploying(false);
    }
  }, [interviewId, deploying, swarmName, onSwarmCreated]);

  // Determine which agents to show from swarmConfig
  const agents: any[] = swarmConfig?.agents || swarmConfig?.nodes || [];
  const showAgentCards = phase >= 6 && agents.length > 0;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      background: 'var(--bg-base)',
      fontFamily: 'var(--font-primary, "Inter", system-ui, sans-serif)',
      color: 'var(--text-primary)',
    }}>
      {/* Left Panel: Chat */}
      <div style={{
        width: '60%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-default)',
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: interviewId ? '#22c55e' : '#f59e0b',
            boxShadow: interviewId ? '0 0 8px #22c55e80' : 'none',
          }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Swarm Architect</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {PHASE_NAMES[phase] ? `Phase ${phase + 1}: ${PHASE_NAMES[phase]}` : 'Initializing...'}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {initError && (
            <div style={{
              padding: '12px 16px',
              background: '#dc262620',
              border: '1px solid #dc262640',
              borderRadius: 8,
              color: '#fca5a5',
              fontSize: 13,
            }}>
              {initError}
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                animation: 'fadeIn 0.3s ease-out',
              }}
            >
              <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? 'var(--accent-primary, #00d9ff)' : 'var(--bg-surface)',
                color: msg.role === 'user' ? '#000' : 'var(--text-primary)',
                fontSize: 14,
                lineHeight: 1.6,
                wordBreak: 'break-word',
              }}>
                {renderFormattedText(msg.content)}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '12px 20px',
                borderRadius: '16px 16px 16px 4px',
                background: 'var(--bg-surface)',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}>
                {[0, 1, 2].map(idx => (
                  <div key={idx} style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--text-tertiary)',
                    animation: `pulse 1.2s ease-in-out ${idx * 0.15}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
        }}>
          <div style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-end',
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={interviewId ? 'Type your response...' : 'Connecting...'}
              disabled={!interviewId || loading}
              rows={1}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
                maxHeight: 160,
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-primary, #00d9ff)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || !interviewId}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                border: 'none',
                background: input.trim() && !loading ? 'var(--accent-primary, #00d9ff)' : 'var(--bg-elevated)',
                color: input.trim() && !loading ? '#000' : 'var(--text-tertiary)',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
                transition: 'background 0.2s, color 0.2s',
              }}
              title="Send message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            marginTop: 8,
            textAlign: 'center',
          }}>
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>

      {/* Right Panel: Context */}
      <div style={{
        width: '40%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            zIndex: 1010,
            transition: 'color 0.2s, border-color 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = 'var(--text-secondary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
          title="Close interview"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Deploy Banner - shown when swarm config is ready */}
        {swarmConfig && (
          <div style={{
            padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(34,197,94,0.1)', borderBottom: '1px solid rgba(34,197,94,0.3)',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>
                {swarmConfig.name || 'Your swarm'} is ready ({swarmConfig.agents?.length || 0} agents)
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Deploy to start using it, or keep chatting to make changes
              </div>
            </div>
            <button
              onClick={async () => {
                if (!interviewId || deploying) return;
                setDeploying(true);
                try {
                  const result = await deployInterviewSwarm(interviewId, swarmConfig.name);
                  onSwarmCreated(result.swarmId);
                } catch (err: any) {
                  setMessages(prev => [...prev, { role: 'assistant', content: `Deploy failed: ${err.message}` }]);
                } finally {
                  setDeploying(false);
                }
              }}
              disabled={deploying}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: deploying ? 'default' : 'pointer', opacity: deploying ? 0.6 : 1,
              }}
            >
              {deploying ? 'Deploying...' : 'Deploy Now'}
            </button>
          </div>
        )}

        {/* Phase Progress */}
        <div style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.08em',
            color: 'var(--text-tertiary)',
            marginBottom: 16,
          }}>
            Interview Progress
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {PHASE_NAMES.map((name, i) => {
              const isCompleted = i < phase;
              const isCurrent = i === phase;
              const dotColor = isCompleted ? '#22c55e' : isCurrent ? 'var(--accent-primary, #00d9ff)' : 'var(--bg-elevated)';
              const borderColor = isCompleted ? '#22c55e' : isCurrent ? 'var(--accent-primary, #00d9ff)' : 'var(--border-default)';

              return (
                <React.Fragment key={name}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{
                      width: isCurrent ? 14 : 10,
                      height: isCurrent ? 14 : 10,
                      borderRadius: '50%',
                      background: dotColor,
                      border: `2px solid ${borderColor}`,
                      transition: 'all 0.4s ease',
                      boxShadow: isCurrent ? '0 0 10px var(--accent-primary, #00d9ff)40' : 'none',
                      transform: isCurrent && phaseAnimating ? 'scale(1.4)' : 'scale(1)',
                    }} />
                    <div style={{
                      fontSize: 9,
                      marginTop: 6,
                      color: isCurrent ? 'var(--accent-primary, #00d9ff)' : isCompleted ? '#22c55e' : 'var(--text-tertiary)',
                      fontWeight: isCurrent ? 600 : 400,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.4s ease',
                    }}>
                      {name}
                    </div>
                  </div>
                  {i < PHASE_NAMES.length - 1 && (
                    <div style={{
                      flex: 0.5,
                      height: 2,
                      background: isCompleted ? '#22c55e' : 'var(--border-default)',
                      marginBottom: 18,
                      borderRadius: 1,
                      transition: 'background 0.4s ease',
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Context Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
        }}>
          {showAgentCards ? (
            <AgentCardsSection
              agents={agents}
              swarmName={swarmName}
              onNameChange={setSwarmName}
              onDeploy={handleDeploy}
              deploying={deploying}
            />
          ) : (
            <ExtractedDataSection extracted={extracted} currentPhase={phase} />
          )}
        </div>
      </div>

      {/* Inline animation keyframes */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/* Extracted Data Section */

interface ExtractedDataSectionProps {
  extracted: ExtractedData;
  currentPhase: number;
}

const EXTRACT_FIELDS: Array<{ key: keyof ExtractedData; label: string; phase: number }> = [
  { key: 'goal', label: 'Goal', phase: 0 },
  { key: 'successCriteria', label: 'Success Criteria', phase: 1 },
  { key: 'dataSources', label: 'Data Sources', phase: 2 },
  { key: 'systems', label: 'Systems', phase: 2 },
  { key: 'volume', label: 'Volume', phase: 2 },
  { key: 'frequency', label: 'Frequency', phase: 2 },
  { key: 'autonomyPreferences', label: 'Autonomy Preferences', phase: 3 },
  { key: 'complianceContext', label: 'Compliance Context', phase: 4 },
  { key: 'apiKeysStatus', label: 'API Keys Status', phase: 5 },
];

function ExtractedDataSection({ extracted, currentPhase }: ExtractedDataSectionProps) {
  const hasData = EXTRACT_FIELDS.some(f => extracted[f.key]);

  return (
    <div>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: 16,
      }}>
        What we know so far
      </div>

      {!hasData && (
        <div style={{
          padding: '32px 20px',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          Information will appear here as you answer questions.
          <br />
          Start by describing what you want your agent swarm to do.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {EXTRACT_FIELDS.map(field => {
          const value = extracted[field.key];
          if (!value) return null;

          return (
            <div
              key={field.key}
              style={{
                padding: '12px 14px',
                background: 'var(--bg-elevated)',
                borderRadius: 8,
                border: '1px solid var(--border-default)',
                animation: 'fadeIn 0.3s ease-out',
              }}
            >
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.06em',
                color: 'var(--accent-primary, #00d9ff)',
                marginBottom: 4,
              }}>
                {field.label}
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--text-primary)',
                lineHeight: 1.5,
              }}>
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Phase-based hint */}
      {currentPhase < 6 && (
        <div style={{
          marginTop: 20,
          padding: '10px 14px',
          background: 'var(--accent-primary, #00d9ff)08',
          border: '1px solid var(--accent-primary, #00d9ff)20',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--text-tertiary)',
          lineHeight: 1.5,
        }}>
          Currently gathering: <span style={{ color: 'var(--accent-primary, #00d9ff)', fontWeight: 600 }}>
            {PHASE_NAMES[currentPhase]}
          </span> information
        </div>
      )}
    </div>
  );
}

/* Agent Cards Section (Phase 6) */

interface AgentCardsSectionProps {
  agents: any[];
  swarmName: string;
  onNameChange: (name: string) => void;
  onDeploy: () => void;
  deploying: boolean;
}

function AgentCardsSection({ agents, swarmName, onNameChange, onDeploy, deploying }: AgentCardsSectionProps) {
  return (
    <div>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: 4,
      }}>
        Your Swarm
      </div>
      <div style={{
        fontSize: 11,
        color: 'var(--text-tertiary)',
        marginBottom: 16,
      }}>
        {agents.length} agent{agents.length !== 1 ? 's' : ''} configured and ready to deploy
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {agents.map((agent: any, i: number) => {
          const layerIndex = agent.layerIndex ?? agent.layer ?? i % 4;
          const borderColor = LAYER_COLORS[layerIndex % LAYER_COLORS.length];
          const autonomyLevel = agent.autonomyLevel || agent.autonomy || 'Hybrid';
          const autonomyColor = AUTONOMY_COLORS[autonomyLevel] || '#6b7280';
          const badges: string[] = agent.badges || [];
          const coreTask = agent.coreTask || agent.task || agent.description || '';

          return (
            <div
              key={agent.nickname || i}
              style={{
                padding: '14px 16px',
                background: 'var(--bg-elevated)',
                borderRadius: 8,
                borderLeft: `3px solid ${borderColor}`,
                border: '1px solid var(--border-default)',
                borderLeftColor: borderColor,
                borderLeftWidth: 3,
                animation: `fadeIn 0.3s ease-out ${i * 0.08}s both`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {agent.nickname || `Agent ${i + 1}`}
                  </span>
                  {agent.descriptor && (
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                      {agent.descriptor}
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: `${autonomyColor}20`,
                  color: autonomyColor,
                  whiteSpace: 'nowrap',
                }}>
                  {autonomyLevel}
                </span>
              </div>

              {badges.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  {badges.map((badge: string) => (
                    <span
                      key={badge}
                      style={{
                        fontSize: 9,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'var(--bg-surface)',
                        color: 'var(--text-tertiary)',
                        border: '1px solid var(--border-default)',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}

              {coreTask && (
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  marginTop: 4,
                }}>
                  {coreTask.length > 100 ? coreTask.slice(0, 100) + '...' : coreTask}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Deploy Section */}
      <div style={{
        padding: '16px',
        background: 'var(--bg-elevated)',
        borderRadius: 10,
        border: '1px solid var(--border-default)',
      }}>
        <label style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
          color: 'var(--text-tertiary)',
          marginBottom: 8,
        }}>
          Swarm Name
        </label>
        <input
          type="text"
          value={swarmName}
          onChange={e => onNameChange(e.target.value)}
          placeholder="My Agent Swarm"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            marginBottom: 14,
            boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent-primary, #00d9ff)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
        />
        <button
          onClick={onDeploy}
          disabled={deploying}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 10,
            border: 'none',
            background: deploying ? '#22c55e80' : '#22c55e',
            color: '#000',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: deploying ? 'wait' : 'pointer',
            letterSpacing: '0.02em',
            transition: 'background 0.2s, transform 0.1s',
            transform: deploying ? 'none' : undefined,
          }}
          onMouseEnter={e => { if (!deploying) e.currentTarget.style.background = '#16a34a'; }}
          onMouseLeave={e => { if (!deploying) e.currentTarget.style.background = '#22c55e'; }}
          onMouseDown={e => { if (!deploying) e.currentTarget.style.transform = 'scale(0.98)'; }}
          onMouseUp={e => { if (!deploying) e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {deploying ? 'Deploying...' : 'Deploy Swarm'}
        </button>
      </div>
    </div>
  );
}

export default InterviewPanel;
