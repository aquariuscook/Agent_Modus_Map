import React, { useState, useEffect } from 'react';
import { getAuditLog, getComplianceReport } from '../api.js';
import type { AuditEntry, ComplianceReport } from '../api.js';

interface Props {
  swarmId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ACTION_COLORS: Record<string, string> = {
  'agent.created': '#10b981',
  'agent.updated': '#3b82f6',
  'agent.deleted': '#ef4444',
  'relationship.created': '#10b981',
  'relationship.deleted': '#ef4444',
  'swarm.created': '#8b5cf6',
  'swarm.imported': '#f59e0b',
  'swarm.exported': '#06b6d4',
};

export function GovernancePanel({ swarmId, isOpen, onClose }: Props) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [compliance, setCompliance] = useState<ComplianceReport | null>(null);
  const [tab, setTab] = useState<'audit' | 'compliance'>('audit');

  useEffect(() => {
    if (!isOpen) return;
    getAuditLog(swarmId).then(setAudit).catch(() => {});
    getComplianceReport(swarmId).then(setCompliance).catch(() => {});
  }, [swarmId, isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 12,
        width: '90%', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#e2e8f0', fontSize: 18 }}>Governance</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setTab('audit')} style={tabStyle(tab === 'audit')}>Audit Log</button>
              <button onClick={() => setTab('compliance')} style={tabStyle(tab === 'compliance')}>Compliance</button>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>X</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {tab === 'audit' && (
            <div>
              {audit.length === 0 && <p style={{ color: '#64748b' }}>No audit entries yet. Actions on the swarm will be logged here.</p>}
              {audit.map(entry => (
                <div key={entry.id} style={{
                  padding: '10px 14px', marginBottom: 8, borderRadius: 8, background: '#0f1f35',
                  borderLeft: `3px solid ${ACTION_COLORS[entry.action] || '#475569'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{entry.action}</span>
                    <span style={{ color: '#64748b', fontSize: 11 }}>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                    by {entry.userName}
                  </div>
                  {Object.keys(entry.details).length > 0 && (
                    <pre style={{ color: '#64748b', fontSize: 11, marginTop: 6, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'compliance' && compliance && (
            <div>
              <div style={{
                padding: 16, borderRadius: 8, marginBottom: 20,
                background: compliance.status === 'compliant' ? '#052e16' : compliance.status === 'partial' ? '#451a03' : '#450a0a',
                border: `1px solid ${compliance.status === 'compliant' ? '#16a34a' : compliance.status === 'partial' ? '#d97706' : '#dc2626'}`,
              }}>
                <div style={{
                  color: compliance.status === 'compliant' ? '#4ade80' : compliance.status === 'partial' ? '#fbbf24' : '#f87171',
                  fontSize: 16, fontWeight: 700, textTransform: 'uppercase',
                }}>
                  {compliance.status}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                  {compliance.auditEntryCount} audit entries analyzed
                </div>
              </div>

              {compliance.checks.map((check, i) => (
                <div key={i} style={{
                  padding: '12px 14px', marginBottom: 8, borderRadius: 8, background: '#0f1f35',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    background: check.status === 'pass' ? '#16a34a' : check.status === 'warning' ? '#d97706' : '#dc2626',
                    color: '#fff',
                  }}>
                    {check.status === 'pass' ? 'P' : check.status === 'warning' ? '!' : 'F'}
                  </span>
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{check.name}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>{check.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    background: active ? '#00d9ff' : '#1e3a5f',
    color: active ? '#0a1628' : '#94a3b8',
  };
}
