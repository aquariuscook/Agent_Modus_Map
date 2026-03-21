import React, { useState, useEffect, useCallback } from 'react';
import { getSwarmHealth, simulateHealth, type AgentHealthSummary } from '../api.js';
import { Sparkline } from './Sparkline.js';

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  healthy: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', label: 'Healthy' },
  degraded: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)', label: 'Degraded' },
  unhealthy: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Unhealthy' },
  unknown: { color: '#64748b', bg: 'rgba(107, 114, 128, 0.15)', label: 'Unknown' },
};

interface HealthDashboardProps {
  swarmId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function HealthDashboard({ swarmId, isOpen, onClose }: HealthDashboardProps) {
  const [agents, setAgents] = useState<AgentHealthSummary[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<AgentHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    try {
      const data = await getSwarmHealth(swarmId);
      setAgents(data);
    } catch (err) {
      console.error('Failed to load health data:', err);
    } finally {
      setLoading(false);
    }
  }, [swarmId]);

  useEffect(() => {
    if (isOpen) {
      loadHealth();
      const interval = setInterval(loadHealth, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen, loadHealth]);

  const handleSimulate = useCallback(async () => {
    await simulateHealth(swarmId);
    await loadHealth();
  }, [swarmId, loadHealth]);

  if (!isOpen) return null;

  const counts = { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
  agents.forEach(a => counts[a.status]++);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
        border: '1px solid rgba(0, 217, 255, 0.3)',
        borderRadius: 20,
        padding: 24,
        width: 900,
        maxHeight: '85vh',
        overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: '#00d9ff', fontSize: 20, margin: 0 }}>Health Dashboard</h2>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {Object.entries(counts).filter(([, c]) => c > 0).map(([status, count]) => {
                const cfg = statusConfig[status];
                return (
                  <span key={status} style={{ fontSize: 13, color: cfg.color }}>
                    {count} {cfg.label.toLowerCase()}
                  </span>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSimulate} style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(0,217,255,0.3)',
              background: 'rgba(0,217,255,0.08)', color: '#00d9ff', cursor: 'pointer', fontSize: 12,
            }}>
              Simulate Tick
            </button>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: '#8b9dc3', cursor: 'pointer', fontSize: 20,
            }}>{'\u00D7'}</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#8b9dc3', padding: 40 }}>Loading health data...</div>
        ) : (
          <>
            {/* Health Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 10,
            }}>
              {agents.map(agent => {
                const cfg = statusConfig[agent.status];
                return (
                  <div
                    key={agent.agentId}
                    onClick={() => setSelectedDetail(selectedDetail?.agentId === agent.agentId ? null : agent)}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: cfg.bg,
                      border: `2px solid ${selectedDetail?.agentId === agent.agentId ? cfg.color : 'transparent'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{agent.nickname}</span>
                      <span style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: cfg.color,
                        boxShadow: `0 0 6px ${cfg.color}`,
                      }} />
                    </div>

                    <div style={{ fontSize: 11, color: '#8b9dc3', marginBottom: 8 }}>
                      {agent.latencyP95 > 0 ? `${agent.latencyP95}ms p95` : 'No data'} | {agent.throughput > 0 ? `${agent.throughput} req/m` : ''}
                    </div>

                    {agent.history.length > 1 && (
                      <Sparkline
                        data={agent.history.map(h => h.latencyP95)}
                        color={cfg.color}
                        fillColor={cfg.color}
                        width={170}
                        height={24}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Detail Panel */}
            {selectedDetail && (
              <div style={{
                marginTop: 16,
                padding: 18,
                borderRadius: 14,
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <h3 style={{ color: '#fff', fontSize: 16, margin: '0 0 12px' }}>
                  {selectedDetail.nickname} Details
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <MetricCard label="Latency (p95)" value={`${selectedDetail.latencyP95}ms`}
                    history={selectedDetail.history.map(h => h.latencyP95)} color="#00d9ff" />
                  <MetricCard label="Throughput" value={`${selectedDetail.throughput} req/m`}
                    history={selectedDetail.history.map(h => h.throughput)} color="#22c55e" />
                  <MetricCard label="Error Rate" value={`${selectedDetail.errorRate}%`}
                    history={selectedDetail.history.map(h => h.errorRate)} color="#ef4444" />
                  <MetricCard label="CPU" value={`${selectedDetail.cpuPercent}%`}
                    history={[]} color="#fbbf24" />
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                  Memory: {selectedDetail.memoryMb}MB | Last report: {selectedDetail.lastReportAt ? new Date(selectedDetail.lastReportAt).toLocaleTimeString() : 'Never'}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, history, color }: { label: string; value: string; history: number[]; color: string }) {
  return (
    <div style={{
      padding: 12,
      borderRadius: 10,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: 10, color: '#8b9dc3', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{value}</div>
      {history.length > 1 && (
        <Sparkline data={history} color={color} fillColor={color} width={150} height={30} />
      )}
    </div>
  );
}
