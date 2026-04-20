import React, { useState, useRef, useEffect, useCallback } from 'react';
import { askCopilot } from '../api.js';

// --- Types ---

interface AssistantDashboardProps {
  swarmId: string;
  onClose: () => void;
}

interface Task {
  id: string;
  title: string;
  priority: 'P1' | 'P2' | 'P3';
  dueDate: string;
  source: string;
  column: 'todo' | 'inprogress' | 'done' | 'blocked';
}

interface TimeSlot {
  time: string;
  label: string;
  type: 'meeting' | 'task' | 'reminder' | null;
}

interface Doc {
  id: string;
  title: string;
  type: 'doc' | 'deck' | 'email';
  status: 'draft' | 'ready' | 'sent';
  createdAt: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// --- Constants ---

const PRIORITY_COLORS = { P1: '#ef4444', P2: '#fbbf24', P3: '#00d9ff' };
const TYPE_COLORS = { meeting: '#a78bfa', task: '#00d9ff', reminder: '#fbbf24' };
const KANBAN_COLS = [
  { key: 'todo' as const, label: 'To Do', color: '#6366f1' },
  { key: 'inprogress' as const, label: 'In Progress', color: '#00d9ff' },
  { key: 'done' as const, label: 'Done', color: '#22c55e' },
  { key: 'blocked' as const, label: 'Blocked', color: '#ef4444' },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function storageKey(swarmId: string, suffix: string) {
  return `assistant-${swarmId}-${suffix}`;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function buildTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let h = 8; h < 18; h++) {
    for (const m of [0, 30]) {
      const hour = h > 12 ? h - 12 : h;
      const ampm = h >= 12 ? 'pm' : 'am';
      const min = m === 0 ? '00' : '30';
      slots.push({ time: `${hour}:${min} ${ampm}`, label: '', type: null });
    }
  }
  return slots;
}

function todayString(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// --- Component ---

export function AssistantDashboard({ swarmId, onClose }: AssistantDashboardProps) {
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set(['tasks']));
  const [tasks, setTasks] = useState<Task[]>(() =>
    loadJson(storageKey(swarmId, 'tasks'), [])
  );
  const [schedule, setSchedule] = useState<TimeSlot[]>(() =>
    loadJson(storageKey(swarmId, 'schedule'), buildTimeSlots())
  );
  const [transcript, setTranscript] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<Task[]>([]);
  const [uncheckedItems, setUncheckedItems] = useState<Set<string>>(new Set());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'I\'m your personal assistant. Ask me anything: prioritize your day, create documents, set reminders, or analyze meeting notes.' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [slotInput, setSlotInput] = useState('');
  const [slotType, setSlotType] = useState<'meeting' | 'task' | 'reminder'>('task');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persist state
  useEffect(() => { localStorage.setItem(storageKey(swarmId, 'tasks'), JSON.stringify(tasks)); }, [tasks, swarmId]);
  useEffect(() => { localStorage.setItem(storageKey(swarmId, 'docs'), JSON.stringify(docs)); }, [docs, swarmId]);
  useEffect(() => { localStorage.setItem(storageKey(swarmId, 'schedule'), JSON.stringify(schedule)); }, [schedule, swarmId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // Stats
  const todayTasks = tasks.filter(t => t.column !== 'done').length;
  const meetings = schedule.filter(s => s.type === 'meeting').length;
  const followUps = tasks.filter(t => t.priority === 'P1' && t.column === 'todo').length;

  // --- Handlers ---

  const handleExtractActions = useCallback(async () => {
    if (!transcript.trim() || extracting) return;
    setExtracting(true);
    try {
      const prompt = `Extract all action items, decisions, and follow-ups from this meeting transcript. For each item, provide: task description, priority (P1/P2/P3), suggested due date (YYYY-MM-DD). Output ONLY a JSON array with objects like: {"title": "...", "priority": "P1", "dueDate": "2026-04-15"}. No markdown fences.\n\nTranscript:\n${transcript}`;
      const res = await askCopilot([{ role: 'user', content: prompt }], swarmId);
      const cleaned = res.answer.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed: Array<{ title: string; priority: string; dueDate: string }> = JSON.parse(cleaned);
      const items: Task[] = parsed.map(item => ({
        id: generateId(),
        title: item.title,
        priority: (item.priority as Task['priority']) || 'P3',
        dueDate: item.dueDate || '',
        source: 'Meeting transcript',
        column: 'todo',
      }));
      setExtractedItems(items);
    } catch {
      setExtractedItems([]);
    } finally {
      setExtracting(false);
    }
  }, [transcript, extracting, swarmId]);

  const togglePanel = useCallback((panel: string) => {
    setOpenPanels(prev => {
      const next = new Set(prev);
      if (next.has(panel)) {
        next.delete(panel);
      } else {
        next.add(panel);
      }
      return next;
    });
  }, []);

  const addExtractedToTasks = useCallback(() => {
    const checked = extractedItems.filter(item => !uncheckedItems.has(item.id));
    setTasks(prev => [...prev, ...checked]);
    setExtractedItems([]);
    setUncheckedItems(new Set());
    setTranscript('');
    setOpenPanels(prev => new Set([...prev, 'tasks']));
  }, [extractedItems, uncheckedItems]);

  const handleChatSend = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: text }]);
    setChatLoading(true);
    try {
      const history = [...chatMessages.slice(1), { role: 'user' as const, content: text }]
        .map(m => ({ role: m.role, content: m.content }));
      const res = await askCopilot(history, swarmId);
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.answer }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach the assistant. Check that your API key is configured in Settings.' }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, swarmId]);

  const handlePlanDay = useCallback(async () => {
    const taskList = tasks.filter(t => t.column !== 'done').map(t => `- [${t.priority}] ${t.title} (due: ${t.dueDate})`).join('\n');
    if (!taskList) return;
    setChatMessages(prev => [...prev, { role: 'user', content: 'Plan my day based on my current tasks.' }]);
    setChatLoading(true);
    try {
      const prompt = `Here are my current tasks:\n${taskList}\n\nPrioritize these for my day. Suggest a time-blocked schedule from 8am to 6pm. Be concise.`;
      const res = await askCopilot([{ role: 'user', content: prompt }], swarmId);
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.answer }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Could not plan your day right now.' }]);
    } finally {
      setChatLoading(false);
    }
  }, [tasks, swarmId]);

  const handleSlotSave = useCallback((index: number) => {
    if (!slotInput.trim()) { setEditingSlot(null); return; }
    setSchedule(prev => prev.map((s, i) => i === index ? { ...s, label: slotInput.trim(), type: slotType } : s));
    setEditingSlot(null);
    setSlotInput('');
  }, [slotInput, slotType]);

  const handleSlotClear = useCallback((index: number) => {
    setSchedule(prev => prev.map((s, i) => i === index ? { ...s, label: '', type: null } : s));
  }, []);

  const handleDrop = useCallback((column: Task['column']) => {
    if (!draggedTaskId) return;
    setTasks(prev => prev.map(t => t.id === draggedTaskId ? { ...t, column } : t));
    setDraggedTaskId(null);
  }, [draggedTaskId]);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  // --- Styles ---

  const s = {
    overlay: {
      position: 'fixed' as const, inset: 0, zIndex: 1000,
      background: 'var(--bg-base, #0a0e1a)', color: 'var(--text-primary, #e2e8f0)',
      display: 'flex', flexDirection: 'column' as const, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    topBar: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px', borderBottom: '1px solid var(--border-default, #1e293b)',
      background: 'var(--bg-elevated, #111827)',
    },
    title: { fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' },
    stats: { display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-secondary, #94a3b8)' },
    statNum: { fontWeight: 700, color: '#00d9ff' },
    closeBtn: {
      width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border-default, #1e293b)',
      background: 'transparent', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', fontSize: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    body: { display: 'flex', flex: 1, overflow: 'hidden' },
    panelsArea: { flex: 1, display: 'flex', overflow: 'hidden' },
    panel: {
      flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
      borderRight: '1px solid var(--border-default, #1e293b)',
    },
    panelHeader: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderBottom: '1px solid var(--border-default, #1e293b)',
      background: 'var(--bg-elevated, #111827)',
    },
    panelTitle: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, color: 'var(--text-secondary, #94a3b8)', letterSpacing: 1 },
    panelCloseBtn: {
      width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border-default, #2d3748)',
      background: 'transparent', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', fontSize: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    chatCol: {
      width: 320, borderLeft: '1px solid var(--border-default, #1e293b)',
      display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', flexShrink: 0,
    },
    sectionTitle: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, color: 'var(--text-secondary, #94a3b8)', letterSpacing: 1, padding: '12px 16px 6px' },
    toggleBtn: (active: boolean) => ({
      padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 6,
      background: active ? '#00d9ff' : 'transparent',
      color: active ? '#0a0e1a' : '#00d9ff',
      border: active ? '1px solid #00d9ff' : '1px solid #00d9ff44',
    }),
    card: {
      background: 'var(--bg-surface, #1e293b)', borderRadius: 8,
      border: '1px solid var(--border-default, #2d3748)', padding: 10, marginBottom: 6, cursor: 'grab',
    },
    input: {
      width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-default, #2d3748)',
      background: 'var(--bg-surface, #1e293b)', color: 'var(--text-primary, #e2e8f0)',
      fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
    },
    btn: (bg: string) => ({
      padding: '6px 14px', borderRadius: 6, border: 'none',
      background: bg, color: bg === '#00d9ff' ? '#0a0e1a' : '#e2e8f0',
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
    }),
    badge: (color: string) => ({
      display: 'inline-block', padding: '2px 6px', borderRadius: 4,
      background: color + '22', color, fontSize: 10, fontWeight: 700,
    }),
  };

  // --- Render helpers ---

  function renderSchedule() {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, padding: '12px 4px 8px', color: 'var(--text-primary, #e2e8f0)' }}>
          {todayString()}
        </div>
        {schedule.map((slot, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', minHeight: 30 }}>
            <span style={{ width: 60, fontSize: 11, color: 'var(--text-secondary, #94a3b8)', flexShrink: 0 }}>{slot.time}</span>
            {editingSlot === i ? (
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                <input
                  autoFocus value={slotInput} onChange={e => setSlotInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSlotSave(i)}
                  style={{ ...s.input, padding: '4px 6px', fontSize: 11, flex: 1 }}
                  placeholder="Add item..."
                />
                <select
                  value={slotType} onChange={e => setSlotType(e.target.value as 'meeting' | 'task' | 'reminder')}
                  style={{ ...s.input, width: 72, padding: '4px 2px', fontSize: 10 }}
                >
                  <option value="task">Task</option>
                  <option value="meeting">Meeting</option>
                  <option value="reminder">Remind</option>
                </select>
                <button onClick={() => handleSlotSave(i)} style={s.btn('#00d9ff')}>OK</button>
              </div>
            ) : slot.label ? (
              <div
                style={{
                  flex: 1, padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                  background: (TYPE_COLORS[slot.type || 'task']) + '18',
                  borderLeft: `3px solid ${TYPE_COLORS[slot.type || 'task']}`,
                  color: 'var(--text-primary, #e2e8f0)', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                onClick={() => { setEditingSlot(i); setSlotInput(slot.label); setSlotType(slot.type || 'task'); }}
              >
                <span>{slot.label}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleSlotClear(i); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}
                >x</button>
              </div>
            ) : (
              <div
                onClick={() => { setEditingSlot(i); setSlotInput(''); setSlotType('task'); }}
                style={{ flex: 1, padding: '3px 8px', borderRadius: 4, fontSize: 11, color: 'var(--text-secondary, #64748b)', cursor: 'pointer' }}
              >
                + Add
              </div>
            )}
          </div>
        ))}
        <button onClick={handlePlanDay} style={{ ...s.btn('#00d9ff'), width: '100%', marginTop: 12, padding: '10px 0' }}>
          Plan My Day
        </button>
      </div>
    );
  }

  function renderInbox() {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary, #e2e8f0)' }}>Meeting Transcripts</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary, #94a3b8)', marginBottom: 16, lineHeight: 1.5 }}>
          Paste a meeting transcript below and your assistant will extract every action item, decision, and follow-up. They'll be added to your task board automatically.
        </div>
        <textarea
          value={transcript} onChange={e => setTranscript(e.target.value)}
          placeholder="Paste your meeting transcript here. Your assistant will find every action item, decision, and follow-up and add them to your task board."
          style={{ ...s.input, height: 200, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <button
          onClick={handleExtractActions}
          disabled={extracting || !transcript.trim()}
          style={{ ...s.btn('#00d9ff'), marginTop: 10, opacity: extracting || !transcript.trim() ? 0.5 : 1 }}
        >
          {extracting ? 'Reading your transcript...' : 'Extract Action Items'}
        </button>

        {extractedItems.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Found {extractedItems.length} items</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 12 }}>Uncheck anything you don't want added to your tasks.</div>
            {extractedItems.map(item => (
              <div key={item.id} style={{ ...s.card, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <input type="checkbox" checked={!uncheckedItems.has(item.id)} onChange={() => setUncheckedItems(prev => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} style={{ marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                    <span style={s.badge(PRIORITY_COLORS[item.priority])}>{item.priority}</span>
                    {item.dueDate && <span style={{ fontSize: 11, color: 'var(--text-secondary, #94a3b8)' }}>Due: {item.dueDate}</span>}
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addExtractedToTasks} style={{ ...s.btn('#22c55e'), marginTop: 10 }}>
              Add to Task Board
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderKanban() {
    return (
      <div style={{ flex: 1, display: 'flex', gap: 12, padding: 16, overflowX: 'auto' }}>
        {KANBAN_COLS.map(col => (
          <div
            key={col.key}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(col.key)}
            style={{
              flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column',
              background: 'var(--bg-elevated, #111827)', borderRadius: 8,
              border: '1px solid var(--border-default, #1e293b)', overflow: 'hidden',
            }}
          >
            <div style={{ borderTop: `3px solid ${col.color}`, padding: '10px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #94a3b8)' }}>
              {col.label} <span style={{ fontWeight: 400, opacity: 0.6 }}>({tasks.filter(t => t.column === col.key).length})</span>
            </div>
            <div style={{ flex: 1, padding: '4px 8px 8px', overflowY: 'auto' }}>
              {tasks.filter(t => t.column === col.key).map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => setDraggedTaskId(task.id)}
                  onDragEnd={() => setDraggedTaskId(null)}
                  style={{ ...s.card, opacity: draggedTaskId === task.id ? 0.4 : 1 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4 }}>{task.title}</div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #64748b)', cursor: 'pointer', fontSize: 11, padding: '0 2px', flexShrink: 0 }}
                    >x</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={s.badge(PRIORITY_COLORS[task.priority])}>{task.priority}</span>
                    {task.dueDate && <span style={{ fontSize: 10, color: 'var(--text-secondary, #94a3b8)' }}>{task.dueDate}</span>}
                  </div>
                  {task.source && <div style={{ fontSize: 10, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>{task.source}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderChat() {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ ...s.sectionTitle, borderBottom: '1px solid var(--border-default, #1e293b)' }}>Chat with your assistant</div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {chatMessages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: '8px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5,
                background: msg.role === 'user' ? '#00d9ff' : 'var(--bg-surface, #1e293b)',
                color: msg.role === 'user' ? '#0a0e1a' : 'var(--text-primary, #e2e8f0)',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)', padding: '4px 12px' }}>Thinking...</div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div style={{ padding: 10, borderTop: '1px solid var(--border-default, #1e293b)', display: 'flex', gap: 6 }}>
          <input
            value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
            placeholder="Ask your assistant..."
            style={{ ...s.input, flex: 1 }}
          />
          <button onClick={handleChatSend} disabled={chatLoading} style={s.btn('#00d9ff')}>Send</button>
        </div>
      </div>
    );
  }

  // --- Main render ---

  return (
    <div style={s.overlay}>
      {/* Top bar */}
      <div style={s.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={s.title}>My Assistant</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => togglePanel('transcripts')} style={s.toggleBtn(openPanels.has('transcripts'))}>Transcripts</button>
            <button onClick={() => togglePanel('tasks')} style={s.toggleBtn(openPanels.has('tasks'))}>Tasks</button>
            <button onClick={() => togglePanel('calendar')} style={s.toggleBtn(openPanels.has('calendar'))}>Calendar</button>
          </div>
        </div>
        <div style={s.stats}>
          <span><span style={s.statNum}>{todayTasks}</span> tasks today</span>
          <span><span style={s.statNum}>{meetings}</span> meetings</span>
          <span><span style={s.statNum}>{followUps}</span> follow-ups due</span>
        </div>
        <button onClick={onClose} style={s.closeBtn}>X</button>
      </div>

      {/* Body */}
      <div style={s.body}>
        {/* Left: Open panels */}
        <div style={s.panelsArea}>
          {openPanels.has('transcripts') && (
            <div style={s.panel}>
              <div style={s.panelHeader}>
                <span style={s.panelTitle}>Transcripts</span>
                <button onClick={() => togglePanel('transcripts')} style={s.panelCloseBtn}>x</button>
              </div>
              {renderInbox()}
            </div>
          )}
          {openPanels.has('tasks') && (
            <div style={s.panel}>
              <div style={s.panelHeader}>
                <span style={s.panelTitle}>Tasks</span>
                <button onClick={() => togglePanel('tasks')} style={s.panelCloseBtn}>x</button>
              </div>
              {renderKanban()}
            </div>
          )}
          {openPanels.has('calendar') && (
            <div style={s.panel}>
              <div style={s.panelHeader}>
                <span style={s.panelTitle}>Calendar</span>
                <button onClick={() => togglePanel('calendar')} style={s.panelCloseBtn}>x</button>
              </div>
              {renderSchedule()}
            </div>
          )}
          {openPanels.size === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #64748b)', fontSize: 14 }}>
              Use the buttons above to open panels
            </div>
          )}
        </div>

        {/* Right: Chat (always visible) */}
        <div style={s.chatCol}>
          {renderChat()}
        </div>
      </div>
    </div>
  );
}
