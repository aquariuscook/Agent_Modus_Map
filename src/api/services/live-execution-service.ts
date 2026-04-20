// Stage 4: Live Test Execution
// Runs real LLM calls through the agent graph, one request at a time
import Anthropic from '@anthropic-ai/sdk';
import type { Swarm, Agent } from '../../shared/types/index.js';
import { searchWeb, formatSearchResults, scrapeDirectoryPages } from './web-search-service.js';
import { getDb } from '../db/database.js';
import { insertDecisionTrace } from '../db/decision-trace-store.js';
import { getUserProfile } from '../routes/settings-routes.js';

const NON_BUSINESS_DOMAINS = [
  'linkedin.com', 'yelp.com', 'bbb.org', 'google.com', 'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com', 'pinterest.com',
  'findlaw.com', 'justia.com', 'avvo.com', 'lawyers.com', 'superlawyers.com', 'martindale.com', 'lawinfo.com', 'nolo.com',
  'glassdoor.com', 'indeed.com', 'lensa.com', 'ziprecruiter.com', 'monster.com', 'cityjobs.nyc.gov', 'statejobs.ny.gov', 'usajobs.gov',
  'healthgrades.com', 'zocdoc.com', 'webmd.com', 'vitals.com',
  'contactout.com', 'zoominfo.com', 'manta.com', 'yellowpages.com', 'topworkplaces.com', 'mapquest.com',
  'yahoo.com', 'chron.com', 'nytimes.com', 'wsj.com', 'cnn.com', 'foxnews.com', 'nbcnews.com', 'abcnews.com', 'cbsnews.com', 'newsday.com', 'patch.com', 'bizjournals.com', 'inc.com', 'forbes.com', 'bloomberg.com',
  'wikipedia.org', 'reddit.com', 'trellis.law', 'courtlistener.com', 'casetext.com',
  'ny.gov', 'nyc.gov', 'numc.edu', 'finance.yahoo.com', 'statista.com',
];

export interface LiveExecutionStep {
  agentId: string;
  nickname: string;
  order: number;
  model: string;
  input: string;
  output: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  status: 'success' | 'error' | 'skipped';
  error?: string;
  downstreamAgents: string[];
}

export interface LiveExecutionResult {
  swarmId: string;
  swarmName: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  steps: LiveExecutionStep[];
  dataFlow: Array<{ from: string; to: string; data: string }>;
  status: 'completed' | 'partial' | 'failed';
  agentsProcessed: number;
  agentsTotal: number;
}

// Pricing per 1M tokens
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-sonnet-4-5-20250514': { input: 3.0, output: 15.0 },
  default: { input: 3.0, output: 15.0 },
};

export type ProgressCallback = (event: { type: 'progress'; agent: string; step: number; total: number; status: string }) => void;

export async function runLiveExecutionStreaming(
  swarm: Swarm, userInput: string, onProgress: ProgressCallback
): Promise<LiveExecutionResult> {
  return runLiveExecutionInternal(swarm, userInput, onProgress);
}

export async function runLiveExecution(swarm: Swarm, userInput: string): Promise<LiveExecutionResult> {
  return runLiveExecutionInternal(swarm, userInput);
}

// Preview search results without running agents. Returns the queries generated and results found.
export async function previewSearch(userInput: string): Promise<{
  queries: string[];
  results: Array<{ title: string; url: string; description: string; isDirectory: boolean; hasRawContent: boolean }>;
  totalResults: number;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured.');

  const client = new Anthropic({ apiKey });

  // Generate search queries (same logic as live execution)
  const queryResponse = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    temperature: 0,
    system: `You generate web search queries that find ACTUAL COMPANY WEBSITES. Not directories, not certification bodies, not news articles, not nonprofit organizations.

Your job: take the user's request and generate 12 highly specific search queries. Each query should find a REAL COMPANY'S OWN WEBSITE.

Strategy:
1. Extract the location from the request (city, county, state)
2. Extract or infer industries. If the user mentions specific industries, use those. If not, use these common B2B industries: healthcare, legal, accounting, real estate, manufacturing, professional services, insurance, construction
3. Generate 1-2 queries PER INDUSTRY, each including the location
4. Each query should target the company's own website, NOT a directory

Query patterns that find real companies:
- "[industry] firm [location]" (e.g., "accounting firm Smithtown NY")
- "[industry] company [location] employees" (e.g., "manufacturing company Nassau County employees")
- site:linkedin.com/company "[location]" [industry]
- "[location]" "[industry]" "about us" OR "our team" OR "contact"

Query patterns to NEVER use (these return directories, not companies):
- "directory" "list" "top" "best" "certified" "WBENC" "chamber"
- site:yelp.com site:bbb.org site:findlaw.com site:avvo.com

If the user mentions "women-owned," add that as a modifier to SOME queries but not all. Most women-owned businesses don't have "women-owned" on their homepage, so also search without it.

Output exactly 12 queries, one per line. No numbering, no explanation.

CRITICAL: NEVER ask for more information. Output ONLY queries.`,
    messages: [{ role: 'user', content: userInput }],
  });

  const queryText = queryResponse.content.filter(b => b.type === 'text').map(b => (b as any).text).join('\n');
  const queries = queryText.split('\n').map(q => q.trim()).filter(q => q.length > 5).slice(0, 12);

  let allResults: Awaited<ReturnType<typeof searchWeb>> = [];
  for (const q of queries) {
    const results = await searchWeb(q, 8);
    allResults.push(...results);
  }

  // Scrape directories
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey && allResults.length > 0) {
    allResults = await scrapeDirectoryPages(allResults, tavilyKey);
  }

  // Dedupe
  const seen = new Set<string>();
  allResults = allResults.filter(r => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return {
    queries,
    results: allResults.map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
      isDirectory: /directory|member|list|certified|chamber|wbenc|bbb\.org|yelp/.test((r.url + r.title).toLowerCase()),
      hasRawContent: !!(r as any).rawContent,
    })),
    totalResults: allResults.length,
  };
}

async function runLiveExecutionInternal(swarm: Swarm, userInput: string, onProgress?: ProgressCallback): Promise<LiveExecutionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured. Set it in your environment to run live tests.');
  }

  const client = new Anthropic({ apiKey });
  const startedAt = new Date().toISOString();
  const steps: LiveExecutionStep[] = [];
  const dataFlow: Array<{ from: string; to: string; data: string }> = [];

  // Find entry points and build graph
  const entryAgents = findEntryPoints(swarm);
  const downstream = buildDownstreamMap(swarm);

  // Pre-search: Extract industries + location, then search for actual business websites
  let sharedSearchContext = '';
  try {
    console.log('[LIVE] Extracting industries and location from query...');

    // Step 1: Have Haiku extract the structured info from the user's plain English query
    const extractResponse = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      temperature: 0,
      system: `Extract the location and industries from the user's query. Output JSON only, no explanation.
Format: {"location": "city/county, state", "industries": ["industry1", "industry2", ...]}
If no industries specified, infer common ones: healthcare, dental, legal, accounting, real estate, insurance, construction, veterinary.
If no location specified, use "United States".
CRITICAL: Output ONLY the JSON. Nothing else.`,
      messages: [{ role: 'user', content: userInput }],
    });
    const extractText = extractResponse.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
    let location = '';
    let industries = ['healthcare', 'dental', 'accounting', 'legal', 'real estate', 'insurance'];
    try {
      const cleaned = extractText.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      const extracted = JSON.parse(cleaned);
      if (extracted.location) location = extracted.location;
      if (extracted.industries?.length) industries = extracted.industries;
    } catch { /* use defaults */ }

    console.log(`[LIVE] Location: ${location}, Industries: ${industries.join(', ')}`);

    // Step 2: Build search queries programmatically - search for ACTUAL BUSINESS WEBSITES
    // Map industries to better search terms that find actual business websites
    const industrySearchTerms: Record<string, string[]> = {
      'dental': ['dental practice', 'dentist office', 'family dentistry'],
      'healthcare': ['medical practice', 'physician office', 'healthcare clinic'],
      'legal': ['law firm', 'attorney office', 'legal practice'],
      'accounting': ['CPA firm', 'accounting firm', 'tax preparation office'],
      'real estate': ['real estate agency', 'real estate brokerage', 'realty office'],
      'insurance': ['insurance agency', 'insurance broker', 'insurance office'],
      'construction': ['construction company', 'general contractor', 'building contractor'],
      'veterinary': ['veterinary clinic', 'animal hospital', 'vet office'],
      'finance': ['financial advisor', 'wealth management firm', 'financial planning office'],
      'manufacturing': ['manufacturing company', 'fabrication shop', 'manufacturing plant'],
      'professional services': ['consulting firm', 'business services company', 'professional services firm'],
      'physical therapy': ['physical therapy clinic', 'PT office', 'rehabilitation center'],
      'chiropractic': ['chiropractor office', 'chiropractic clinic'],
    };

    const queries: string[] = [];
    for (const industry of industries.slice(0, 8)) {
      const terms = industrySearchTerms[industry.toLowerCase()] || [`${industry} company`, `${industry} firm`];
      for (const term of terms.slice(0, 2)) {
        queries.push(`${term} ${location}`);
      }
    }
    console.log(`[LIVE] Generated ${queries.length} targeted queries for ${industries.length} industries`);

    // Step 3: Search and collect results (limit per query to ensure industry diversity)
    let allResults: Awaited<ReturnType<typeof searchWeb>> = [];
    const seenUrls = new Set<string>();
    for (const q of queries.slice(0, 16)) {
      const results = await searchWeb(q, 4); // Fewer per query = more industry diversity
      for (const r of results) {
        if (!r.url || seenUrls.has(r.url)) continue;
        seenUrls.add(r.url);
        allResults.push(r);
      }
    }

    // Step 4: Filter to actual business websites only
    const businessResults = allResults.filter(r => {
      if (!r.url) return false;
      try {
        const hostname = new URL(r.url).hostname.toLowerCase();
        return !NON_BUSINESS_DOMAINS.some(d => hostname.includes(d));
      } catch { return false; }
    });
    console.log(`[LIVE] Filtered to ${businessResults.length} actual business websites (from ${allResults.length} total)`);

    // Step 5: Scrape the business websites for emails and contact info
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (tavilyKey && businessResults.length > 0) {
      const urlsToScrape = businessResults.slice(0, 15).map(r => r.url);
      console.log(`[LIVE] Scraping ${urlsToScrape.length} business websites for contact info...`);
      try {
        const extractRes = await fetch('https://api.tavily.com/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: tavilyKey, urls: urlsToScrape }),
        });
        if (extractRes.ok) {
          const extractData = await extractRes.json() as any;
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          for (const page of (extractData.results || [])) {
            if (!page.raw_content) continue;
            const match = businessResults.find(r => r.url === page.url);
            if (match) {
              (match as any).rawContent = page.raw_content.slice(0, 3000);
            }
            const emails: string[] = (page.raw_content.match(emailRegex) || [])
              .filter((e: string) => !e.includes('example.com') && !e.includes('sentry') && !e.includes('webpack') && !e.startsWith('email@') && !e.startsWith('not@'));
            if (emails.length > 0) {
              console.log(`[LIVE] Found emails on ${page.url}: ${[...new Set(emails)].join(', ')}`);
            }
          }
        }
      } catch (err) {
        console.log('[LIVE] Website scraping failed:', (err as Error).message);
      }
    }

    // Dedupe by domain (max 1 result per domain)
    const seenDomains = new Set<string>();
    const domainDeduped = businessResults.filter(r => {
      try {
        const domain = new URL(r.url).hostname.replace(/^www\./, '');
        if (seenDomains.has(domain)) return false;
        seenDomains.add(domain);
        return true;
      } catch { return false; }
    });
    console.log(`[LIVE] After domain dedup: ${domainDeduped.length} unique businesses`);
    allResults = domainDeduped;

    // Dedupe by URL
    const seen = new Set<string>();
    allResults = allResults.filter(r => {
      if (!r.url || seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    // Scrape contact/about pages from company websites to find emails and contact names
    let contactData = '';
    const tavilyKeyForContacts = process.env.TAVILY_API_KEY;
    if (tavilyKeyForContacts && allResults.length > 0) {
      const companyUrls = allResults
        .filter(r => {
          if (!r.url || !/^https?:\/\//.test(r.url)) return false;
          const hostname = new URL(r.url).hostname.toLowerCase();
          return !NON_BUSINESS_DOMAINS.some(s => hostname.includes(s));
        })
        .map(r => r.url)
        .slice(0, 8);

      if (companyUrls.length > 0) {
        const contactUrls: string[] = [];
        for (const url of companyUrls) {
          const base = url.replace(/\/$/, '');
          contactUrls.push(base); // Home page (many small biz have email right there)
          contactUrls.push(base + '/contact');
          contactUrls.push(base + '/about');
        }

        console.log(`[LIVE] Scraping ${contactUrls.length} pages from ${companyUrls.length} company sites: ${companyUrls.join(', ')}`);
        try {
          const extractRes = await fetch('https://api.tavily.com/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: tavilyKeyForContacts, urls: contactUrls.slice(0, 20) }),
          });

          if (extractRes.ok) {
            const extractData = await extractRes.json() as any;
            const pageResults = extractData.results || [];
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const contactParts: string[] = [];

            for (const page of pageResults) {
              if (!page.raw_content) continue;
              const emails: string[] = (page.raw_content.match(emailRegex) || [])
                .filter((e: string) => !e.includes('example.com') && !e.includes('sentry') && !e.includes('webpack') && !e.startsWith('email@') && !e.startsWith('name@') && !e.startsWith('not@'));
              if (emails.length > 0) {
                contactParts.push(`[CONTACT INFO from ${page.url}]: Emails found: ${[...new Set(emails)].join(', ')}`);
                console.log(`[LIVE] Found emails on ${page.url}: ${emails.join(', ')}`);
              }
            }

            if (contactParts.length > 0) {
              contactData = '\n\n=== CONTACT INFO SCRAPED FROM COMPANY WEBSITES ===\n' + contactParts.join('\n') + '\n=== END CONTACT INFO ===\nIMPORTANT: Use these REAL email addresses for the prospects. Do NOT make up email addresses.';
            }
          }
        } catch (err) {
          console.log('[LIVE] Contact page scraping failed:', (err as Error).message);
        }
      }
    }

    if (allResults.length > 0) {
      sharedSearchContext = '\n\n=== REAL WEB SEARCH RESULTS ===\nBELOW ARE ACTUAL BUSINESS WEBSITES found by searching. List EVERY business you find.\n\nCRITICAL RULES:\n1. ONLY list companies whose website URL appears in these results. Do NOT make up companies.\n2. Include the website URL for every company.\n3. Include any emails found in scraped content.\n4. Be CONCISE. For each company: name, website, industry, location, phone, email. One line per company. Do NOT write paragraphs.\n5. List as many companies as possible. Quantity matters.\n6. Do NOT fabricate companies from your training data.\n\n' + formatSearchResults(allResults) + '\n\n=== END SEARCH RESULTS ===' + contactData;
      console.log(`[LIVE] Found ${allResults.length} search results (deduped) to share with all agents`);
    }
    // Token tracking for search query generation happens after main variables are declared
  } catch (err) {
    console.log('[LIVE] Search query generation failed, continuing without search:', (err as Error).message);
  }

  // BFS through agents (skip Command, it runs last with combined output)
  const commandAgent = swarm.agents.find(a => a.nickname.toLowerCase() === 'command');
  const visited = new Set<string>();
  const queue: Array<{ agent: Agent; input: string }> = [];
  for (const agent of entryAgents) {
    queue.push({ agent, input: userInput + sharedSearchContext });
  }

  let stepOrder = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  const agentOutputs = new Map<string, string>(); // nickname -> output

  const maxAgents = Math.min(swarm.agents.length, 15);
  while (queue.length > 0 && stepOrder < maxAgents) {
    const { agent, input } = queue.shift()!;
    if (visited.has(agent.id)) continue;
    // Skip Command during BFS, it runs after everything else
    if (commandAgent && agent.id === commandAgent.id) continue;
    visited.add(agent.id);

    const config = agent.config as Record<string, any>;
    const modelConfig = config.modelConfig || {};
    const model = 'claude-haiku-4-5-20251001';
    const temperature = modelConfig.temperature ?? 0.7;
    const isEntryAgent = entryAgents.some(e => e.id === agent.id);
    const isProfileAgent = agent.nickname.toLowerCase() === 'profile';
    const maxTokens = (isEntryAgent || isProfileAgent) ? 4000 : 800;

    const systemPrompt = buildSystemPrompt(agent, config);
    const downstreamIds = downstream.get(agent.id) || [];
    const downstreamNames = downstreamIds.map(id => swarm.agents.find(a => a.id === id)?.nickname || id);

    const stepStart = Date.now();
    let step: LiveExecutionStep;
    console.log(`[LIVE] Agent ${stepOrder + 1}: ${agent.nickname} (${model}, max ${maxTokens} tokens)...`);

    try {
      const truncatedInput = input.slice(0, 12000);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: truncatedInput }],
      });
      clearTimeout(timeout);

      const output = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('\n');

      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      const pricing = PRICING[model] || PRICING.default;
      const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      totalCost += cost;
      agentOutputs.set(agent.nickname, output);

      step = {
        agentId: agent.id,
        nickname: agent.nickname,
        order: stepOrder++,
        model,
        input: input.slice(0, 500),
        output,
        durationMs: Date.now() - stepStart,
        inputTokens,
        outputTokens,
        cost: Math.round(cost * 10000) / 10000,
        status: 'success',
        downstreamAgents: downstreamNames,
      };

      for (const targetId of downstreamIds) {
        const targetAgent = swarm.agents.find(a => a.id === targetId);
        if (targetAgent && !visited.has(targetId)) {
          let contextInput = `Previous agent "${agent.nickname}" produced this output:\n\n${output.slice(0, 800)}\n\nProcess this according to your role.${sharedSearchContext}`;

          // Inject sender profile into outreach-writing agents
          if (['Craft', 'Social', 'Warm', 'Draft'].includes(targetAgent.nickname)) {
            const p = getUserProfile();
            if (p.name) {
              contextInput += `\n\n=== SENDER PROFILE ===\nName: ${p.name}${p.title ? ', ' + p.title : ''}${p.company ? ' at ' + p.company : ''}${p.website ? '\nWebsite: ' + p.website : ''}${p.linkedin ? '\nLinkedIn: ' + p.linkedin : ''}${p.valueProp ? '\nWhat we do: ' + p.valueProp : ''}${p.proofPoints?.length ? '\nProof: ' + p.proofPoints.join('; ') : ''}${p.calendarLink ? '\nBook a call: ' + p.calendarLink : ''}\nSign all emails from ${p.name}. Include website in signature. Never use [brackets] for placeholders.\n=== END ===`;
            }
          }

          queue.push({ agent: targetAgent, input: contextInput });
          dataFlow.push({
            from: agent.nickname,
            to: targetAgent.nickname,
            data: output.slice(0, 150),
          });
        }
      }
    } catch (err: any) {
      step = {
        agentId: agent.id,
        nickname: agent.nickname,
        order: stepOrder++,
        model,
        input: input.slice(0, 500),
        output: '',
        durationMs: Date.now() - stepStart,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        status: 'error',
        error: err.message || 'Unknown error',
        downstreamAgents: downstreamNames,
      };
    }

    steps.push(step);

    // Record decision trace for this agent
    try {
      const db = getDb();
      const config = agent.config as Record<string, any>;
      const now = new Date().toISOString();
      const tags: string[] = [step.status];
      if (agent.badges.includes('CRITICAL')) tags.push('critical-agent');
      if (agent.badges.includes('ENTRY')) tags.push('entry-point');
      if (step.status === 'error') tags.push('error');
      if (step.durationMs > 10000) tags.push('slow');

      insertDecisionTrace(db, {
        id: `trace-${swarm.id}-${agent.id}-${Date.now()}`,
        swarmId: swarm.id,
        agentId: agent.id,
        agentNickname: agent.nickname,
        title: `${agent.nickname} ${step.status === 'success' ? 'processed input' : 'failed'}`,
        timestamp: now,
        stages: [
          {
            stage: 'observation',
            content: `Received input (${input.length} chars). ${downstreamNames.length > 0 ? `Will pass to: ${downstreamNames.join(', ')}` : 'Terminal agent.'}`,
            data: { inputLength: input.length, downstreamAgents: downstreamNames },
            timestamp: now,
          },
          {
            stage: 'reasoning',
            content: `Core task: ${(config.coreTask || 'Process input according to role').slice(0, 200)}. Autonomy: ${config.autonomyLevel || 'autonomous'}. Model: ${model}.`,
            data: { model, temperature, maxTokens, autonomy: config.autonomyLevel || 'autonomous' },
            timestamp: now,
          },
          {
            stage: 'action',
            content: step.status === 'success'
              ? `Generated ${step.output.length} chars of output. Used ${step.inputTokens + step.outputTokens} tokens ($${step.cost}).`
              : `Failed: ${step.error || 'Unknown error'}`,
            data: { outputLength: step.output?.length || 0, tokens: step.inputTokens + step.outputTokens, cost: step.cost },
            timestamp: now,
          },
          {
            stage: 'outcome',
            content: step.status === 'success'
              ? `Successfully completed. ${downstreamNames.length > 0 ? `Passing data to ${downstreamNames.join(', ')}.` : 'No downstream agents.'}`
              : `Agent failed. ${downstreamNames.length > 0 ? `Downstream agents (${downstreamNames.join(', ')}) may be affected.` : ''}`,
            data: { status: step.status, durationMs: step.durationMs },
            timestamp: now,
          },
        ],
        tags,
        confidence: step.status === 'success' ? 0.9 : 0.1,
        durationMs: step.durationMs,
      });
    } catch (traceErr) {
      console.log(`[LIVE] Failed to record trace for ${agent.nickname}:`, (traceErr as Error).message);
    }

    onProgress?.({ type: 'progress', agent: agent.nickname, step: stepOrder, total: maxAgents, status: step.status });
  }

  // Run Command agent last with combined output from key agents
  console.log(`[LIVE] Command agent found: ${!!commandAgent}, agentOutputs keys: ${[...agentOutputs.keys()].join(', ')}`);
  if (commandAgent) {
    const keyAgents = ['Scout', 'Profile', 'Qualify', 'Craft', 'Signal', 'Social'];
    const combinedParts: string[] = [];
    for (const name of keyAgents) {
      const output = agentOutputs.get(name);
      if (output) combinedParts.push(`=== ${name} OUTPUT ===\n${output.slice(0, 1500)}\n`);
    }

    if (combinedParts.length > 0) {
      const config = commandAgent.config as Record<string, any>;
      const systemPrompt = buildSystemPrompt(commandAgent, config);

      // Inject user profile for personalized email generation
      const profile = getUserProfile();
      let profileContext = '';
      if (profile.name) {
        const parts: string[] = [];
        parts.push(`=== SENDER PROFILE (use this in all outreach emails) ===`);
        parts.push(`Name: ${profile.name}`);
        if (profile.title) parts.push(`Title: ${profile.title}`);
        if (profile.company) parts.push(`Company: ${profile.company}`);
        if (profile.website) parts.push(`Website: ${profile.website}`);
        if (profile.linkedin) parts.push(`LinkedIn: ${profile.linkedin}`);
        if (profile.email) parts.push(`Email: ${profile.email}`);
        if (profile.phone) parts.push(`Phone: ${profile.phone}`);
        if (profile.valueProp) parts.push(`What we do: ${profile.valueProp}`);
        if (profile.proofPoints?.length) parts.push(`Proof points: ${profile.proofPoints.join('; ')}`);
        if (profile.calendarLink) parts.push(`Calendar link for CTAs: ${profile.calendarLink}`);
        parts.push(`Preferred tone: ${profile.tone || 'professional'}`);
        parts.push(`IMPORTANT: Every outreach email MUST include the sender's name, company, and a clear CTA. If a calendar link is provided, use it as the CTA. Reference specific details about the prospect's business. Never use placeholder brackets like [Name] or [Company]. Keep emails under 150 words. Include the website link in the signature.`);
        parts.push(`=== END SENDER PROFILE ===\n`);
        profileContext = parts.join('\n');
      }

      // Include scraped contact emails directly so Command has them
      const commandContactData = sharedSearchContext.includes('CONTACT INFO')
        ? '\n\n' + sharedSearchContext.substring(sharedSearchContext.indexOf('=== CONTACT INFO'))
        : '';
      const commandInput = `${profileContext}Here is the combined output from all upstream agents. Compile this into the structured JSON dashboard format. IMPORTANT: Use the REAL email addresses from the CONTACT INFO section below. Do NOT output "Not available" if an email exists in the contact data.${commandContactData}\n\n${combinedParts.join('\n')}`;

      const stepStart = Date.now();
      console.log(`[LIVE] Agent ${stepOrder + 1}: Command (final aggregator, max 4000 tokens)...`);
      onProgress?.({ type: 'progress', agent: 'Command', step: stepOrder + 1, total: stepOrder + 1, status: 'running' });

      try {
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8000,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: commandInput.slice(0, 12000) }],
        });

        const output = response.content
          .filter(block => block.type === 'text')
          .map(block => (block as any).text)
          .join('\n');

        const inputTokens = response.usage?.input_tokens || 0;
        const outputTokens = response.usage?.output_tokens || 0;
        const pricing = PRICING['claude-haiku-4-5-20251001'] || PRICING.default;
        const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;
        totalCost += cost;

        steps.push({
          agentId: commandAgent.id,
          nickname: 'Command',
          order: stepOrder++,
          model: 'claude-haiku-4-5-20251001',
          input: commandInput.slice(0, 500),
          output,
          durationMs: Date.now() - stepStart,
          inputTokens,
          outputTokens,
          cost: Math.round(cost * 10000) / 10000,
          status: 'success',
          downstreamAgents: [],
        });

        for (const name of keyAgents) {
          if (agentOutputs.has(name)) {
            dataFlow.push({ from: name, to: 'Command', data: `${name} output -> dashboard` });
          }
        }
      } catch (err: any) {
        steps.push({
          agentId: commandAgent.id,
          nickname: 'Command',
          order: stepOrder++,
          model: 'claude-haiku-4-5-20251001',
          input: commandInput.slice(0, 500),
          output: '',
          durationMs: Date.now() - stepStart,
          inputTokens: 0, outputTokens: 0, cost: 0,
          status: 'error',
          error: err.message || 'Unknown error',
          downstreamAgents: [],
        });
      }

      // Record Command trace
      const cmdStep = steps[steps.length - 1];
      try {
        const db = getDb();
        const now = new Date().toISOString();
        insertDecisionTrace(db, {
          id: `trace-${swarm.id}-command-${Date.now()}`,
          swarmId: swarm.id,
          agentId: commandAgent.id,
          agentNickname: 'Command',
          title: `Command ${cmdStep.status === 'success' ? 'compiled dashboard data' : 'failed to compile'}`,
          timestamp: now,
          stages: [
            { stage: 'observation', content: `Received combined output from ${combinedParts.length} upstream agents: ${keyAgents.filter(n => agentOutputs.has(n)).join(', ')}`, data: { sourceAgents: combinedParts.length }, timestamp: now },
            { stage: 'reasoning', content: 'Aggregating all agent outputs into structured JSON for the prospect dashboard. Deduplicating, scoring, and generating outreach emails.', data: { model: 'claude-haiku-4-5-20251001', maxTokens: 4000 }, timestamp: now },
            { stage: 'action', content: cmdStep.status === 'success' ? `Generated ${cmdStep.output?.length || 0} chars of structured JSON.` : `Failed: ${cmdStep.error}`, data: { outputLength: cmdStep.output?.length || 0 }, timestamp: now },
            { stage: 'outcome', content: cmdStep.status === 'success' ? 'Dashboard data ready for display.' : 'Dashboard will use fallback extraction from individual agent outputs.', data: { status: cmdStep.status }, timestamp: now },
          ],
          tags: [cmdStep.status, 'aggregator', 'dashboard'],
          confidence: cmdStep.status === 'success' ? 0.95 : 0.1,
          durationMs: cmdStep.durationMs,
        });
      } catch (traceErr) {
        console.log('[LIVE] Failed to record Command trace:', (traceErr as Error).message);
      }
    }
  }

  const completedAt = new Date().toISOString();
  const totalDurationMs = steps.reduce((sum, s) => sum + s.durationMs, 0);
  const hasErrors = steps.some(s => s.status === 'error');

  return {
    swarmId: swarm.id,
    swarmName: swarm.name,
    startedAt,
    completedAt,
    totalDurationMs,
    totalInputTokens,
    totalOutputTokens,
    totalCost: Math.round(totalCost * 10000) / 10000,
    steps,
    dataFlow,
    status: hasErrors ? (steps.some(s => s.status === 'success') ? 'partial' : 'failed') : 'completed',
    agentsProcessed: steps.filter(s => s.status === 'success').length,
    agentsTotal: swarm.agents.length,
  };
}

function buildSystemPrompt(agent: Agent, config: Record<string, any>): string {
  const parts: string[] = [];

  parts.push(`You are "${agent.nickname}" (${agent.formalName}), ${agent.descriptor}.`);

  const prompt = config.systemPrompt as Record<string, string> | undefined;
  if (prompt?.persona) parts.push(`\nPersona: ${prompt.persona}`);
  if (config.coreTask) parts.push(`\nCore Task: ${config.coreTask}`);
  if (prompt?.instructions) parts.push(`\nInstructions: ${prompt.instructions}`);
  if (prompt?.constraints) parts.push(`\nConstraints: ${prompt.constraints}`);

  const guardrails = config.guardrails as Record<string, any> | undefined;
  if (guardrails?.blockedTopics?.length) {
    parts.push(`\nBlocked Topics (never discuss): ${(guardrails.blockedTopics as string[]).join(', ')}`);
  }
  if (guardrails?.contentFilters?.length) {
    parts.push(`\nContent Filters: ${(guardrails.contentFilters as string[]).join(', ')}`);
  }

  if (prompt?.outputFormat) parts.push(`\nOutput Format: ${prompt.outputFormat}`);

  if (config.autonomyLevel) parts.push(`\nAutonomy Level: ${config.autonomyLevel}`);

  // If no detailed config, provide a sensible default
  if (parts.length <= 1) {
    parts.push('\nProcess the input according to your role and provide a clear, actionable response.');
  }

  return parts.join('\n');
}

function generateSearchQueries(input: string, coreTask: string): string[] {
  const lower = (input + ' ' + coreTask).toLowerCase();

  // Extract location phrases (greedy, handles multi-word like "Long Island New York")
  const locPatterns = [
    /on (long island[^,.]*)/, /in (long island[^,.]*)/, /in (nassau[^,.]*)/, /in (suffolk[^,.]*)/,
    /on ([a-z]+ island[^,.]*)/, /in ([a-z ]{3,30}(?:new york|ny|california|ca|texas|tx|florida|fl)[^,.]*)/,
    /in ([a-z ]{3,20}(?:county|city|area|region)[^,.]*)/, /(?:near|around|from) ([a-z ]{3,25})/,
  ];
  let location = '';
  for (const pat of locPatterns) {
    const m = lower.match(pat);
    if (m) { location = m[1].trim(); break; }
  }

  const queries: string[] = [];

  // Extract industries mentioned
  const industries = ['healthcare', 'finance', 'legal', 'real estate', 'manufacturing', 'professional services', 'insurance', 'retail'];
  const mentionedIndustries = industries.filter(i => lower.includes(i));

  if (location) {
    // Directory and LinkedIn searches for actual companies
    queries.push(`site:bbb.org "${location}" business directory`);
    if (mentionedIndustries.length > 0) {
      queries.push(`"${location}" ${mentionedIndustries.slice(0, 2).join(' OR ')} companies employees`);
    } else {
      queries.push(`"${location}" companies 20-100 employees business directory`);
    }
    if (lower.includes('women') || lower.includes('woman')) {
      queries.push(`women-owned business "${location}" WBENC certified directory`);
      queries.push(`"${location}" women-owned ${mentionedIndustries[0] || 'business'} company list`);
    } else {
      queries.push(`site:linkedin.com/company "${location}" ${mentionedIndustries[0] || 'business'}`);
      queries.push(`"${location}" chamber of commerce member directory companies`);
    }
  } else {
    queries.push(`${input.slice(0, 100)} company directory`);
    queries.push(`${input.slice(0, 80)} businesses site:bbb.org`);
    queries.push(`${input.slice(0, 80)} site:linkedin.com/company`);
  }

  return queries.slice(0, 4);
}

function findEntryPoints(swarm: Swarm): Agent[] {
  const entryBadged = swarm.agents.filter(a => a.badges.includes('ENTRY'));
  if (entryBadged.length > 0) return entryBadged;

  const hasInbound = new Set<string>();
  for (const rel of swarm.relationships) {
    if (rel.type === 'feedsInto' || rel.type === 'dependsOn') {
      hasInbound.add(rel.targetAgentId);
    }
  }
  const noInbound = swarm.agents.filter(a => !hasInbound.has(a.id));
  return noInbound.length > 0 ? noInbound : [swarm.agents[0]];
}

function buildDownstreamMap(swarm: Swarm): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const agent of swarm.agents) map.set(agent.id, []);
  for (const rel of swarm.relationships) {
    if (rel.type === 'feedsInto') map.get(rel.sourceAgentId)?.push(rel.targetAgentId);
    if (rel.type === 'dependsOn') map.get(rel.targetAgentId)?.push(rel.sourceAgentId);
  }
  for (const [key, val] of map) map.set(key, [...new Set(val)]);
  return map;
}
