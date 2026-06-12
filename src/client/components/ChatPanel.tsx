import React, { useState, useRef, useEffect, useCallback } from 'react';
import { askCopilotStreaming, type CopilotStatusEvent } from '../api.js';
import { Logo } from './Logo.js';
import { ActivityLine } from './chat/ActivityLine.js';
import { ThinkingIndicator } from './chat/ThinkingIndicator.js';
import { ChatInput } from './chat/ChatInput.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  swarmId: string;
  isOpen: boolean;
  onToggle: () => void;
  onHighlightAgents?: (nicknames: string[]) => void;
}

const MIN_PANEL_WIDTH = 320;
const DEFAULT_PANEL_WIDTH = 420;
const MAX_PANEL_WIDTH_RATIO = 0.9; // never exceed 90% of viewport width

export function ChatPanel({ swarmId, isOpen, onToggle, onHighlightAgents }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: 'Hey, I\'m the Agent Modus copilot. I can help you with anything:\n\n- "Help me set up a lead gen swarm"\n- "How do I add my API keys?"\n- "What does each agent do?"\n- "Why isn\'t my deploy returning good results?"\n- "Help me write a better search query"',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusEvents, setStatusEvents] = useState<CopilotStatusEvent[]>([]);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusEvents]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    setStatusEvents([]);

    try {
      const history = [...messages.slice(1), { role: 'user' as const, content: question }]
        .map(m => ({ role: m.role, content: m.content }));

      const result = await askCopilotStreaming(history, swarmId, (event) => {
        setStatusEvents(prev => [...prev, event]);
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.answer,
      }]);
    } catch (err: any) {
      const msg = err.message || 'Something went wrong.';
      const isConfig = msg.includes('API key') || msg.includes('Add any');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isConfig
          ? 'Add any LLM API key in Settings (Anthropic, NVIDIA, or OpenAI) to use the copilot.'
          : `Error: ${msg}`,
      }]);
    } finally {
      setLoading(false);
      setStatusEvents([]);
    }
  }

  // Drag handle: adjust panel width from the left edge of the chat panel.
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = resizeHandleRef.current;
    if (!handle) return;

    let startX = 0;
    let startWidth = 0;
    let dragging = false;

    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const maxWidth = Math.floor(window.innerWidth * MAX_PANEL_WIDTH_RATIO);
      // Dragging left increases width (cursor on left edge), dragging right shrinks.
      const delta = startX - e.clientX;
      const next = Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, startWidth + delta));
      setPanelWidth(next);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const onDown = (e: MouseEvent) => {
      dragging = true;
      startX = e.clientX;
      startWidth = panelWidth;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    };

    handle.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      handle.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panelWidth]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--bg-elevated)',
          border: '2px solid var(--accent-primary)',
          cursor: 'pointer',
          boxShadow: '0 4px 20px var(--border-accent)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
        title="Ask about your swarm"
      >
        <Logo size={36} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      right: 20,
      width: panelWidth,
      maxWidth: '90vw',
      height: 500,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-accent)',
      borderRadius: 16,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 30,
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
    }}>
      {/* Drag handle on left edge to resize panel width */}
      <div
        ref={resizeHandleRef}
        title="Drag to resize"
        style={{
          position: 'absolute',
          left: 0,
          top: 12,
          bottom: 12,
          width: 6,
          marginLeft: -3,
          cursor: 'ew-resize',
          borderRadius: 3,
          zIndex: 1,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-primary-muted)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      />

      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-accent)' }}>Copilot</span>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18 }}>{'×'}</button>
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
              background: msg.role === 'user' ? 'var(--accent-primary-muted)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${msg.role === 'user' ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {/* Thinking indicator + Activity log during loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 16px',
              borderRadius: '16px 16px 16px 4px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 200,
              maxWidth: 360,
            }}>
              <ThinkingIndicator />
              {statusEvents.map((evt, i) => (
                <ActivityLine key={i} event={evt} isLatest={i === statusEvents.length - 1} />
              ))}
              {statusEvents.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Connecting…</div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          placeholder="Ask about your swarm..."
          disabled={loading}
          textareaRef={textareaRef}
        />
      </div>
    </div>
  );
}
