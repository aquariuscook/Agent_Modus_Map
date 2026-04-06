import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  fetchProspects,
  fetchProspectStats,
  updateProspectStatus,
  updateProspectNotes,
  bulkUpdateProspectStatus,
  deleteProspectById,
  exportProspectsCSV,
} from '../api.js';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type PipelineStatus = 'new' | 'contacted' | 'responded' | 'meeting' | 'qualified' | 'proposal' | 'won' | 'lost' | 'archived';

const PIPELINE_STAGES: PipelineStatus[] = [
  'new', 'contacted', 'responded', 'meeting', 'qualified', 'proposal', 'won', 'lost', 'archived',
];

const STATUS_COLORS: Record<PipelineStatus, { bg: string; text: string }> = {
  new:        { bg: 'rgba(0,217,255,0.15)',   text: '#00d9ff' },
  contacted:  { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
  responded:  { bg: 'rgba(147,51,234,0.15)',  text: '#9333ea' },
  meeting:    { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e' },
  qualified:  { bg: 'rgba(234,179,8,0.15)',   text: '#eab308' },
  proposal:   { bg: 'rgba(249,115,22,0.15)',  text: '#f97316' },
  won:        { bg: 'rgba(16,185,129,0.15)',  text: '#10b981' },
  lost:       { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444' },
  archived:   { bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
};

interface ProspectOutreach {
  professional: string;
  conversational: string;
  valueLead: string;
}

interface Prospect {
  id?: string;
  company: string;
  website: string;
  linkedin: string;
  industry: string;
  location: string;
  employees: string;
  revenue: string;
  score: number;
  signals: string[];
  contactName: string;
  contactTitle: string;
  contactLinkedIn: string;
  contactEmail: string;
  outreach: ProspectOutreach;
  status: PipelineStatus;
  notes: string;
}

interface ProspectStats {
  total: number;
  avgScore: number;
  byStatus: Record<string, number>;
}

interface DashboardData {
  prospects: Prospect[];
  summary: {
    totalProspects: number;
    avgScore: number;
    topIndustry: string;
    topSignal: string;
  };
}

interface Props {
  runData?: any;
  onClose: () => void;
  minScore?: number;
  showAll?: boolean;
}

// ------------------------------------------------------------------
// Normalizer: handles Command's varying JSON shapes
// ------------------------------------------------------------------

function normalizeProspect(raw: any): Prospect {
  const co = typeof raw.company === 'object' ? raw.company : null;
  const company = co?.name || raw.companyName || raw.company || raw.name || 'Unknown';
  const website = co?.website || raw.website || '';
  const linkedin = co?.linkedinCompanyUrl || co?.linkedin || raw.linkedinCompanyUrl || raw.linkedin
    || `https://linkedin.com/company/${company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`;
  const industry = co?.industry || raw.industry || '';
  const location = co?.location || raw.location || '';
  const employees = co?.employeeCount || co?.employees || raw.employeeCount || raw.employees || '';
  const revenue = co?.revenueEstimate || co?.revenue || raw.revenueEstimate || raw.revenue || '';

  const score = raw.leadScore || raw.score || co?.leadScore || 5;
  const signals = raw.signals || raw.buyingSignals || [];
  const signalArr = Array.isArray(signals)
    ? signals.map((s: any) => (typeof s === 'string' ? s : s.signal || s.description || JSON.stringify(s)))
    : [];

  const contact = raw.contact || raw.decisionMaker || {};
  const contactName = contact.name || raw.contactName || '';
  const contactTitle = contact.title || contact.role || raw.contactTitle || '';
  const contactLinkedIn = contact.linkedinUrl || contact.linkedin || raw.contactLinkedIn || '';
  const contactEmail = contact.email || raw.contactEmail || '';

  const outreach = raw.outreach || raw.outreachEmails || {};
  const getEmail = (key: string) => {
    const val = outreach[key];
    if (!val) return '';
    if (typeof val === 'string') return val;
    const parts: string[] = [];
    if (val.subject) parts.push(`Subject: ${val.subject}`);
    if (val.body) parts.push(val.body);
    return parts.join('\n\n') || JSON.stringify(val);
  };

  const status: PipelineStatus = raw.status && PIPELINE_STAGES.includes(raw.status) ? raw.status : 'new';

  return {
    id: raw.id || raw._id || undefined,
    company,
    website,
    linkedin,
    industry,
    location,
    employees: String(employees),
    revenue: String(revenue),
    score: typeof score === 'number' ? Math.min(10, Math.max(1, score)) : 5,
    signals: signalArr.slice(0, 5),
    contactName,
    contactTitle,
    contactLinkedIn,
    contactEmail,
    outreach: {
      professional: getEmail('professional') || getEmail('formal') || '',
      conversational: getEmail('conversational') || getEmail('warm') || getEmail('casual') || '',
      valueLead: getEmail('valueLead') || getEmail('value') || getEmail('insight') || '',
    },
    status,
    notes: raw.notes || '',
  };
}

// ------------------------------------------------------------------
// Run data parsing (Command agent JSON extraction)
// ------------------------------------------------------------------

function parseDashboardData(runData: any): DashboardData | null {
  const steps = runData?.steps || [];

  const commandSteps = steps.filter(
    (s: any) => s.nickname === 'Command' && s.status === 'success' && s.output,
  );

  if (commandSteps.length > 0) {
    const allProspects: Prospect[] = [];

    for (const commandStep of commandSteps) {
      try {
        const cleaned = commandStep.output.replace(/^```json\s*/m, '').replace(/```\s*$/m, '');
        const jsonMatch = cleaned.match(/\{[\s\S]*"prospects"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.prospects && Array.isArray(parsed.prospects)) {
            allProspects.push(...parsed.prospects.map((p: any) => normalizeProspect(p)));
          }
        }
      } catch { /* skip bad JSON */ }
    }

    if (allProspects.length > 0) {
      const byName = new Map<string, Prospect>();
      for (const p of allProspects) {
        const key = p.company.toLowerCase().trim();
        const existing = byName.get(key);
        if (!existing || p.score > existing.score) byName.set(key, p);
      }
      const deduped = [...byName.values()];
      return buildSummary(deduped);
    }
  }

  return extractFromRawSteps(steps);
}

function buildSummary(prospects: Prospect[]): DashboardData {
  const avgScore = prospects.length > 0
    ? Math.round(prospects.reduce((s, p) => s + p.score, 0) / prospects.length * 10) / 10
    : 0;

  const industries = prospects.map(p => p.industry).filter(Boolean);
  const topIndustry = industries.length > 0
    ? industries.sort((a, b) => industries.filter(i => i === b).length - industries.filter(i => i === a).length)[0]
    : '';

  return {
    prospects,
    summary: {
      totalProspects: prospects.length,
      avgScore,
      topIndustry: topIndustry || 'Mixed',
      topSignal: prospects[0]?.signals[0] || '',
    },
  };
}

function extractFromRawSteps(steps: any[]): DashboardData | null {
  const getOutput = (nickname: string) => {
    const step = steps.find((s: any) => s.nickname === nickname && s.status === 'success');
    return step?.output || '';
  };

  const scoutOutput = getOutput('Scout');
  const profileOutput = getOutput('Profile');
  const qualifyOutput = getOutput('Qualify');
  const craftOutput = getOutput('Craft');
  const socialOutput = getOutput('Social');

  if (!scoutOutput && !profileOutput) return null;

  const prospects: Prospect[] = [];
  const prospectBlocks = profileOutput.split(
    /(?=##\s+PROSPECT|##\s+[A-Z][A-Z\s&]+(?:CONSULTING|INC|LLC|CORP|GROUP|SERVICES|SOLUTIONS))/i,
  );
  const scoutBlocks = scoutOutput.split(
    /(?=##\s+(?:PRIMARY|PROSPECT|IDENTIFIED)|(?:\*\*\d+\.))/i,
  );

  for (const block of prospectBlocks) {
    if (block.length < 50) continue;
    const prospect = parseProspectBlock(block, qualifyOutput, craftOutput, socialOutput);
    if (prospect) prospects.push(prospect);
  }

  if (prospects.length === 0) {
    for (const block of scoutBlocks) {
      if (block.length < 50) continue;
      const prospect = parseProspectBlock(block, qualifyOutput, craftOutput, socialOutput);
      if (prospect) prospects.push(prospect);
    }
  }

  if (prospects.length === 0) {
    const combined = profileOutput + '\n' + scoutOutput;
    const nameMatches = combined.matchAll(
      /(?:PROSPECT[^:]*:\s*|Company[^:]*:\s*)\**([A-Z][A-Za-z\s&'.-]{3,50}(?:Consulting|Inc|LLC|Corp|Group|Services|Solutions|Associates|Partners)?)\**/g,
    );
    for (const m of nameMatches) {
      const name = m[1].trim();
      if (name.length > 3) prospects.push(buildBasicProspect(name, combined, qualifyOutput, craftOutput));
    }
  }

  if (prospects.length === 0) return null;

  const seen = new Set<string>();
  const deduped = prospects.filter(p => {
    const key = p.company.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return buildSummary(deduped);
}

function parseProspectBlock(
  block: string,
  qualifyOutput: string,
  craftOutput: string,
  socialOutput: string,
): Prospect | null {
  const nameMatch = block.match(/(?:PROSPECT[^:]*:\s*|##\s*)\**([A-Z][A-Za-z\s&'.-]{3,60})\**/);
  if (!nameMatch) return null;
  const company = nameMatch[1].trim().replace(/\*+/g, '');

  const skipWords = [
    'primary prospects', 'prospect analysis', 'assessment', 'scoring', 'summary',
    'critical', 'recommendation', 'next steps', 'what went wrong', 'pipeline', 'stage',
  ];
  if (skipWords.some(w => company.toLowerCase().includes(w))) return null;

  const website = extractField(block, /(?:Website|URL|Site)[:\s]*\**\s*(https?:\/\/[^\s)*]+)/i);
  const location = extractField(block, /(?:Location|Based|HQ|Address)[:\s]*\**\s*([A-Za-z\s,]+(?:NY|New York|Nassau|Suffolk)[^\n]*)/i);
  const industry = extractField(block, /(?:Industry|Sector|Vertical)[:\s]*\**\s*([^\n|*]+)/i);
  const employees = extractField(block, /(?:Employees?|Headcount|Staff|Size)[:\s]*\**\s*([^\n|*]+)/i);
  const revenue = extractField(block, /(?:Revenue|Est\.?\s*Revenue)[:\s]*\**\s*([^\n|*]+)/i);
  const contactName = extractField(block, /(?:Founder|CEO|Owner|Contact|Key Contact|Director)[/&:\s]*\**\s*([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const contactTitle = extractField(block, /(?:Title|Role|Position)[:\s]*\**\s*([^\n|*]+)/i)
    || extractField(block, /(?:Founder|CEO|Owner|Director|VP|President|Manager)[^\n]*/i);
  const contactEmail = extractField(block, /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const contactLinkedIn = extractField(block, /(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s)]+)/i);

  let score = 5;
  const companyLower = company.toLowerCase();
  const scoreMatch =
    qualifyOutput.match(new RegExp(`(?:${companyLower.split(/\s+/).slice(0, 2).join('.*')}).*?(?:total|score|overall)[^\\d]*(\\d+)`, 'is'))
    || qualifyOutput.match(/(?:total|overall)[^":\d]*[":]\s*(\d+)/i);
  if (scoreMatch) {
    const s = parseInt(scoreMatch[1]);
    if (s >= 1 && s <= 10) score = s;
    else if (s > 10 && s <= 50) score = Math.round(s / 5);
  }

  const signals: string[] = [];
  const signalPatterns = [
    /(?:Signal|Why|Reason|Buying Signal|Pain Point)[:\s]*\**([^\n|*]{10,100})/gi,
    /(?:hiring|posting|expanding|growing|digital transformation|automation|manual process|compliance|training)[^\n]{5,80}/gi,
  ];
  for (const pat of signalPatterns) {
    const m = block.match(pat);
    if (m) signals.push(m[0].replace(/^[^:]*:\s*\**/, '').replace(/\*+/g, '').trim().slice(0, 80));
    if (signals.length >= 3) break;
  }

  let professional = '';
  let conversational = '';
  if (craftOutput) {
    const craftLower = craftOutput.toLowerCase();
    if (craftLower.includes(companyLower.split(/\s+/)[0].toLowerCase())) {
      const emailMatch = craftOutput.match(/(?:Subject[^:]*:[^\n]*\n)([\s\S]*?)(?=\n---|\n##|\n\*Passes|$)/i);
      if (emailMatch) professional = emailMatch[1].trim().slice(0, 800);
    }
  }
  if (socialOutput) {
    const postMatch = socialOutput.match(/(?:POST|DRAFT|CONTENT)[^:]*:?\s*[^\n]*\n([\s\S]*?)(?=\n---|\n##|\n###|\n\*Passes|$)/i);
    if (postMatch) conversational = postMatch[1].trim().slice(0, 800);
  }

  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

  return {
    company,
    website: website || '',
    linkedin: `https://linkedin.com/company/${slug}`,
    industry: industry || '',
    location: location || '',
    employees: employees || '',
    revenue: revenue || '',
    score,
    signals: signals.slice(0, 3),
    contactName: contactName || '',
    contactTitle: contactTitle || '',
    contactLinkedIn: contactLinkedIn || '',
    contactEmail: contactEmail || '',
    outreach: { professional, conversational, valueLead: '' },
    status: 'new',
    notes: '',
  };
}

function buildBasicProspect(name: string, combined: string, _qualify: string, _craft: string): Prospect {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const urlMatch = combined.match(new RegExp(`${name.split(/\s+/)[0]}[^\\n]*?(https?://[^\\s)]+)`, 'i'));
  const emailMatch = combined.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

  return {
    company: name,
    website: urlMatch?.[1] || '',
    linkedin: `https://linkedin.com/company/${slug}`,
    industry: '', location: '', employees: '', revenue: '',
    score: 5, signals: [],
    contactName: '', contactTitle: '', contactLinkedIn: '',
    contactEmail: emailMatch?.[1] || '',
    outreach: { professional: '', conversational: '', valueLead: '' },
    status: 'new',
    notes: '',
  };
}

function extractField(text: string, pattern: RegExp): string {
  const m = text.match(pattern);
  return m ? m[1].trim().replace(/\*+/g, '').slice(0, 100) : '';
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

type EmailTone = 'professional' | 'conversational' | 'valueLead';
const TONE_LABELS: Record<EmailTone, string> = {
  professional: 'Professional',
  conversational: 'Conversational',
  valueLead: 'Value-First',
};

export function ProspectDashboard({ runData, onClose, minScore: minScoreProp, showAll }: Props) {
  const isDbMode = !runData && showAll === true;
  const scoreThreshold = minScoreProp ?? 0;

  // DB mode state
  const [dbProspects, setDbProspects] = useState<Prospect[]>([]);
  const [dbStats, setDbStats] = useState<ProspectStats | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Shared state
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [emailTone, setEmailTone] = useState<EmailTone>('professional');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [senderEmail, setSenderEmail] = useState(() => localStorage.getItem('prospect-dash-sender') || '');
  const [localStatuses, setLocalStatuses] = useState<Record<string, PipelineStatus>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<PipelineStatus>('contacted');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch DB prospects
  const loadDbProspects = useCallback(async () => {
    if (!isDbMode) return;
    setDbLoading(true);
    setDbError(null);
    try {
      const [prospects, stats] = await Promise.all([fetchProspects(), fetchProspectStats()]);
      setDbProspects(prospects.map(normalizeProspect));
      setDbStats(stats);
    } catch (err: any) {
      setDbError(err.message || 'Failed to load prospects');
    } finally {
      setDbLoading(false);
    }
  }, [isDbMode]);

  useEffect(() => {
    loadDbProspects();
  }, [loadDbProspects]);

  // Parse run data
  const runParsed = useMemo(() => {
    if (isDbMode || !runData) return null;
    return parseDashboardData(runData);
  }, [runData, isDbMode]);

  // Build working prospect list
  const allProspects = useMemo<Prospect[]>(() => {
    if (isDbMode) return dbProspects;
    if (!runParsed) return [];
    return runParsed.prospects;
  }, [isDbMode, dbProspects, runParsed]);

  // Apply filters
  const filteredProspects = useMemo(() => {
    let list = allProspects.filter(p => p.score >= scoreThreshold);

    if (filterStatus !== 'all') {
      list = list.filter(p => {
        const key = p.id || p.company;
        const effectiveStatus = localStatuses[key] || p.status;
        return effectiveStatus === filterStatus;
      });
    }

    if (filterIndustry !== 'all') {
      list = list.filter(p => p.industry === filterIndustry);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(p =>
        p.company.toLowerCase().includes(q)
        || p.industry.toLowerCase().includes(q)
        || p.contactName.toLowerCase().includes(q)
        || p.location.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => b.score - a.score);
  }, [allProspects, scoreThreshold, filterStatus, filterIndustry, searchText, localStatuses]);

  const selected = filteredProspects[selectedIdx] || filteredProspects[0] || null;
  const industries = useMemo(() => [...new Set(allProspects.map(p => p.industry).filter(Boolean))], [allProspects]);

  // Stats
  const stats = useMemo(() => {
    if (isDbMode && dbStats) return dbStats;
    const total = allProspects.length;
    const avgScore = total > 0
      ? Math.round(allProspects.reduce((s, p) => s + p.score, 0) / total * 10) / 10
      : 0;
    const byStatus: Record<string, number> = {};
    for (const p of allProspects) {
      const key = p.id || p.company;
      const st = localStatuses[key] || p.status;
      byStatus[st] = (byStatus[st] || 0) + 1;
    }
    return { total, avgScore, byStatus };
  }, [allProspects, isDbMode, dbStats, localStatuses]);

  // Helpers
  function getProspectKey(p: Prospect): string {
    return p.id || p.company;
  }

  function getEffectiveStatus(p: Prospect): PipelineStatus {
    return localStatuses[getProspectKey(p)] || p.status;
  }

  function getEffectiveNotes(p: Prospect): string {
    const key = getProspectKey(p);
    return key in localNotes ? localNotes[key] : p.notes;
  }

  function handleCopy(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function handleSaveSenderEmail(email: string) {
    setSenderEmail(email);
    localStorage.setItem('prospect-dash-sender', email);
  }

  async function handleStatusChange(p: Prospect, newStatus: PipelineStatus) {
    const key = getProspectKey(p);
    setLocalStatuses(prev => ({ ...prev, [key]: newStatus }));
    if (isDbMode && p.id) {
      try { await updateProspectStatus(p.id, newStatus); } catch { /* silent */ }
    }
  }

  function handleNotesChange(p: Prospect, value: string) {
    const key = getProspectKey(p);
    setLocalNotes(prev => ({ ...prev, [key]: value }));
  }

  async function handleNotesBlur(p: Prospect) {
    if (!isDbMode || !p.id) return;
    const key = getProspectKey(p);
    const val = localNotes[key];
    if (val === undefined) return;
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(async () => {
      try { await updateProspectNotes(p.id!, val); } catch { /* silent */ }
    }, 300);
  }

  function handleSendEmail(p: Prospect, tone: EmailTone) {
    const body = p.outreach[tone];
    const subject = tone === 'professional'
      ? `${p.company} - Partnership Opportunity`
      : tone === 'conversational'
        ? `Quick thought for ${p.company}`
        : `Something I noticed about ${p.company}`;
    const to = p.contactEmail || '';
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  }

  function toggleSelect(p: Prospect) {
    const key = getProspectKey(p);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredProspects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProspects.map(getProspectKey)));
    }
  }

  async function handleBulkStatusApply() {
    const ids = [...selectedIds];
    for (const key of ids) {
      setLocalStatuses(prev => ({ ...prev, [key]: bulkStatus }));
    }
    if (isDbMode) {
      const dbIds = allProspects.filter(p => p.id && selectedIds.has(getProspectKey(p))).map(p => p.id!);
      if (dbIds.length > 0) {
        try { await bulkUpdateProspectStatus(dbIds, bulkStatus); } catch { /* silent */ }
      }
    }
    setSelectedIds(new Set());
  }

  async function handleDelete(p: Prospect) {
    if (deleteConfirm !== getProspectKey(p)) {
      setDeleteConfirm(getProspectKey(p));
      return;
    }
    if (isDbMode && p.id) {
      try {
        await deleteProspectById(p.id);
        await loadDbProspects();
      } catch { /* silent */ }
    }
    setDeleteConfirm(null);
    if (selectedIdx >= filteredProspects.length - 1) setSelectedIdx(Math.max(0, selectedIdx - 1));
  }

  async function handleExportCSV() {
    try {
      const csv = await exportProspectsCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  }

  async function handleBulkDelete() {
    if (isDbMode) {
      const dbIds = allProspects.filter(p => p.id && selectedIds.has(getProspectKey(p))).map(p => p.id!);
      for (const id of dbIds) {
        try { await deleteProspectById(id); } catch { /* silent */ }
      }
      await loadDbProspects();
    }
    setSelectedIds(new Set());
  }

  // ------------------------------------------------------------------
  // Empty state
  // ------------------------------------------------------------------
  if (!isDbMode && (!runParsed || allProspects.length === 0)) {
    return (
      <div style={overlayStyle}>
        <div style={backdropStyle} onClick={onClose} />
        <div style={{ ...emptyCardStyle, zIndex: 1101 }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>{'()'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            No Prospect Data Found
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            The swarm run did not produce structured prospect data. Try running the deploy again with a more specific query.
          </div>
          <button onClick={onClose} style={primaryBtnStyle}>Close</button>
        </div>
      </div>
    );
  }

  if (isDbMode && dbLoading) {
    return (
      <div style={overlayStyle}>
        <div style={backdropStyle} onClick={onClose} />
        <div style={{ ...emptyCardStyle, zIndex: 1101 }}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading prospects...</div>
        </div>
      </div>
    );
  }

  if (isDbMode && dbError) {
    return (
      <div style={overlayStyle}>
        <div style={backdropStyle} onClick={onClose} />
        <div style={{ ...emptyCardStyle, zIndex: 1101 }}>
          <div style={{ fontSize: 14, color: '#ef4444', marginBottom: 12 }}>Error: {dbError}</div>
          <button onClick={onClose} style={primaryBtnStyle}>Close</button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Main layout
  // ------------------------------------------------------------------
  return (
    <div style={overlayStyle}>
      <div style={backdropStyle} onClick={onClose} />
      <div style={mainContainerStyle}>

        {/* ---- Top header bar ---- */}
        <div style={headerStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Prospect Dashboard
              </div>
              <span style={{
                padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                background: 'rgba(0,217,255,0.1)', color: '#00d9ff',
              }}>
                {filteredProspects.length} prospect{filteredProspects.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={senderEmail}
              onChange={e => handleSaveSenderEmail(e.target.value)}
              placeholder="Your email"
              style={inputSmallStyle}
            />
            {isDbMode && (
              <button onClick={handleExportCSV} style={outlineBtnSmallStyle}>Export CSV</button>
            )}
            <button onClick={onClose} style={closeBtnStyle}>{'\u00D7'}</button>
          </div>
        </div>

        {/* ---- Stats row ---- */}
        <div style={statsBarStyle}>
          <StatChip
            label="Total"
            value={stats.total}
            active={filterStatus === 'all'}
            onClick={() => setFilterStatus('all')}
          />
          <StatChip
            label="Avg Score"
            value={`${stats.avgScore}/10`}
            active={false}
            onClick={() => {}}
            accent
          />
          {PIPELINE_STAGES.slice(0, 6).map(st => (
            <StatChip
              key={st}
              label={st.charAt(0).toUpperCase() + st.slice(1)}
              value={stats.byStatus[st] || 0}
              active={filterStatus === st}
              onClick={() => setFilterStatus(filterStatus === st ? 'all' : st)}
              color={STATUS_COLORS[st].text}
            />
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search..."
              style={{ ...inputSmallStyle, width: 150 }}
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={selectSmallStyle}
            >
              <option value="all">All Status</option>
              {PIPELINE_STAGES.map(st => (
                <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>
              ))}
            </select>
            {industries.length > 1 && (
              <select
                value={filterIndustry}
                onChange={e => setFilterIndustry(e.target.value)}
                style={selectSmallStyle}
              >
                <option value="all">All Industries</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* ---- Run mode banner ---- */}
        {!isDbMode && (
          <div style={runBannerStyle}>
            Viewing results from Run #{runData?.id || '?'}. Save to database to track these prospects.
          </div>
        )}

        {/* ---- Two-column content ---- */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

          {/* Left panel: prospect list */}
          <div style={leftPanelStyle}>
            {/* Select all */}
            <div style={selectAllRowStyle}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: 'var(--text-tertiary)' }}>
                <input
                  type="checkbox"
                  checked={filteredProspects.length > 0 && selectedIds.size === filteredProspects.length}
                  onChange={toggleSelectAll}
                  style={{ accentColor: '#00d9ff' }}
                />
                Select All
              </label>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {filteredProspects.length} shown
              </span>
            </div>

            {filteredProspects.map((p, i) => {
              const key = getProspectKey(p);
              const isSelected = selectedIdx === i;
              const isChecked = selectedIds.has(key);
              const status = getEffectiveStatus(p);

              return (
                <div
                  key={key + '-' + i}
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    padding: '12px 16px 12px 12px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--bg-surface)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #00d9ff' : '3px solid transparent',
                    transition: 'background 0.15s, border-color 0.15s',
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => { e.stopPropagation(); toggleSelect(p); }}
                    onClick={e => e.stopPropagation()}
                    style={{ accentColor: '#00d9ff', marginTop: 2, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.company}
                      </div>
                      <ScoreBadge score={p.score} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <StatusPill status={status} small />
                      {p.industry && (
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.industry}</span>
                      )}
                    </div>
                    {p.location && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{p.location}</div>
                    )}
                    {p.signals.length > 0 && (
                      <div style={{
                        fontSize: 10, color: 'var(--text-secondary)', marginTop: 4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.signals[0]}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredProspects.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
                No prospects match current filters.
              </div>
            )}
          </div>

          {/* Right panel: detail */}
          {selected ? (
            <div style={rightPanelStyle}>
              {/* Company header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                      {selected.company}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                      {[selected.industry, selected.location, selected.employees, selected.revenue]
                        .filter(Boolean)
                        .join(' | ')}
                    </div>
                  </div>
                  <ScoreBadge score={selected.score} large />
                </div>

                {/* Link buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {selected.website && (
                    <a href={selected.website} target="_blank" rel="noopener" style={linkBtnStyle}>
                      Website
                    </a>
                  )}
                  {selected.linkedin && (
                    <a href={selected.linkedin} target="_blank" rel="noopener" style={linkedinBtnStyle}>
                      LinkedIn
                    </a>
                  )}
                  {selected.contactLinkedIn && (
                    <a href={selected.contactLinkedIn} target="_blank" rel="noopener" style={linkedinBtnStyle}>
                      Contact LinkedIn
                    </a>
                  )}
                </div>
              </div>

              {/* Contact card */}
              {(selected.contactName || selected.contactEmail) && (
                <div style={sectionCardStyle}>
                  <div style={sectionLabelStyle}>Contact</div>
                  {selected.contactName && (
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selected.contactName}
                      {selected.contactTitle && (
                        <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8, fontSize: 13 }}>
                          {selected.contactTitle}
                        </span>
                      )}
                    </div>
                  )}
                  {selected.contactEmail && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selected.contactEmail}</span>
                      <button onClick={() => handleCopy(selected.contactEmail, 'email')} style={copyBtnStyle}>
                        {copiedField === 'email' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Buying Signals */}
              {selected.signals.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={sectionLabelStyle}>Buying Signals</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selected.signals.map((s, i) => (
                      <span key={i} style={signalTagStyle}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: 16 }}>
                <div style={sectionLabelStyle}>Notes</div>
                <textarea
                  value={getEffectiveNotes(selected)}
                  onChange={e => handleNotesChange(selected, e.target.value)}
                  onBlur={() => handleNotesBlur(selected)}
                  placeholder="Add notes about this prospect..."
                  style={notesTextareaStyle}
                  rows={3}
                />
              </div>

              {/* Pipeline Status */}
              <div style={{ marginBottom: 20 }}>
                <div style={sectionLabelStyle}>Pipeline Status</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {PIPELINE_STAGES.map(st => {
                    const isCurrent = getEffectiveStatus(selected) === st;
                    const colors = STATUS_COLORS[st];
                    return (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(selected, st)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: isCurrent ? `1px solid ${colors.text}` : '1px solid var(--border-subtle)',
                          background: isCurrent ? colors.bg : 'transparent',
                          color: isCurrent ? colors.text : 'var(--text-tertiary)',
                          fontSize: 11,
                          fontWeight: isCurrent ? 700 : 500,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-primary)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Outreach email */}
              <div style={{ marginBottom: 20 }}>
                <div style={sectionLabelStyle}>Outreach Email</div>

                <div style={toneSelectorStyle}>
                  {(Object.keys(TONE_LABELS) as EmailTone[]).map(tone => (
                    <button
                      key={tone}
                      onClick={() => setEmailTone(tone)}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-primary)',
                        background: emailTone === tone
                          ? 'linear-gradient(135deg, #0891b2, #06b6d4)'
                          : 'transparent',
                        color: emailTone === tone ? '#fff' : 'var(--text-tertiary)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {TONE_LABELS[tone]}
                    </button>
                  ))}
                </div>

                {selected.outreach[emailTone] ? (
                  <div style={emailPreviewStyle}>
                    {selected.outreach[emailTone]}
                  </div>
                ) : (
                  <div style={emailEmptyStyle}>
                    No {TONE_LABELS[emailTone].toLowerCase()} email generated for this prospect.
                    Run the swarm with the Command agent to generate outreach drafts.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => handleSendEmail(selected, emailTone)}
                    disabled={!selected.contactEmail}
                    style={{
                      ...primaryBtnStyle,
                      flex: 1,
                      opacity: selected.contactEmail ? 1 : 0.4,
                      cursor: selected.contactEmail ? 'pointer' : 'default',
                    }}
                  >
                    {selected.contactEmail ? 'Send Email' : 'No Email Address'}
                  </button>
                  <button
                    onClick={() => handleCopy(selected.outreach[emailTone] || '', 'outreach')}
                    disabled={!selected.outreach[emailTone]}
                    style={{
                      ...secondaryBtnStyle,
                      opacity: selected.outreach[emailTone] ? 1 : 0.4,
                    }}
                  >
                    {copiedField === 'outreach' ? 'Copied!' : 'Copy Email'}
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                <button
                  onClick={() => handleStatusChange(selected, 'contacted')}
                  style={actionBtnStyle}
                >
                  Mark as Contacted
                </button>
                <button
                  onClick={() => handleStatusChange(selected, 'archived')}
                  style={{ ...actionBtnStyle, color: 'var(--text-tertiary)' }}
                >
                  Archive
                </button>
                <button
                  onClick={() => handleDelete(selected)}
                  style={{
                    ...actionBtnStyle,
                    color: deleteConfirm === getProspectKey(selected) ? '#fff' : '#ef4444',
                    background: deleteConfirm === getProspectKey(selected) ? '#ef4444' : 'transparent',
                    borderColor: '#ef4444',
                  }}
                >
                  {deleteConfirm === getProspectKey(selected) ? 'Confirm Delete' : 'Delete'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
                Select a prospect from the list.
              </div>
            </div>
          )}
        </div>

        {/* ---- Bulk action bar ---- */}
        {selectedIds.size > 0 && (
          <div style={bulkBarStyle}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {selectedIds.size} selected
            </span>
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value as PipelineStatus)}
              style={selectSmallStyle}
            >
              {PIPELINE_STAGES.map(st => (
                <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>
              ))}
            </select>
            <button onClick={handleBulkStatusApply} style={outlineBtnSmallStyle}>Apply</button>
            {isDbMode && (
              <button
                onClick={handleBulkDelete}
                style={{ ...outlineBtnSmallStyle, borderColor: '#ef4444', color: '#ef4444' }}
              >
                Delete Selected
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{ ...outlineBtnSmallStyle, color: 'var(--text-tertiary)', borderColor: 'var(--border-default)' }}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function ScoreBadge({ score, large }: { score: number; large?: boolean }) {
  const color = score >= 8 ? '#22c55e' : score >= 5 ? '#fbbf24' : '#ef4444';
  const bg = score >= 8 ? 'rgba(34,197,94,0.12)' : score >= 5 ? 'rgba(251,191,36,0.12)' : 'rgba(239,68,68,0.12)';
  const glow = score >= 8 ? `0 0 12px rgba(34,197,94,0.3)` : 'none';

  return (
    <span style={{
      padding: large ? '6px 14px' : '2px 8px',
      borderRadius: large ? 8 : 10,
      fontSize: large ? 18 : 10,
      fontWeight: 700,
      background: bg,
      color,
      border: `1px solid ${color}33`,
      boxShadow: large ? glow : 'none',
      fontFamily: 'var(--font-primary)',
      flexShrink: 0,
    }}>
      {score}/10
    </span>
  );
}

function StatusPill({ status, small }: { status: PipelineStatus; small?: boolean }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.new;
  return (
    <span style={{
      padding: small ? '1px 7px' : '3px 10px',
      borderRadius: 10,
      fontSize: small ? 9 : 11,
      fontWeight: 600,
      background: colors.bg,
      color: colors.text,
      textTransform: 'capitalize',
      letterSpacing: '0.02em',
      flexShrink: 0,
    }}>
      {status}
    </span>
  );
}

function StatChip({
  label,
  value,
  active,
  onClick,
  color,
  accent,
}: {
  label: string;
  value: string | number;
  active: boolean;
  onClick: () => void;
  color?: string;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 8,
        border: active ? '1px solid #00d9ff' : '1px solid var(--border-subtle)',
        background: active ? 'rgba(0,217,255,0.08)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-primary)',
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        fontSize: 14,
        fontWeight: 700,
        color: color || (accent ? '#00d9ff' : 'var(--text-primary)'),
      }}>
        {value}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </button>
  );
}

// ------------------------------------------------------------------
// Styles
// ------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(4px)',
};

const mainContainerStyle: React.CSSProperties = {
  position: 'relative',
  width: '96vw',
  maxWidth: 1400,
  height: '94vh',
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  borderRadius: 16,
  display: 'flex',
  flexDirection: 'column',
  zIndex: 1101,
  boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 1px rgba(0,217,255,0.15)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '14px 24px',
  borderBottom: '1px solid var(--border-default)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: 'linear-gradient(180deg, rgba(0,217,255,0.03) 0%, transparent 100%)',
};

const statsBarStyle: React.CSSProperties = {
  padding: '8px 24px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  overflowX: 'auto',
  flexShrink: 0,
};

const runBannerStyle: React.CSSProperties = {
  padding: '8px 24px',
  background: 'rgba(234,179,8,0.08)',
  borderBottom: '1px solid rgba(234,179,8,0.15)',
  fontSize: 12,
  color: '#eab308',
  fontWeight: 500,
  flexShrink: 0,
};

const leftPanelStyle: React.CSSProperties = {
  width: 340,
  borderRight: '1px solid var(--border-subtle)',
  overflowY: 'auto',
  flexShrink: 0,
};

const selectAllRowStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const rightPanelStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '20px 28px',
};

const emptyCardStyle: React.CSSProperties = {
  position: 'relative',
  width: 460,
  padding: 40,
  borderRadius: 16,
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  textAlign: 'center',
};

const sectionCardStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 10,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  marginBottom: 16,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 8,
};

const signalTagStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 12,
  fontSize: 11,
  background: 'rgba(0,217,255,0.08)',
  color: '#00d9ff',
  border: '1px solid rgba(0,217,255,0.2)',
};

const toneSelectorStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  marginBottom: 12,
  background: 'rgba(255,255,255,0.03)',
  borderRadius: 8,
  padding: 3,
  width: 'fit-content',
};

const emailPreviewStyle: React.CSSProperties = {
  padding: '16px 18px',
  borderRadius: 10,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  fontSize: 13,
  color: 'var(--text-secondary)',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
  maxHeight: 220,
  overflowY: 'auto',
};

const emailEmptyStyle: React.CSSProperties = {
  padding: '16px 18px',
  borderRadius: 10,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  fontSize: 13,
  color: 'var(--text-tertiary)',
  textAlign: 'center',
  lineHeight: 1.6,
};

const notesTextareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'var(--font-primary)',
  lineHeight: 1.5,
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  transition: 'opacity 0.15s',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  transition: 'opacity 0.15s',
};

const linkBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--accent-primary)',
  textDecoration: 'none',
  fontFamily: 'var(--font-primary)',
  transition: 'border-color 0.15s',
};

const linkedinBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  border: '1px solid #0a66c2',
  background: 'transparent',
  color: '#0a66c2',
  textDecoration: 'none',
  fontFamily: 'var(--font-primary)',
  transition: 'background 0.15s',
};

const copyBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 600,
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const actionBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  transition: 'all 0.15s',
};

const inputSmallStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  fontSize: 11,
  fontFamily: 'var(--font-primary)',
  width: 160,
  outline: 'none',
};

const selectSmallStyle: React.CSSProperties = {
  padding: '5px 8px',
  borderRadius: 6,
  fontSize: 11,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  outline: 'none',
};

const outlineBtnSmallStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  border: '1px solid #00d9ff',
  background: 'transparent',
  color: '#00d9ff',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  fontSize: 22,
  padding: '4px 8px',
  borderRadius: 4,
  lineHeight: 1,
  transition: 'color 0.15s',
};

const bulkBarStyle: React.CSSProperties = {
  padding: '10px 24px',
  borderTop: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexShrink: 0,
};
