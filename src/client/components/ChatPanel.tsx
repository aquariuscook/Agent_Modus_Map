import React, { useState, useRef, useEffect } from 'react';
import { askQuestion, type RAGResponse } from '../api.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: RAGResponse['sources'];
  graphHighlights?: string[];
  queryType?: string;
}

interface ChatPanelProps {
  swarmId: string;
  isOpen: boolean;
  onToggle: () => void;
  onHighlightAgents?: (nicknames: string[]) => void;
}

export function ChatPanel({ swarmId, isOpen, onToggle, onHighlightAgents }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: 'Ask me anything about your swarm. Try:\n- "What happens if Catalog goes down?"\n- "What are the bottlenecks?"\n- "How should I handle failover?"\n- "Path from Domino to Courier"',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const response = await askQuestion(swarmId, question);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        graphHighlights: response.graphHighlights,
        queryType: response.queryType,
      }]);

      if (response.graphHighlights.length > 0 && onHighlightAgents) {
        onHighlightAgents(response.graphHighlights);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#00d9ff',
          border: 'none',
          color: '#0a1628',
          fontSize: 22,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0, 217, 255, 0.4)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Ask about your swarm"
      >
        ?
      </button>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: 20,
      width: 420,
      height: 500,
      background: 'rgba(15, 23, 42, 0.97)',
      border: '1px solid rgba(0, 217, 255, 0.3)',
      borderRadius: 16,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 30,
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#00d9ff' }}>Ask Your Swarm</span>
        <button onClick={onToggle} style={{
          background: 'none', border: 'none', color: '#8b9dc3', cursor: 'pointer', fontSize: 18,
        }}>{'\u00D7'}</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            marginBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '90%',
              padding: '10px 14px',
              borderRadius: 12,
              background: msg.role === 'user' ? 'rgba(0, 217, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(0, 217, 255, 0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}>
              <div style={{ fontSize: 13, color: '#fff', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {msg.content}
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                  <div style={{ fontSize: 10, color: '#8b9dc3', marginBottom: 4 }}>Sources:</div>
                  {msg.sources.map((s, j) => (
                    <div key={j} style={{ fontSize: 11, color: '#a0aec0', marginBottom: 2 }}>
                      {s.title}
                    </div>
                  ))}
                </div>
              )}

              {msg.queryType && (
                <div style={{ marginTop: 4, fontSize: 10, color: '#8b9dc3' }}>
                  {msg.queryType === 'graph' ? 'From your swarm data' :
                   msg.queryType === 'both' ? 'Swarm data + best practices' :
                   'From best practices'}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ fontSize: 12, color: '#8b9dc3', fontStyle: 'italic' }}>Thinking...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        gap: 8,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your swarm..."
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(0, 217, 255, 0.2)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: '#fff',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#00d9ff',
            color: '#0a1628',
            fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
            fontSize: 13,
          }}
        >
          Ask
        </button>
      </div>
    </div>
  );
}
