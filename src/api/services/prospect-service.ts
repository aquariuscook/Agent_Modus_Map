// Prospect database service for lead gen swarm results.
// Uses ruvector for vector storage with metadata-based filtering.

import { VectorDB } from 'ruvector';

// --- Types ---

export type ProspectStatus =
  | 'new'
  | 'contacted'
  | 'responded'
  | 'meeting'
  | 'qualified'
  | 'proposal'
  | 'won'
  | 'lost'
  | 'archived';

export interface Prospect {
  id: string;
  company: string;
  website: string;
  linkedin: string;
  industry: string;
  location: string;
  employees: string;
  revenue: string;
  score: number;
  status: ProspectStatus;
  signals: string[];
  contactName: string;
  contactTitle: string;
  contactLinkedIn: string;
  contactEmail: string;
  outreach: {
    professional: string;
    conversational: string;
    valueLead: string;
    direct: string;
  };
  sourceRunId: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export interface ProspectFilters {
  status?: ProspectStatus;
  minScore?: number;
  maxScore?: number;
  industry?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ProspectStats {
  total: number;
  byStatus: Record<ProspectStatus, number>;
  avgScore: number;
  topIndustries: Array<{ industry: string; count: number }>;
  recentCount: number;
}

interface SaveRunResult {
  newCount: number;
  updatedCount: number;
  errors: string[];
}

// --- Constants ---

const VECTOR_DIMENSIONS = 16;
const DB_PATH = 'data/prospects.rv';

const ALL_STATUSES: ProspectStatus[] = [
  'new', 'contacted', 'responded', 'meeting',
  'qualified', 'proposal', 'won', 'lost', 'archived',
];

// --- Helpers ---

/**
 * Generate a deterministic 16-dim vector from text.
 * This is not a real embedding, just a hash-based projection
 * so ruvector can do approximate similarity lookups.
 */
function textToVector(text: string): number[] {
  const vec = new Array<number>(VECTOR_DIMENSIONS).fill(0);
  const normalized = text.toLowerCase().trim();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    const bucket = i % VECTOR_DIMENSIONS;
    // Mix character position and value into the bucket
    vec[bucket] += Math.sin(code * (i + 1) * 0.1) * 0.5;
  }
  // Normalize to unit length
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / magnitude);
}

function prospectToVector(prospect: { company: string; industry: string; location: string }): number[] {
  return textToVector(`${prospect.company} ${prospect.industry} ${prospect.location}`);
}

function nowISO(): string {
  return new Date().toISOString();
}

function metadataToProspect(id: string, meta: Record<string, unknown>): Prospect {
  return {
    id,
    company: (meta.company as string) ?? '',
    website: (meta.website as string) ?? '',
    linkedin: (meta.linkedin as string) ?? '',
    industry: (meta.industry as string) ?? '',
    location: (meta.location as string) ?? '',
    employees: (meta.employees as string) ?? '',
    revenue: (meta.revenue as string) ?? '',
    score: (meta.score as number) ?? 0,
    status: (meta.status as ProspectStatus) ?? 'new',
    signals: JSON.parse((meta.signals as string) ?? '[]'),
    contactName: (meta.contactName as string) ?? '',
    contactTitle: (meta.contactTitle as string) ?? '',
    contactLinkedIn: (meta.contactLinkedIn as string) ?? '',
    contactEmail: (meta.contactEmail as string) ?? '',
    outreach: JSON.parse((meta.outreach as string) ?? '{}'),
    sourceRunId: (meta.sourceRunId as string) ?? '',
    createdAt: (meta.createdAt as string) ?? '',
    updatedAt: (meta.updatedAt as string) ?? '',
    notes: (meta.notes as string) ?? '',
  };
}

function prospectToMetadata(prospect: Omit<Prospect, 'id'>): Record<string, unknown> {
  return {
    company: prospect.company,
    website: prospect.website,
    linkedin: prospect.linkedin,
    industry: prospect.industry,
    location: prospect.location,
    employees: prospect.employees,
    revenue: prospect.revenue,
    score: prospect.score,
    status: prospect.status,
    signals: JSON.stringify(prospect.signals),
    contactName: prospect.contactName,
    contactTitle: prospect.contactTitle,
    contactLinkedIn: prospect.contactLinkedIn,
    contactEmail: prospect.contactEmail,
    outreach: JSON.stringify(prospect.outreach),
    sourceRunId: prospect.sourceRunId,
    createdAt: prospect.createdAt,
    updatedAt: prospect.updatedAt,
    notes: prospect.notes,
  };
}

/**
 * Extract JSON from command output that may contain code fences
 * or trailing text after the JSON object.
 */
function extractJSON(raw: string): unknown {
  let cleaned = raw.trim();

  // Strip ```json ... ``` fences (handle missing closing fence for truncated output)
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else if (cleaned.startsWith('```')) {
    // Opening fence but no closing fence (truncated output)
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').trim();
  }

  // Try parsing as-is first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Find the outermost { ... } or [ ... ]
    const start = cleaned.indexOf('{');
    const startArr = cleaned.indexOf('[');
    const idx = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
    if (idx === -1) throw new Error('No JSON object found in output');

    const isArray = cleaned[idx] === '[';
    const closeChar = isArray ? ']' : '}';
    const openChar = isArray ? '[' : '{';

    let depth = 0;
    let end = -1;
    for (let i = idx; i < cleaned.length; i++) {
      if (cleaned[i] === openChar) depth++;
      if (cleaned[i] === closeChar) depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) {
      // JSON was truncated (hit token limit). Try to repair by closing open brackets.
      let truncated = cleaned.slice(idx);
      // Count open/close braces and brackets
      let openBraces = 0;
      let openBrackets = 0;
      for (const ch of truncated) {
        if (ch === '{') openBraces++;
        if (ch === '}') openBraces--;
        if (ch === '[') openBrackets++;
        if (ch === ']') openBrackets--;
      }
      // Try to close the JSON: strip trailing partial content, then close
      // Find the last complete property (ends with } or ])
      const lastComplete = Math.max(truncated.lastIndexOf('},'), truncated.lastIndexOf('}]'), truncated.lastIndexOf('}'));
      if (lastComplete > 0) {
        truncated = truncated.slice(0, lastComplete + 1);
        // Recount
        openBraces = 0;
        openBrackets = 0;
        for (const ch of truncated) {
          if (ch === '{') openBraces++;
          if (ch === '}') openBraces--;
          if (ch === '[') openBrackets++;
          if (ch === ']') openBrackets--;
        }
      }
      // Close remaining open structures
      truncated += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
      try {
        return JSON.parse(truncated);
      } catch {
        throw new Error('Malformed JSON in output');
      }
    }
    return JSON.parse(cleaned.slice(idx, end + 1));
  }
}

/**
 * Normalize a single prospect from varying JSON shapes into our standard fields.
 */
function normalizeProspectData(raw: Record<string, unknown>): Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'> {
  // Company can be an object { name, website, linkedin, ... } or just a string
  const companyObj = raw.company as Record<string, unknown> | string | undefined;
  const isCompanyObj = typeof companyObj === 'object' && companyObj !== null;

  // Helper to check multiple field name variants (camelCase, snake_case, etc.)
  const get = (obj: Record<string, unknown>, ...keys: string[]): string => {
    for (const k of keys) {
      if (obj[k] != null && obj[k] !== '') return String(obj[k]);
    }
    return '';
  };

  const company = isCompanyObj
    ? get(companyObj as Record<string, unknown>, 'name')
    : get(raw, 'companyName', 'company_name', 'company');

  const website = isCompanyObj
    ? get(companyObj as Record<string, unknown>, 'website', 'website_url')
    : get(raw, 'website', 'website_url');

  const linkedin = isCompanyObj
    ? get(companyObj as Record<string, unknown>, 'linkedin', 'linkedinUrl', 'linkedin_url', 'linkedinCompanyUrl', 'linkedin_company_url')
    : get(raw, 'linkedin', 'linkedinUrl', 'linkedin_url', 'linkedinCompanyUrl', 'linkedin_company_url', 'companyLinkedIn');

  const industry = isCompanyObj
    ? get(companyObj as Record<string, unknown>, 'industry')
    : get(raw, 'industry');

  const location = isCompanyObj
    ? get(companyObj as Record<string, unknown>, 'location')
    : get(raw, 'location');

  const employees = isCompanyObj
    ? get(companyObj as Record<string, unknown>, 'employees', 'employeeCount', 'employee_count')
    : get(raw, 'employees', 'employeeCount', 'employee_count');

  const revenue = isCompanyObj
    ? get(companyObj as Record<string, unknown>, 'revenue', 'revenueEstimate', 'revenue_estimate')
    : get(raw, 'revenue', 'revenueEstimate', 'revenue_estimate');

  // Contact can be an object or flat fields
  const contactObj = raw.contact as Record<string, unknown> | undefined;

  const contactName = contactObj
    ? get(contactObj, 'name')
    : get(raw, 'contactName', 'contact_name');

  const contactTitle = contactObj
    ? get(contactObj, 'title', 'position')
    : get(raw, 'contactTitle', 'contact_title');

  const contactLinkedIn = contactObj
    ? get(contactObj, 'linkedin', 'linkedinUrl', 'linkedin_url')
    : get(raw, 'contactLinkedIn', 'contactLinkedin', 'contact_linkedin_url', 'contact_linkedin');

  const contactEmail = contactObj
    ? get(contactObj, 'email')
    : get(raw, 'contactEmail', 'contact_email');

  // Outreach emails
  const outreachObj = (raw.outreachEmails ?? raw.outreach_emails ?? raw.outreach ?? {}) as Record<string, unknown>;
  // Outreach values can be strings or { subject, body } objects
  const fmtEmail = (val: unknown): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    const obj = val as Record<string, unknown>;
    const parts: string[] = [];
    if (obj.subject) parts.push(`Subject: ${obj.subject}`);
    if (obj.body) parts.push(String(obj.body));
    return parts.join('\n\n') || '';
  };
  const outreach = {
    professional: fmtEmail(outreachObj.professional),
    conversational: fmtEmail(outreachObj.conversational),
    valueLead: fmtEmail(outreachObj.valueLead) || fmtEmail(outreachObj.value_lead),
    direct: fmtEmail(outreachObj.direct),
  };

  // Score
  const score = (raw.leadScore as number) ?? (raw.lead_score as number) ?? (raw.score as number) ?? 0;

  // Signals
  let signals: string[] = [];
  if (Array.isArray(raw.signals)) {
    signals = raw.signals.map(String);
  } else if (Array.isArray(raw.buyingSignals)) {
    signals = raw.buyingSignals.map(String);
  } else if (Array.isArray(raw.buying_signals)) {
    signals = raw.buying_signals.map(String);
  }

  return {
    company,
    website,
    linkedin,
    industry,
    location,
    employees,
    revenue,
    score,
    status: 'new',
    signals,
    contactName,
    contactTitle,
    contactLinkedIn,
    contactEmail: contactEmail.includes('Not ') || contactEmail === 'N/A' ? '' : contactEmail,
    outreach,
    sourceRunId: '',
    notes: '',
  };
}

// --- Service ---

export class ProspectService {
  private db: InstanceType<typeof VectorDB> | null = null;

  async init(): Promise<void> {
    this.db = new VectorDB({ dimensions: VECTOR_DIMENSIONS, storagePath: DB_PATH });
  }

  private getDB(): InstanceType<typeof VectorDB> {
    if (!this.db) {
      throw new Error('ProspectService not initialized. Call init() first.');
    }
    return this.db;
  }

  /**
   * Insert a new prospect. If a prospect with the same company name
   * already exists, update it only when the new score is higher.
   */
  async saveProspect(
    data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ id: string; action: 'created' | 'updated' | 'skipped' }> {
    const db = this.getDB();
    const now = nowISO();

    // Dedupe check: search for existing prospect with same company name
    const existing = await this.findByCompany(data.company);

    if (existing) {
      // Update if: higher score, OR new data has contact info the old one lacks
      const hasNewContactInfo = (data.contactEmail && data.contactEmail.includes('@') && (!existing.contactEmail || !existing.contactEmail.includes('@')))
        || (data.contactName && data.contactName !== existing.contactName && !data.contactName.includes('Not'));
      if (data.score > existing.score || hasNewContactInfo) {
        // Merge: keep the best of both
        if (!data.contactEmail || !data.contactEmail.includes('@')) data.contactEmail = existing.contactEmail;
        if (!data.contactName || data.contactName.includes('Not')) data.contactName = existing.contactName;
        if (!data.contactTitle || data.contactTitle.includes('Not')) data.contactTitle = existing.contactTitle;
        // Higher score, update by delete + re-insert
        await db.delete(existing.id);
        const metadata = prospectToMetadata({
          ...data,
          createdAt: existing.createdAt,
          updatedAt: now,
        });
        const id = await db.insert({
          vector: prospectToVector(data),
          metadata,
        });
        return { id, action: 'updated' };
      }
      return { id: existing.id, action: 'skipped' };
    }

    // New prospect
    const metadata = prospectToMetadata({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    const id = await db.insert({
      vector: prospectToVector(data),
      metadata,
    });
    return { id, action: 'created' };
  }

  /**
   * Parse Command agent's JSON output and save all extracted prospects.
   */
  async saveProspectsFromRun(runId: string, commandOutput: string): Promise<SaveRunResult> {
    const result: SaveRunResult = { newCount: 0, updatedCount: 0, errors: [] };

    let parsed: unknown;
    try {
      parsed = extractJSON(commandOutput);
    } catch (err) {
      result.errors.push(`Failed to parse JSON: ${(err as Error).message}`);
      return result;
    }

    // Extract the prospects array from various shapes
    let rawProspects: Record<string, unknown>[];
    if (Array.isArray(parsed)) {
      rawProspects = parsed as Record<string, unknown>[];
    } else if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.prospects)) {
        rawProspects = obj.prospects as Record<string, unknown>[];
      } else if (Array.isArray(obj.results)) {
        rawProspects = obj.results as Record<string, unknown>[];
      } else if (Array.isArray(obj.data)) {
        rawProspects = obj.data as Record<string, unknown>[];
      } else {
        result.errors.push('No prospects array found in parsed JSON');
        return result;
      }
    } else {
      result.errors.push('Parsed output is not an object or array');
      return result;
    }

    for (let i = 0; i < rawProspects.length; i++) {
      try {
        const normalized = normalizeProspectData(rawProspects[i]);
        normalized.sourceRunId = runId;

        if (!normalized.company) {
          result.errors.push(`Prospect at index ${i}: missing company name, skipped`);
          continue;
        }

        const { action } = await this.saveProspect(normalized);
        if (action === 'created') result.newCount++;
        if (action === 'updated') result.updatedCount++;
      } catch (err) {
        result.errors.push(`Prospect at index ${i}: ${(err as Error).message}`);
      }
    }

    return result;
  }

  async getProspect(id: string): Promise<Prospect | null> {
    const db = this.getDB();
    try {
      const record = await db.get(id);
      if (!record || !record.metadata) return null;
      return metadataToProspect(record.id ?? id, record.metadata);
    } catch {
      return null;
    }
  }

  /**
   * List prospects with optional filters.
   * Since ruvector only supports vector search, we fetch a large set
   * using a dummy vector and filter by metadata in JS.
   */
  async listProspects(filters: ProspectFilters = {}): Promise<Prospect[]> {
    const all = await this.getAllProspects();

    let filtered = all;

    if (filters.status) {
      filtered = filtered.filter((p) => p.status === filters.status);
    }
    if (filters.minScore !== undefined) {
      filtered = filtered.filter((p) => p.score >= filters.minScore!);
    }
    if (filters.maxScore !== undefined) {
      filtered = filtered.filter((p) => p.score <= filters.maxScore!);
    }
    if (filters.industry) {
      const ind = filters.industry.toLowerCase();
      filtered = filtered.filter((p) => p.industry.toLowerCase().includes(ind));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.company.toLowerCase().includes(q) ||
          p.contactName.toLowerCase().includes(q) ||
          p.industry.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.notes.toLowerCase().includes(q)
      );
    }

    // Sort by score descending
    filtered.sort((a, b) => b.score - a.score);

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;
    return filtered.slice(offset, offset + limit);
  }

  async updateProspectStatus(id: string, status: ProspectStatus): Promise<Prospect | null> {
    return this.updateProspectField(id, { status });
  }

  async updateProspectNotes(id: string, notes: string): Promise<Prospect | null> {
    return this.updateProspectField(id, { notes });
  }

  async bulkUpdateStatus(ids: string[], status: ProspectStatus): Promise<number> {
    let updated = 0;
    for (const id of ids) {
      const result = await this.updateProspectStatus(id, status);
      if (result) updated++;
    }
    return updated;
  }

  async deleteProspect(id: string): Promise<boolean> {
    const db = this.getDB();
    try {
      await db.delete(id);
      return true;
    } catch {
      return false;
    }
  }

  async getStats(): Promise<ProspectStats> {
    const all = await this.getAllProspects();

    const byStatus = {} as Record<ProspectStatus, number>;
    for (const s of ALL_STATUSES) {
      byStatus[s] = 0;
    }

    const industryCounts = new Map<string, number>();
    let totalScore = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let recentCount = 0;

    for (const p of all) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      totalScore += p.score;

      if (p.industry) {
        industryCounts.set(p.industry, (industryCounts.get(p.industry) ?? 0) + 1);
      }

      if (p.createdAt >= sevenDaysAgo) {
        recentCount++;
      }
    }

    const topIndustries = Array.from(industryCounts.entries())
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: all.length,
      byStatus,
      avgScore: all.length > 0 ? Math.round((totalScore / all.length) * 100) / 100 : 0,
      topIndustries,
      recentCount,
    };
  }

  async exportCSV(): Promise<string> {
    const all = await this.getAllProspects();

    const headers = [
      'ID', 'Company', 'Website', 'LinkedIn', 'Industry', 'Location',
      'Employees', 'Revenue', 'Score', 'Status', 'Signals',
      'Contact Name', 'Contact Title', 'Contact LinkedIn', 'Contact Email',
      'Outreach Professional', 'Outreach Conversational', 'Outreach Value Lead',
      'Source Run ID', 'Created At', 'Updated At', 'Notes',
    ];

    const escapeCSV = (val: string): string => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const rows = all.map((p) => [
      p.id,
      p.company,
      p.website,
      p.linkedin,
      p.industry,
      p.location,
      p.employees,
      p.revenue,
      String(p.score),
      p.status,
      p.signals.join('; '),
      p.contactName,
      p.contactTitle,
      p.contactLinkedIn,
      p.contactEmail,
      p.outreach.professional,
      p.outreach.conversational,
      p.outreach.valueLead,
      p.sourceRunId,
      p.createdAt,
      p.updatedAt,
      p.notes,
    ].map(escapeCSV).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Fetch every prospect from the DB.
   * Uses a zero vector search with k = total count.
   */
  async getAllProspects(): Promise<Prospect[]> {
    const db = this.getDB();
    const total = await db.len();
    if (total === 0) return [];

    const dummyVector = new Array<number>(VECTOR_DIMENSIONS).fill(0);
    dummyVector[0] = 1; // Unit vector so it's valid

    const results = await db.search({ vector: dummyVector, k: total });
    return results
      .filter((r: { id: string; score: number; metadata?: Record<string, unknown> }) => r.metadata)
      .map((r: { id: string; score: number; metadata?: Record<string, unknown> }) =>
        metadataToProspect(r.id, r.metadata!)
      );
  }

  // --- Private helpers ---

  /**
   * Find an existing prospect by company name (case-insensitive).
   * Searches all records since ruvector has no metadata-only query.
   */
  private async findByCompany(company: string): Promise<Prospect | null> {
    const all = await this.getAllProspects();
    const target = company.toLowerCase().trim();
    return all.find((p) => p.company.toLowerCase().trim() === target) ?? null;
  }

  /**
   * Generic field update via delete + re-insert.
   */
  private async updateProspectField(
    id: string,
    fields: Partial<Omit<Prospect, 'id'>>
  ): Promise<Prospect | null> {
    const db = this.getDB();
    const existing = await this.getProspect(id);
    if (!existing) return null;

    await db.delete(id);

    const updated: Omit<Prospect, 'id'> = {
      ...existing,
      ...fields,
      updatedAt: nowISO(),
    };

    const metadata = prospectToMetadata(updated);
    await db.insert({
      vector: prospectToVector(updated),
      metadata,
    });

    return { ...updated, id };
  }
}

// Singleton instance
export const prospectService = new ProspectService();

// --- Standalone function exports (used by routes) ---

export async function initProspectDb(): Promise<void> {
  return prospectService.init();
}

export async function saveProspect(
  data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ id: string; action: 'created' | 'updated' | 'skipped' }> {
  return prospectService.saveProspect(data);
}

export async function saveProspectsFromRun(
  runId: string,
  commandOutput: string
): Promise<SaveRunResult> {
  return prospectService.saveProspectsFromRun(runId, commandOutput);
}

export async function getProspect(id: string): Promise<Prospect | null> {
  return prospectService.getProspect(id);
}

export async function listProspects(filters?: ProspectFilters): Promise<Prospect[]> {
  return prospectService.listProspects(filters);
}

export async function updateProspectStatus(
  id: string,
  status: ProspectStatus
): Promise<Prospect | null> {
  return prospectService.updateProspectStatus(id, status);
}

export async function updateProspectNotes(
  id: string,
  notes: string
): Promise<Prospect | null> {
  return prospectService.updateProspectNotes(id, notes);
}

export async function bulkUpdateStatus(
  ids: string[],
  status: ProspectStatus
): Promise<number> {
  return prospectService.bulkUpdateStatus(ids, status);
}

export async function deleteProspect(id: string): Promise<boolean> {
  return prospectService.deleteProspect(id);
}

export async function getStats(): Promise<ProspectStats> {
  return prospectService.getStats();
}

export async function exportCSV(): Promise<string> {
  return prospectService.exportCSV();
}

export async function getAllProspects(): Promise<Prospect[]> {
  return prospectService.getAllProspects();
}
