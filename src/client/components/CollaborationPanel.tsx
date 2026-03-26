import React, { useState, useEffect } from 'react';
import {
  getVersionHistory, getComments, addComment, resolveComment as resolveCommentApi, saveVersion,
} from '../api.js';
import type { SwarmVersionInfo, SwarmComment } from '../api.js';
import type { Swarm } from '../../shared/types/index.js';

interface Props {
  swarmId: string;
  swarm: Swarm;
  isOpen: boolean;
  onClose: () => void;
}

export function CollaborationPanel({ swarmId, swarm, isOpen, onClose }: Props) {
  const [versions, setVersions] = useState<SwarmVersionInfo[]>([]);
  const [comments, setComments] = useState<SwarmComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [tab, setTab] = useState<'versions' | 'comments'>('comments');

  const reload = () => {
    getVersionHistory(swarmId).then(setVersions).catch(() => {});
    getComments(swarmId).then(setComments).catch(() => {});
  };

  useEffect(() => {
    if (!isOpen) return;
    reload();
  }, [swarmId, isOpen]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await addComment(swarmId, newComment.trim());
    setNewComment('');
    reload();
  };

  const handleResolve = async (commentId: string) => {
    await resolveCommentApi(swarmId, commentId);
    reload();
  };

  const handleSaveVersion = async () => {
    await saveVersion(swarmId, swarm, 'Manual snapshot');
    reload();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 12,
        width: '90%', maxWidth: 700, maxHeight: '85vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18 }}>Collaboration</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setTab('comments')} style={tabStyle(tab === 'comments')}>
                Comments ({comments.filter(c => !c.resolved).length})
              </button>
              <button onClick={() => setTab('versions')} style={tabStyle(tab === 'versions')}>
                Versions ({versions.length})
              </button>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18 }}>X</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {tab === 'comments' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add a comment..."
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                  }}
                />
                <button onClick={handleAddComment} style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'var(--accent-primary)', color: 'var(--text-inverse)', fontWeight: 600, fontSize: 13,
                }}>Post</button>
              </div>

              {comments.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>No comments yet. Start a conversation about this swarm design.</p>}
              {comments.map(c => (
                <div key={c.id} style={{
                  padding: '10px 14px', marginBottom: 8, borderRadius: 8, background: 'var(--bg-surface)',
                  opacity: c.resolved ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-accent)', fontSize: 12, fontWeight: 600 }}>{c.userName}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{new Date(c.timestamp).toLocaleString()}</span>
                      {!c.resolved && (
                        <button onClick={() => handleResolve(c.id)} style={{
                          background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)',
                          padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                        }}>Resolve</button>
                      )}
                    </div>
                  </div>
                  <p style={{ color: 'var(--text-primary)', fontSize: 13, margin: '6px 0 0', lineHeight: 1.5 }}>{c.content}</p>
                  {c.resolved && <span style={{ color: 'var(--status-ok-strong, #16a34a)', fontSize: 11 }}>Resolved</span>}
                </div>
              ))}
            </div>
          )}

          {tab === 'versions' && (
            <div>
              <button onClick={handleSaveVersion} style={{
                padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: 'var(--accent-primary)', color: 'var(--text-inverse)', fontWeight: 600, fontSize: 13, marginBottom: 16,
              }}>Save Current Version</button>

              {versions.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>No versions saved yet. Save a snapshot to track changes over time.</p>}
              {versions.map(v => (
                <div key={v.id} style={{
                  padding: '10px 14px', marginBottom: 8, borderRadius: 8, background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-accent)', fontWeight: 600 }}>v{v.version}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{new Date(v.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 13, marginTop: 4 }}>{v.changeDescription || 'No description'}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 4 }}>by {v.userName}</div>
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
    background: active ? 'var(--accent-primary)' : 'var(--bg-overlay)',
    color: active ? 'var(--text-inverse)' : 'var(--text-secondary)',
  };
}
