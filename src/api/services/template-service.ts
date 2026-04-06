// Template service implementing ADR-005 (Template-First UX)
import type Database from 'better-sqlite3';
import { v7 as uuidv7 } from 'uuid';
import type { Swarm, Badge } from '../../shared/types/index.js';

export interface SwarmTemplate {
  id: string;
  name: string;
  domain: string;
  description: string;
  agentCount: number;
  layerCount: number;
  tags: string[];
  layers: Array<{ name: string; colorTheme: string; order: number }>;
  agents: Array<{
    nickname: string;
    formalName: string;
    descriptor: string;
    layerIndex: number;
    badges: Badge[];
    positionIndex: number;
    config?: Record<string, unknown>;
  }>;
  relationships: Array<{
    sourceNickname: string;
    targetNickname: string;
    type: 'dependsOn' | 'feedsInto' | 'collaboratesWith' | 'canOverride';
  }>;
}

// Default core tasks for template agents so users understand each agent's role
const DEFAULT_CORE_TASKS: Record<string, string> = {
  // Customer Service
  Portal: 'Receive incoming customer requests from all channels (chat, email, phone, social) and route them into the support system.',
  Triage: 'Classify incoming requests by urgency and category. Route high-priority issues immediately, queue standard requests.',
  Mood: 'Analyze customer sentiment in real-time during interactions. Flag frustrated or angry customers for priority handling.',
  Queue: 'Assign tickets to the right resolution agent based on issue type, agent availability, and customer priority level.',
  Atlas: 'Search the knowledge base for relevant answers, guides, and past solutions. Provide context to resolution agents.',
  Solver: 'Resolve customer issues using knowledge base answers, account tools, and standard procedures. Handle straightforward cases automatically.',
  Scribble: 'Draft professional, on-brand responses to customer inquiries. Match tone to customer sentiment and issue type.',
  Checklist: 'Review drafted responses for accuracy, completeness, and brand voice compliance before sending to customers.',
  Translate: 'Translate responses into the customer\'s preferred language while maintaining tone and accuracy.',
  Ladder: 'Escalate complex or sensitive issues to the right tier of human support. Include full context so agents don\'t ask customers to repeat themselves.',
  Captain: 'Supervise active support sessions. Override automated decisions when needed. Handle VIP and crisis situations directly.',
  Witness: 'Log every interaction, decision, and outcome for compliance, training, and quality review purposes.',
  Alarm: 'Monitor SLA timers and alert the team when response times are approaching breach thresholds.',
  Trend: 'Identify recurring issue patterns across tickets. Spot emerging problems before they become widespread.',
  Score: 'Predict customer satisfaction scores based on interaction patterns. Flag at-risk customers for proactive outreach.',
  Coach: 'Analyze agent performance and generate training recommendations. Identify knowledge gaps and skill development opportunities.',
  Dashboard: 'Generate real-time and periodic reports on support metrics: volume, resolution time, CSAT, first-contact resolution rate.',
  // Content Ops
  Brief: 'Receive content requests and create structured briefs with topic, audience, format, deadline, and key messages.',
  Quill: 'Write long-form content (blog posts, articles, guides, whitepapers) based on content briefs and research.',
  Pixel: 'Create visual content (graphics, infographics, social media images) aligned with brand guidelines.',
  Clip: 'Produce video content (scripts, storyboards, short-form clips) for marketing and educational purposes.',
  Brand: 'Review all content for brand voice consistency, messaging alignment, and visual identity compliance.',
  Legal: 'Review content for legal compliance, copyright issues, required disclaimers, and regulatory requirements.',
  Editor: 'Perform editorial review for quality, clarity, accuracy, and readability. Suggest improvements and approve for publication.',
  Boost: 'Optimize content for search engines: keyword research, meta descriptions, header structure, internal linking.',
  Format: 'Adapt content into multiple formats: blog to social posts, article to email newsletter, guide to video script.',
  Schedule: 'Manage the content calendar. Schedule publications across channels at optimal times for engagement.',
  Broadcast: 'Distribute published content across all channels: website, social media, email, syndication partners.',
  Tracker: 'Track content performance metrics: views, engagement, shares, conversions, and time on page.',
  Suggest: 'Generate content ideas based on trending topics, audience interests, competitor analysis, and performance data.',
  Report: 'Create ROI reports showing content performance against business goals and budget allocation.',
  // DevOps
  Builder: 'Compile source code, run build processes, and package artifacts for deployment. Report build status and errors.',
  Lint: 'Run static code analysis, linting, and formatting checks. Flag code quality issues before they reach review.',
  Unit: 'Execute unit and integration test suites. Report pass/fail results with detailed failure analysis.',
  Scanner: 'Scan code and dependencies for security vulnerabilities, outdated packages, and license compliance issues.',
  Pipeline: 'Orchestrate the full CI/CD pipeline: build, test, scan, stage, deploy. Manage pipeline state and approvals.',
  Canary: 'Deploy new versions to a small subset of traffic first. Monitor for errors before full rollout.',
  Release: 'Package and tag releases. Generate changelogs. Manage version numbers and release notes.',
  Rollback: 'Automatically revert deployments when health checks fail or error rates exceed thresholds.',
  Patch: 'Apply hotfixes and emergency patches outside the normal release cycle. Fast-track critical fixes.',
  Provision: 'Set up and configure infrastructure: servers, databases, load balancers, DNS, and SSL certificates.',
  Deps: 'Monitor and update project dependencies. Flag breaking changes and security updates.',
  Cache: 'Manage build and deployment caches. Optimize build times by caching intermediate artifacts.',
  Metrics: 'Collect and visualize deployment metrics: frequency, lead time, failure rate, and recovery time.',
  // Data Pipeline
  Collector: 'Ingest data from multiple sources: APIs, databases, file uploads, webhooks, and streaming feeds.',
  Schema: 'Validate incoming data against expected schemas. Flag malformed records and schema drift.',
  Transform: 'Clean, normalize, and transform raw data into structured formats ready for analysis or storage.',
  Validate: 'Run data quality checks: completeness, accuracy, consistency, and freshness. Reject bad records.',
  Enrich: 'Enhance data records by joining with external sources, adding computed fields, and resolving entities.',
  Enricher: 'Enhance data records by joining with external sources, adding computed fields, and resolving entities.',
  Lake: 'Store raw and processed data in the data lake. Manage partitioning, retention, and access controls.',
  Stream: 'Process real-time data streams with low latency. Handle event-driven transformations and alerts.',
  Warehouse: 'Load processed data into the data warehouse. Manage tables, indexes, and query optimization.',
  Query: 'Execute analytical queries against the data warehouse. Generate reports and dashboards from query results.',
  Batch: 'Run scheduled batch processing jobs: daily aggregations, weekly reports, monthly reconciliation.',
  Lineage: 'Track data lineage from source to destination. Document transformations and dependencies between datasets.',
  ML: 'Train and deploy machine learning models on processed data. Monitor model performance and trigger retraining.',
  // Security SOC
  Watcher: 'Monitor network traffic, system logs, and user activity for suspicious patterns and known attack signatures.',
  NetWatch: 'Monitor network perimeter for unauthorized access attempts, port scanning, and traffic anomalies.',
  Forensic: 'Investigate security incidents by collecting and analyzing evidence: logs, memory dumps, network captures.',
  Quarantine: 'Isolate compromised systems, accounts, or data to prevent threat spread. Manage containment procedures.',
  Responder: 'Execute incident response procedures: containment, eradication, recovery, and post-incident review.',
  Compliance: 'Audit systems against compliance frameworks (SOC2, HIPAA, PCI-DSS). Generate compliance reports.',
  Comply: 'Verify that systems and processes meet regulatory requirements. Flag compliance gaps and track remediation.',
  Endpoint: 'Monitor endpoint devices for malware, unauthorized software, and policy violations.',
  PostMortem: 'Create detailed post-incident reports: timeline, root cause, impact assessment, and prevention recommendations.',
  Alert: 'Aggregate and prioritize security alerts. Reduce noise by correlating related events into incidents.',
  // Research
  WebSearch: 'Search the web for relevant information on research topics. Collect sources from academic papers, news, and industry reports.',
  DocSearch: 'Search internal document repositories for relevant prior research, reports, and reference materials.',
  DocScan: 'Extract key information from uploaded documents: PDFs, reports, presentations, and spreadsheets.',
  Cite: 'Manage citations and references. Ensure proper attribution and format citations in the required style.',
  FactCheck: 'Verify factual claims against multiple sources. Flag unverified or contradictory information.',
  Synthesizer: 'Combine findings from multiple sources into coherent summaries. Identify patterns and contradictions.',
  GraphSearch: 'Search knowledge graphs and structured databases for entity relationships and connected information.',
  Verify: 'Cross-reference findings across sources. Rate confidence levels and flag low-confidence claims.',
  Hypothesis: 'Generate hypotheses based on research findings. Suggest experiments or analyses to test them.',
  // Sales
  Prospect: 'Identify potential customers through market research, lead databases, and referral networks.',
  Outreach: 'Send personalized outreach messages via email and LinkedIn. Track open rates and responses.',
  Compete: 'Monitor competitor activity, pricing, and positioning. Identify competitive advantages and threats.',
  Proposal: 'Generate custom proposals based on prospect needs, pricing tiers, and competitive positioning.',
  Forecast: 'Predict sales outcomes based on pipeline data, historical patterns, and market conditions.',
  Win: 'Analyze won deals to identify success patterns. Document what worked for future reference.',
  Progress: 'Track deal progress through pipeline stages. Alert on stalled deals and upcoming deadlines.',
  // HR
  Hire: 'Process new hire paperwork, collect required documents, and create employee records in the system.',
  Assign: 'Schedule and assign onboarding training modules based on role, department, and compliance requirements.',
  Buddy: 'Match new hires with mentors based on role, department, experience level, and interests.',
  Welcome: 'Guide new employees through their first week: orientation schedule, key contacts, office setup, and FAQs.',
  Feedback: 'Collect feedback from new hires about the onboarding experience. Identify improvement opportunities.',
  HRDash: 'Generate HR analytics dashboards: time-to-productivity, onboarding completion rates, new hire satisfaction scores.',
  // Personal Assistant
  Inbox: 'Scan incoming emails and messages. Categorize each by urgency (urgent, important, routine, low-priority) and type (action required, FYI, meeting-related, follow-up needed). Flag anything that needs immediate attention. Extract key details: sender, subject, deadline if mentioned, and whether a reply is expected.',
  Calendar: 'Review upcoming calendar events for the next 48 hours. Identify meetings that need preparation, scheduling conflicts, back-to-back meetings with no buffer, and open time blocks. Note attendees, meeting purpose, and any pre-work required.',
  Pulse: 'Create a concise morning briefing summarizing: top priority emails, today\'s meetings with prep notes, pending to-do items and their deadlines, any social media mentions or engagement that needs attention. Keep it scannable, under 2 minutes to read.',
  Prioritize: 'Take all inputs from Inbox, Calendar, and Listen. Prioritize using urgency and importance. Output a ranked action list: what to do first, what can wait, what to delegate, and what to ignore. Be decisive. If something can wait until tomorrow, say so.',
  Draft: 'Write email replies based on the context provided. For each email that needs a response, generate three versions: quick (2-3 sentences, direct), thoughtful (acknowledges their point, adds value), and formal (professional tone for external contacts). Match the sender\'s communication style when possible.',
  Prep: 'Prepare a one-page meeting brief for each upcoming meeting. Include: who\'s attending and their role, what was discussed last time, any open action items, topics to cover, and suggested talking points. If it\'s a first meeting, research the attendees.',
  Planner: 'Build and maintain a prioritized to-do list. Organize tasks by deadline, estimated time, and energy required. Suggest the best order for tackling tasks based on available time blocks from Calendar. Flag anything at risk of missing its deadline.',
  Listen: 'Monitor social media channels (LinkedIn, Twitter/X, Instagram) for: mentions of you or your brand, comments on your posts, DMs that need replies, trending topics in your industry, and competitor activity worth noting. Summarize engagement metrics.',
  Post: 'Draft social media content based on priorities and topics. Create platform-appropriate posts: LinkedIn (professional thought leadership), Twitter/X (concise and engaging), Instagram (visual-first with captions). Match the user\'s voice and style. Suggest optimal posting times.',
  Engage: 'Draft replies to social media comments and DMs. For routine engagement (thanks, acknowledgments), provide ready-to-send responses. For substantive conversations, draft thoughtful replies that build relationships. Flag anything sensitive that needs personal attention.',
  Nudge: 'Track commitments and deadlines. Send reminders when: a promised deliverable is due soon, a follow-up email hasn\'t been sent, a task has been sitting untouched for too long, or someone else owes you something and hasn\'t delivered. Be specific about what\'s due and when.',
  Recap: 'Generate an end-of-day summary: tasks completed, tasks carried over to tomorrow, emails sent and pending, meetings attended with key takeaways, social media engagement stats (new followers, post performance, notable interactions). Highlight anything that needs attention first thing tomorrow.',
  // Social Media Management
  Trends: 'Identify trending topics, hashtags, and conversations in the user\'s industry across LinkedIn, X/Twitter, and Instagram. Surface content opportunities: what people are talking about, questions being asked, debates happening. Flag trends early before they peak.',
  Ideate: 'Generate content ideas based on trending topics, past top-performing posts, and industry news. For each idea, suggest: the angle, which platform it fits best, the format (text post, carousel, thread, video concept), and why it would resonate with the audience.',
  Visual: 'Suggest visual concepts for social content. For each post draft, recommend: image style (photo, graphic, infographic, meme), color palette, text overlay suggestions, and hashtag sets. Describe the visual so a designer or AI image tool can produce it.',
  Timing: 'Determine optimal posting times for each platform based on audience activity patterns. Build a weekly content calendar distributing posts across platforms. Avoid posting too frequently or too close together. Suggest the best day/time for each piece of content.',
  Reply: 'Draft responses to comments and DMs across all social channels. For routine engagement (thanks, acknowledgments, simple questions), provide ready-to-send responses. For substantive conversations or complaints, draft thoughtful replies. Flag anything sensitive, controversial, or from high-profile accounts for human review.',
  Grow: 'Identify accounts and communities to engage with for audience growth. Suggest: people to follow, posts to comment on, groups to join, collaborations to pursue. Focus on genuine relationship building, not spam. Track which engagement strategies are working.',
  Analytics: 'Generate weekly social media analytics: engagement rate by platform, follower growth, top-performing posts (by likes, shares, comments), best posting times, content type performance (text vs image vs video vs carousel), audience demographics shifts, and month-over-month trends. Highlight what\'s working and what to change.',
  // Lead Gen Dashboard
  Command: 'Take ALL upstream agent outputs and compile them into a single structured JSON response. For each prospect company found, extract: company name, website URL, LinkedIn company URL (construct as linkedin.com/company/name-slug), industry, location, employee count, revenue estimate, lead score (1-10), buying signals, contact name, contact title, contact LinkedIn URL, and contact email if found. Generate 3 outreach email variants per prospect: "professional" (formal business tone), "conversational" (warm and personal), and "valueLead" (lead with a specific insight about their business). Output ONLY valid JSON with this structure: {"prospects":[...],"summary":{"totalProspects":N,"avgScore":N,"topIndustry":"...","topSignal":"..."}}. No markdown, no explanation, just JSON.',
};

const templates: SwarmTemplate[] = [
  {
    id: 'customer-service-v1',
    name: 'Customer Service Center',
    domain: 'Support',
    description: '18-agent swarm for multi-tier customer support with sentiment analysis, escalation management, and knowledge base integration.',
    agentCount: 18,
    layerCount: 4,
    tags: ['customer-service', 'support', 'escalation', 'sentiment'],
    layers: [
      { name: 'Intake & Triage', colorTheme: '#22c55e', order: 1 },
      { name: 'Resolution', colorTheme: '#a855f7', order: 2 },
      { name: 'Escalation & Oversight', colorTheme: '#22c55e', order: 3 },
      { name: 'Analytics & Learning', colorTheme: '#fbbf24', order: 4 },
    ],
    agents: [
      { nickname: 'Portal', formalName: 'Interface-Intake-Multichannel', descriptor: 'The Front Door', layerIndex: 0, badges: ['ENTRY', 'AUTO'], positionIndex: 0 },
      { nickname: 'Triage', formalName: 'Workflow-Classifier-Priority', descriptor: 'The Sorter', layerIndex: 0, badges: ['AUTO', 'CRITICAL'], positionIndex: 1 },
      { nickname: 'Mood', formalName: 'Interface-Sentiment-Realtime', descriptor: 'The Empath', layerIndex: 0, badges: ['ALWAYS_ON', 'ADVISORY'], positionIndex: 2 },
      { nickname: 'Queue', formalName: 'Workflow-Router-Assignment', descriptor: 'The Dispatcher', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 3 },
      { nickname: 'Atlas', formalName: 'Data-KnowledgeBase-Search', descriptor: 'The Librarian', layerIndex: 1, badges: ['HUB', 'AUTO'], positionIndex: 0 },
      { nickname: 'Solver', formalName: 'Workflow-Resolution-Auto', descriptor: 'The Fixer', layerIndex: 1, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Scribble', formalName: 'Content-Response-Draft', descriptor: 'The Writer', layerIndex: 1, badges: ['AUTO', 'MEDIUM'], positionIndex: 2 },
      { nickname: 'Checklist', formalName: 'Workflow-Verification-QA', descriptor: 'The Proofreader', layerIndex: 1, badges: ['AUTO'], positionIndex: 3 },
      { nickname: 'Translate', formalName: 'Content-Localize-Response', descriptor: 'The Interpreter', layerIndex: 1, badges: ['AUTO', 'MEDIUM'], positionIndex: 4 },
      { nickname: 'Ladder', formalName: 'Workflow-Escalation-TierRoute', descriptor: 'The Elevator', layerIndex: 2, badges: ['CRITICAL', 'HUMAN'], positionIndex: 0 },
      { nickname: 'Captain', formalName: 'Workflow-Supervisor-Override', descriptor: 'The Boss', layerIndex: 2, badges: ['CRITICAL', 'CAN_OVERRIDE', 'HUMAN'], positionIndex: 1 },
      { nickname: 'Witness', formalName: 'Workflow-Logger-Interactions', descriptor: 'The Recorder', layerIndex: 2, badges: ['HUB', 'CRITICAL', 'LOGS_ALL'], positionIndex: 2 },
      { nickname: 'Alarm', formalName: 'Alert-SLA-Breach', descriptor: 'The Watchdog', layerIndex: 2, badges: ['ALWAYS_ON', 'CAN_OVERRIDE'], positionIndex: 3 },
      { nickname: 'Pulse', formalName: 'Monitor-Performance-Agents', descriptor: 'The Health Check', layerIndex: 2, badges: ['ALWAYS_ON', 'CRITICAL'], positionIndex: 4 },
      { nickname: 'Trend', formalName: 'Intelligence-Pattern-Issues', descriptor: 'The Spotter', layerIndex: 3, badges: ['AUTO', 'ADVISORY'], positionIndex: 0 },
      { nickname: 'Score', formalName: 'Intelligence-CSAT-Predictor', descriptor: 'The Rater', layerIndex: 3, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Coach', formalName: 'Intelligence-AgentTraining', descriptor: 'The Mentor', layerIndex: 3, badges: ['AUTO', 'ADVISORY'], positionIndex: 2 },
      { nickname: 'Dashboard', formalName: 'Intelligence-Reporting-Ops', descriptor: 'The Summarizer', layerIndex: 3, badges: ['AUTO'], positionIndex: 3 },
    ],
    relationships: [
      ['Portal', 'Triage', 'feedsInto'], ['Portal', 'Mood', 'collaboratesWith'],
      ['Triage', 'Queue', 'feedsInto'], ['Triage', 'Mood', 'dependsOn'],
      ['Queue', 'Solver', 'feedsInto'], ['Queue', 'Ladder', 'feedsInto'],
      ['Solver', 'Atlas', 'dependsOn'], ['Solver', 'Scribble', 'feedsInto'],
      ['Scribble', 'Checklist', 'feedsInto'], ['Scribble', 'Translate', 'collaboratesWith'],
      ['Checklist', 'Portal', 'feedsInto'], ['Ladder', 'Captain', 'feedsInto'],
      ['Captain', 'Solver', 'canOverride'], ['Witness', 'Trend', 'feedsInto'],
      ['Alarm', 'Captain', 'feedsInto'], ['Alarm', 'Ladder', 'canOverride'],
      ['Pulse', 'Alarm', 'feedsInto'], ['Trend', 'Coach', 'feedsInto'],
      ['Score', 'Dashboard', 'feedsInto'], ['Mood', 'Score', 'feedsInto'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'content-ops-v1',
    name: 'Content Operations',
    domain: 'Media',
    description: '15-agent swarm for content creation, review, optimization, and publishing pipelines with brand compliance.',
    agentCount: 15,
    layerCount: 4,
    tags: ['content', 'media', 'marketing', 'publishing', 'seo'],
    layers: [
      { name: 'Content Creation', colorTheme: '#a855f7', order: 1 },
      { name: 'Review & Compliance', colorTheme: '#22c55e', order: 2 },
      { name: 'Optimization & Distribution', colorTheme: '#22c55e', order: 3 },
      { name: 'Analytics & Performance', colorTheme: '#fbbf24', order: 4 },
    ],
    agents: [
      { nickname: 'Brief', formalName: 'Workflow-ContentBrief-Intake', descriptor: 'The Planner', layerIndex: 0, badges: ['ENTRY', 'AUTO'], positionIndex: 0 },
      { nickname: 'Quill', formalName: 'Content-Generator-LongForm', descriptor: 'The Author', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Pixel', formalName: 'Content-Generator-Visual', descriptor: 'The Designer', layerIndex: 0, badges: ['AUTO', 'MEDIUM'], positionIndex: 2 },
      { nickname: 'Clip', formalName: 'Content-Generator-Video', descriptor: 'The Director', layerIndex: 0, badges: ['AUTO', 'MEDIUM'], positionIndex: 3 },
      { nickname: 'Brand', formalName: 'Review-Compliance-BrandVoice', descriptor: 'The Guardian', layerIndex: 1, badges: ['CRITICAL', 'APPROVAL'], positionIndex: 0 },
      { nickname: 'Legal', formalName: 'Review-Compliance-Legal', descriptor: 'The Counsel', layerIndex: 1, badges: ['CRITICAL', 'HUMAN'], positionIndex: 1 },
      { nickname: 'Editor', formalName: 'Review-Quality-Editorial', descriptor: 'The Perfectionist', layerIndex: 1, badges: ['HUMAN', 'CAN_OVERRIDE'], positionIndex: 2 },
      { nickname: 'Boost', formalName: 'Optimize-SEO-Keywords', descriptor: 'The Ranker', layerIndex: 2, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 0 },
      { nickname: 'Format', formalName: 'Optimize-Adapt-MultiFormat', descriptor: 'The Shapeshifter', layerIndex: 2, badges: ['AUTO'], positionIndex: 1 },
      { nickname: 'Schedule', formalName: 'Distribution-Publish-Calendar', descriptor: 'The Timekeeper', layerIndex: 2, badges: ['AUTO', 'CRITICAL'], positionIndex: 2 },
      { nickname: 'Broadcast', formalName: 'Distribution-MultiChannel', descriptor: 'The Megaphone', layerIndex: 2, badges: ['AUTO'], positionIndex: 3 },
      { nickname: 'Tracker', formalName: 'Analytics-Performance-Content', descriptor: 'The Scorekeeper', layerIndex: 3, badges: ['ALWAYS_ON', 'AUTO'], positionIndex: 0 },
      { nickname: 'Insight', formalName: 'Analytics-Audience-Behavior', descriptor: 'The Mind Reader', layerIndex: 3, badges: ['AUTO', 'ADVISORY'], positionIndex: 1 },
      { nickname: 'Suggest', formalName: 'Intelligence-ContentIdeas', descriptor: 'The Muse', layerIndex: 3, badges: ['AUTO', 'ADVISORY'], positionIndex: 2 },
      { nickname: 'Report', formalName: 'Intelligence-ROI-Summary', descriptor: 'The Accountant', layerIndex: 3, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 3 },
    ],
    relationships: [
      ['Brief', 'Quill', 'feedsInto'], ['Brief', 'Pixel', 'feedsInto'], ['Brief', 'Clip', 'feedsInto'],
      ['Quill', 'Brand', 'feedsInto'], ['Pixel', 'Brand', 'feedsInto'],
      ['Brand', 'Editor', 'feedsInto'], ['Legal', 'Editor', 'collaboratesWith'],
      ['Editor', 'Boost', 'feedsInto'], ['Boost', 'Format', 'feedsInto'],
      ['Format', 'Schedule', 'feedsInto'], ['Schedule', 'Broadcast', 'feedsInto'],
      ['Broadcast', 'Tracker', 'feedsInto'], ['Tracker', 'Insight', 'feedsInto'],
      ['Insight', 'Suggest', 'feedsInto'], ['Suggest', 'Brief', 'feedsInto'],
      ['Editor', 'Quill', 'canOverride'], ['Report', 'Brief', 'collaboratesWith'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'research-assistant-v1',
    name: 'Research & Knowledge Assistant',
    domain: 'Research',
    description: '10-agent swarm for research, knowledge synthesis, fact-checking, and report generation with RAG integration.',
    agentCount: 10,
    layerCount: 3,
    tags: ['research', 'knowledge', 'rag', 'fact-check', 'synthesis'],
    layers: [
      { name: 'Discovery & Gathering', colorTheme: '#3b82f6', order: 1 },
      { name: 'Analysis & Synthesis', colorTheme: '#a855f7', order: 2 },
      { name: 'Output & Review', colorTheme: '#22c55e', order: 3 },
    ],
    agents: [
      { nickname: 'Query', formalName: 'Discovery-Query-Parser', descriptor: 'The Listener', layerIndex: 0, badges: ['ENTRY', 'AUTO'], positionIndex: 0 },
      { nickname: 'WebSearch', formalName: 'Discovery-Web-Crawler', descriptor: 'The Explorer', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'DocSearch', formalName: 'Discovery-Document-RAG', descriptor: 'The Archivist', layerIndex: 0, badges: ['AUTO', 'HUB'], positionIndex: 2 },
      { nickname: 'GraphSearch', formalName: 'Discovery-KnowledgeGraph', descriptor: 'The Mapper', layerIndex: 0, badges: ['AUTO'], positionIndex: 3 },
      { nickname: 'Synthesizer', formalName: 'Analyze-Combine-Sources', descriptor: 'The Weaver', layerIndex: 1, badges: ['HUB', 'CRITICAL', 'AUTO'], positionIndex: 0 },
      { nickname: 'FactCheck', formalName: 'Analyze-Verify-Claims', descriptor: 'The Skeptic', layerIndex: 1, badges: ['CRITICAL', 'AUTO'], positionIndex: 1 },
      { nickname: 'Summarize', formalName: 'Analyze-Condense-KeyPoints', descriptor: 'The Distiller', layerIndex: 1, badges: ['AUTO'], positionIndex: 2 },
      { nickname: 'Writer', formalName: 'Output-Report-Generator', descriptor: 'The Author', layerIndex: 2, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 0 },
      { nickname: 'Reviewer', formalName: 'Output-Quality-Check', descriptor: 'The Editor', layerIndex: 2, badges: ['HUMAN', 'APPROVAL'], positionIndex: 1 },
      { nickname: 'Cite', formalName: 'Output-Citation-Manager', descriptor: 'The Librarian', layerIndex: 2, badges: ['AUTO', 'LOGS_ALL'], positionIndex: 2 },
    ],
    relationships: [
      ['Query', 'WebSearch', 'feedsInto'], ['Query', 'DocSearch', 'feedsInto'], ['Query', 'GraphSearch', 'feedsInto'],
      ['WebSearch', 'Synthesizer', 'feedsInto'], ['DocSearch', 'Synthesizer', 'feedsInto'], ['GraphSearch', 'Synthesizer', 'feedsInto'],
      ['Synthesizer', 'FactCheck', 'feedsInto'], ['Synthesizer', 'Summarize', 'feedsInto'],
      ['FactCheck', 'Writer', 'feedsInto'], ['Summarize', 'Writer', 'feedsInto'],
      ['Writer', 'Reviewer', 'feedsInto'], ['Writer', 'Cite', 'dependsOn'],
      ['Reviewer', 'Writer', 'canOverride'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'sales-automation-v1',
    name: 'Sales & CRM Automation',
    domain: 'Sales',
    description: '12-agent swarm for lead scoring, pipeline management, outreach automation, and sales intelligence.',
    agentCount: 12,
    layerCount: 3,
    tags: ['sales', 'crm', 'lead-scoring', 'outreach', 'pipeline'],
    layers: [
      { name: 'Lead Generation', colorTheme: '#06b6d4', order: 1 },
      { name: 'Pipeline Management', colorTheme: '#8b5cf6', order: 2 },
      { name: 'Intelligence & Reporting', colorTheme: '#fbbf24', order: 3 },
    ],
    agents: [
      { nickname: 'Prospect', formalName: 'Lead-Source-Identifier', descriptor: 'The Hunter', layerIndex: 0, badges: ['ENTRY', 'AUTO'], positionIndex: 0 },
      { nickname: 'Scorer', formalName: 'Lead-Score-Qualifier', descriptor: 'The Judge', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Enricher', formalName: 'Lead-Data-Enrichment', descriptor: 'The Researcher', layerIndex: 0, badges: ['AUTO'], positionIndex: 2 },
      { nickname: 'Outreach', formalName: 'Engage-Email-Sequence', descriptor: 'The Messenger', layerIndex: 0, badges: ['AUTO', 'MEDIUM'], positionIndex: 3 },
      { nickname: 'Pipeline', formalName: 'Manage-Deal-Tracker', descriptor: 'The Organizer', layerIndex: 1, badges: ['HUB', 'CRITICAL'], positionIndex: 0 },
      { nickname: 'Scheduler', formalName: 'Manage-Meeting-Book', descriptor: 'The Coordinator', layerIndex: 1, badges: ['AUTO'], positionIndex: 1 },
      { nickname: 'Proposal', formalName: 'Manage-Proposal-Generate', descriptor: 'The Closer', layerIndex: 1, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 2 },
      { nickname: 'Follow', formalName: 'Manage-Followup-Remind', descriptor: 'The Nudger', layerIndex: 1, badges: ['AUTO', 'ALWAYS_ON'], positionIndex: 3 },
      { nickname: 'Forecast', formalName: 'Intel-Revenue-Predict', descriptor: 'The Oracle', layerIndex: 2, badges: ['AUTO', 'CRITICAL'], positionIndex: 0 },
      { nickname: 'Win', formalName: 'Intel-WinLoss-Analyze', descriptor: 'The Analyst', layerIndex: 2, badges: ['AUTO', 'ADVISORY'], positionIndex: 1 },
      { nickname: 'Compete', formalName: 'Intel-Competitive-Monitor', descriptor: 'The Spy', layerIndex: 2, badges: ['AUTO'], positionIndex: 2 },
      { nickname: 'Board', formalName: 'Intel-Sales-Dashboard', descriptor: 'The Scorecard', layerIndex: 2, badges: ['AUTO', 'LOGS_ALL'], positionIndex: 3 },
    ],
    relationships: [
      ['Prospect', 'Scorer', 'feedsInto'], ['Scorer', 'Enricher', 'feedsInto'],
      ['Enricher', 'Outreach', 'feedsInto'], ['Scorer', 'Pipeline', 'feedsInto'],
      ['Outreach', 'Scheduler', 'feedsInto'], ['Pipeline', 'Proposal', 'feedsInto'],
      ['Pipeline', 'Follow', 'collaboratesWith'], ['Pipeline', 'Forecast', 'feedsInto'],
      ['Proposal', 'Pipeline', 'feedsInto'], ['Forecast', 'Board', 'feedsInto'],
      ['Win', 'Compete', 'collaboratesWith'], ['Win', 'Board', 'feedsInto'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'hr-onboarding-v1',
    name: 'HR & Employee Onboarding',
    domain: 'HR',
    description: '11-agent swarm for automated employee onboarding, document processing, training assignment, and compliance tracking.',
    agentCount: 11,
    layerCount: 3,
    tags: ['hr', 'onboarding', 'training', 'compliance', 'employee'],
    layers: [
      { name: 'Intake & Processing', colorTheme: '#3b82f6', order: 1 },
      { name: 'Setup & Training', colorTheme: '#22c55e', order: 2 },
      { name: 'Tracking & Compliance', colorTheme: '#f59e0b', order: 3 },
    ],
    agents: [
      { nickname: 'Hire', formalName: 'Intake-NewHire-Register', descriptor: 'The Welcome Mat', layerIndex: 0, badges: ['ENTRY', 'AUTO'], positionIndex: 0 },
      { nickname: 'DocScan', formalName: 'Intake-Document-Process', descriptor: 'The Paper Pusher', layerIndex: 0, badges: ['AUTO'], positionIndex: 1 },
      { nickname: 'Verify', formalName: 'Intake-Background-Check', descriptor: 'The Validator', layerIndex: 0, badges: ['CRITICAL', 'HUMAN'], positionIndex: 2 },
      { nickname: 'Provision', formalName: 'Setup-Account-Create', descriptor: 'The Key Master', layerIndex: 1, badges: ['AUTO', 'CRITICAL'], positionIndex: 0 },
      { nickname: 'Assign', formalName: 'Setup-Training-Schedule', descriptor: 'The Trainer', layerIndex: 1, badges: ['AUTO'], positionIndex: 1 },
      { nickname: 'Buddy', formalName: 'Setup-Mentor-Match', descriptor: 'The Matchmaker', layerIndex: 1, badges: ['AUTO', 'ADVISORY'], positionIndex: 2 },
      { nickname: 'Welcome', formalName: 'Setup-Orientation-Guide', descriptor: 'The Tour Guide', layerIndex: 1, badges: ['AUTO'], positionIndex: 3 },
      { nickname: 'Progress', formalName: 'Track-Milestone-Monitor', descriptor: 'The Tracker', layerIndex: 2, badges: ['ALWAYS_ON', 'AUTO'], positionIndex: 0 },
      { nickname: 'Comply', formalName: 'Track-Compliance-Verify', descriptor: 'The Regulator', layerIndex: 2, badges: ['CRITICAL', 'APPROVAL'], positionIndex: 1 },
      { nickname: 'Feedback', formalName: 'Track-Survey-Collect', descriptor: 'The Listener', layerIndex: 2, badges: ['AUTO'], positionIndex: 2 },
      { nickname: 'HRDash', formalName: 'Track-Analytics-Report', descriptor: 'The Dashboard', layerIndex: 2, badges: ['AUTO', 'LOGS_ALL'], positionIndex: 3 },
    ],
    relationships: [
      ['Hire', 'DocScan', 'feedsInto'], ['Hire', 'Verify', 'feedsInto'],
      ['Verify', 'Provision', 'feedsInto'], ['DocScan', 'Comply', 'feedsInto'],
      ['Provision', 'Assign', 'feedsInto'], ['Provision', 'Welcome', 'feedsInto'],
      ['Assign', 'Buddy', 'collaboratesWith'], ['Welcome', 'Progress', 'feedsInto'],
      ['Progress', 'Feedback', 'feedsInto'], ['Comply', 'HRDash', 'feedsInto'],
      ['Feedback', 'HRDash', 'feedsInto'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'lead-gen-consulting-v1',
    name: 'Consulting Lead Gen',
    domain: 'Sales',
    description: '15-agent swarm for finding consulting clients: prospect identification, outreach, qualification, proposal generation, pipeline management, and action dashboard.',
    agentCount: 15,
    layerCount: 4,
    tags: ['lead-gen', 'consulting', 'sales', 'outreach', 'pipeline', 'prospecting'],
    layers: [
      { name: 'Discovery & Research', colorTheme: '#00d9ff', order: 1 },
      { name: 'Outreach & Engagement', colorTheme: '#a855f7', order: 2 },
      { name: 'Qualification & Proposal', colorTheme: '#22c55e', order: 3 },
      { name: 'Pipeline & Intelligence', colorTheme: '#fbbf24', order: 4 },
    ],
    agents: [
      // Discovery & Research
      { nickname: 'Scout', formalName: 'Research-Prospect-Identify', descriptor: 'The Opportunity Finder', layerIndex: 0, badges: ['ENTRY', 'AUTO', 'ALWAYS_ON'], positionIndex: 0 },
      { nickname: 'Profile', formalName: 'Research-Company-Enrich', descriptor: 'The Deep Diver', layerIndex: 0, badges: ['AUTO'], positionIndex: 1 },
      { nickname: 'Signal', formalName: 'Research-Intent-Detect', descriptor: 'The Radar', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 2 },
      { nickname: 'Compete', formalName: 'Research-Competitor-Watch', descriptor: 'The Rival Watcher', layerIndex: 0, badges: ['AUTO', 'ADVISORY'], positionIndex: 3 },
      // Outreach & Engagement
      { nickname: 'Craft', formalName: 'Content-Outreach-Personalize', descriptor: 'The Message Tailor', layerIndex: 1, badges: ['AUTO', 'APPROVAL'], positionIndex: 0 },
      { nickname: 'Sequence', formalName: 'Workflow-Cadence-Manage', descriptor: 'The Follow-Upper', layerIndex: 1, badges: ['AUTO', 'ALWAYS_ON'], positionIndex: 1 },
      { nickname: 'Social', formalName: 'Content-LinkedIn-Engage', descriptor: 'The Networker', layerIndex: 1, badges: ['AUTO', 'HUMAN'], positionIndex: 2 },
      { nickname: 'Warm', formalName: 'Content-Nurture-Drip', descriptor: 'The Relationship Builder', layerIndex: 1, badges: ['AUTO'], positionIndex: 3 },
      // Qualification & Proposal
      { nickname: 'Qualify', formalName: 'Workflow-Lead-Score', descriptor: 'The Gatekeeper', layerIndex: 2, badges: ['CRITICAL', 'AUTO'], positionIndex: 0 },
      { nickname: 'Discover', formalName: 'Workflow-NeedsAnalysis-Run', descriptor: 'The Question Asker', layerIndex: 2, badges: ['HUMAN', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Propose', formalName: 'Content-Proposal-Generate', descriptor: 'The Deal Maker', layerIndex: 2, badges: ['APPROVAL', 'HIGH_PRIORITY'], positionIndex: 2 },
      { nickname: 'Price', formalName: 'Workflow-Estimate-Calculate', descriptor: 'The Number Cruncher', layerIndex: 2, badges: ['AUTO', 'CRITICAL'], positionIndex: 3 },
      // Pipeline & Intelligence
      { nickname: 'Funnel', formalName: 'Analytics-Pipeline-Track', descriptor: 'The Pipeline Manager', layerIndex: 3, badges: ['HUB', 'ALWAYS_ON', 'LOGS_ALL'], positionIndex: 0 },
      { nickname: 'Insight', formalName: 'Intelligence-WinLoss-Analyze', descriptor: 'The Pattern Spotter', layerIndex: 3, badges: ['AUTO', 'ADVISORY'], positionIndex: 1 },
      { nickname: 'Command', formalName: 'Pipeline-Action-Dashboard', descriptor: 'The Action Center', layerIndex: 3, badges: ['AUTO', 'HUB'], positionIndex: 2 },
    ],
    relationships: [
      // Discovery flow
      ['Scout', 'Profile', 'feedsInto'], ['Scout', 'Signal', 'feedsInto'],
      ['Profile', 'Craft', 'feedsInto'], ['Signal', 'Craft', 'feedsInto'],
      ['Compete', 'Craft', 'feedsInto'], ['Compete', 'Propose', 'feedsInto'],
      // Outreach flow
      ['Craft', 'Sequence', 'feedsInto'], ['Craft', 'Social', 'feedsInto'],
      ['Sequence', 'Warm', 'feedsInto'], ['Social', 'Warm', 'feedsInto'],
      ['Warm', 'Qualify', 'feedsInto'],
      // Qualification flow
      ['Qualify', 'Discover', 'feedsInto'], ['Discover', 'Propose', 'feedsInto'],
      ['Propose', 'Price', 'dependsOn'], ['Price', 'Propose', 'feedsInto'],
      // Pipeline
      ['Qualify', 'Funnel', 'feedsInto'], ['Propose', 'Funnel', 'feedsInto'],
      ['Funnel', 'Insight', 'feedsInto'], ['Insight', 'Scout', 'feedsInto'],
      // Dashboard
      ['Qualify', 'Command', 'feedsInto'], ['Craft', 'Command', 'feedsInto'],
      ['Social', 'Command', 'feedsInto'], ['Profile', 'Command', 'feedsInto'],
      // Collaborations
      ['Scout', 'Compete', 'collaboratesWith'], ['Profile', 'Signal', 'collaboratesWith'],
      ['Craft', 'Warm', 'collaboratesWith'], ['Qualify', 'Funnel', 'collaboratesWith'],
      ['Insight', 'Compete', 'collaboratesWith'], ['Discover', 'Price', 'collaboratesWith'],
      // Dependencies
      ['Craft', 'Profile', 'dependsOn'], ['Qualify', 'Profile', 'dependsOn'],
      ['Propose', 'Discover', 'dependsOn'], ['Social', 'Profile', 'dependsOn'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'personal-assistant-v1',
    name: 'Personal Assistant',
    domain: 'Productivity',
    description: '12-agent swarm for managing email, calendar, to-do lists, and social media. Daily briefings, smart prioritization, drafted replies, and follow-up reminders.',
    agentCount: 12,
    layerCount: 4,
    tags: ['personal', 'assistant', 'email', 'calendar', 'social', 'productivity', 'tasks'],
    layers: [
      { name: 'Intake & Awareness', colorTheme: '#00d9ff', order: 1 },
      { name: 'Thinking & Prioritizing', colorTheme: '#a855f7', order: 2 },
      { name: 'Social & Content', colorTheme: '#22c55e', order: 3 },
      { name: 'Follow-up & Reporting', colorTheme: '#fbbf24', order: 4 },
    ],
    agents: [
      // Intake & Awareness
      { nickname: 'Inbox', formalName: 'Intake-Email-Scanner', descriptor: 'The Sorter', layerIndex: 0, badges: ['ENTRY', 'ALWAYS_ON', 'AUTO'], positionIndex: 0 },
      { nickname: 'Calendar', formalName: 'Intake-Calendar-Review', descriptor: 'The Scheduler', layerIndex: 0, badges: ['ENTRY', 'ALWAYS_ON', 'AUTO'], positionIndex: 1 },
      { nickname: 'Pulse', formalName: 'Intake-Daily-Briefing', descriptor: 'The Briefer', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 2 },
      // Thinking & Prioritizing
      { nickname: 'Prioritize', formalName: 'Priority-Urgency-Ranker', descriptor: 'The Decider', layerIndex: 1, badges: ['HUB', 'CRITICAL', 'AUTO'], positionIndex: 0 },
      { nickname: 'Draft', formalName: 'Content-Email-Writer', descriptor: 'The Ghost Writer', layerIndex: 1, badges: ['AUTO', 'APPROVAL'], positionIndex: 1 },
      { nickname: 'Prep', formalName: 'Context-Meeting-Briefer', descriptor: 'The Researcher', layerIndex: 1, badges: ['AUTO'], positionIndex: 2 },
      { nickname: 'Planner', formalName: 'Task-Priority-Organizer', descriptor: 'The Strategist', layerIndex: 1, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 3 },
      // Social & Content
      { nickname: 'Listen', formalName: 'Social-Monitor-Tracker', descriptor: 'The Listener', layerIndex: 2, badges: ['ENTRY', 'ALWAYS_ON', 'AUTO'], positionIndex: 0 },
      { nickname: 'Post', formalName: 'Social-Content-Creator', descriptor: 'The Voice', layerIndex: 2, badges: ['AUTO', 'APPROVAL'], positionIndex: 1 },
      { nickname: 'Engage', formalName: 'Social-Reply-Manager', descriptor: 'The Connector', layerIndex: 2, badges: ['AUTO', 'HUMAN'], positionIndex: 2 },
      // Follow-up & Reporting
      { nickname: 'Nudge', formalName: 'Followup-Reminder-Tracker', descriptor: 'The Nagger', layerIndex: 3, badges: ['ALWAYS_ON', 'AUTO'], positionIndex: 0 },
      { nickname: 'Recap', formalName: 'Report-DailySummary-Generator', descriptor: 'The Closer', layerIndex: 3, badges: ['AUTO'], positionIndex: 1 },
    ],
    relationships: [
      // Intake feeds into prioritization
      ['Inbox', 'Prioritize', 'feedsInto'], ['Calendar', 'Prioritize', 'feedsInto'],
      ['Inbox', 'Pulse', 'feedsInto'], ['Calendar', 'Pulse', 'feedsInto'],
      ['Listen', 'Pulse', 'feedsInto'], ['Listen', 'Prioritize', 'feedsInto'],
      // Prioritize drives action
      ['Prioritize', 'Draft', 'feedsInto'], ['Prioritize', 'Prep', 'feedsInto'],
      ['Prioritize', 'Planner', 'feedsInto'], ['Prioritize', 'Post', 'feedsInto'],
      // Social flow
      ['Listen', 'Engage', 'feedsInto'], ['Post', 'Engage', 'collaboratesWith'],
      // Follow-up
      ['Planner', 'Nudge', 'feedsInto'], ['Draft', 'Inbox', 'feedsInto'],
      // Recap pulls from everything
      ['Planner', 'Recap', 'feedsInto'], ['Nudge', 'Recap', 'feedsInto'],
      ['Engage', 'Recap', 'feedsInto'],
      // Collaborations
      ['Calendar', 'Prep', 'collaboratesWith'], ['Inbox', 'Draft', 'collaboratesWith'],
      // Dependencies
      ['Prep', 'Calendar', 'dependsOn'], ['Draft', 'Prioritize', 'dependsOn'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'social-media-manager-v1',
    name: 'Social Media Manager',
    domain: 'Marketing',
    description: '10-agent swarm for social media management: trend monitoring, content creation, scheduling, engagement, audience growth, and performance analytics.',
    agentCount: 10,
    layerCount: 3,
    tags: ['social', 'marketing', 'content', 'engagement', 'analytics', 'growth'],
    layers: [
      { name: 'Listening & Research', colorTheme: '#00d9ff', order: 1 },
      { name: 'Content & Publishing', colorTheme: '#a855f7', order: 2 },
      { name: 'Engagement & Analytics', colorTheme: '#22c55e', order: 3 },
    ],
    agents: [
      // Listening & Research
      { nickname: 'Listen', formalName: 'Social-Monitor-Tracker', descriptor: 'The Listener', layerIndex: 0, badges: ['ENTRY', 'ALWAYS_ON', 'AUTO'], positionIndex: 0 },
      { nickname: 'Trends', formalName: 'Social-Trend-Spotter', descriptor: 'The Radar', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Compete', formalName: 'Social-Competitor-Watch', descriptor: 'The Rival Watcher', layerIndex: 0, badges: ['AUTO'], positionIndex: 2 },
      // Content & Publishing
      { nickname: 'Ideate', formalName: 'Content-Idea-Generator', descriptor: 'The Spark', layerIndex: 1, badges: ['AUTO'], positionIndex: 0 },
      { nickname: 'Write', formalName: 'Content-Post-Drafter', descriptor: 'The Voice', layerIndex: 1, badges: ['AUTO', 'APPROVAL'], positionIndex: 1 },
      { nickname: 'Visual', formalName: 'Content-Visual-Director', descriptor: 'The Eye', layerIndex: 1, badges: ['AUTO'], positionIndex: 2 },
      { nickname: 'Timing', formalName: 'Content-Calendar-Optimizer', descriptor: 'The Clock', layerIndex: 1, badges: ['AUTO', 'ALWAYS_ON'], positionIndex: 3 },
      // Engagement & Analytics
      { nickname: 'Reply', formalName: 'Engage-Response-Manager', descriptor: 'The Responder', layerIndex: 2, badges: ['AUTO', 'HUMAN'], positionIndex: 0 },
      { nickname: 'Grow', formalName: 'Engage-Audience-Builder', descriptor: 'The Networker', layerIndex: 2, badges: ['AUTO'], positionIndex: 1 },
      { nickname: 'Analytics', formalName: 'Report-Performance-Tracker', descriptor: 'The Scorekeeper', layerIndex: 2, badges: ['AUTO', 'LOGS_ALL'], positionIndex: 2 },
    ],
    relationships: [
      // Research feeds content
      ['Listen', 'Ideate', 'feedsInto'], ['Trends', 'Ideate', 'feedsInto'],
      ['Compete', 'Ideate', 'feedsInto'],
      // Content flow
      ['Ideate', 'Write', 'feedsInto'], ['Write', 'Visual', 'collaboratesWith'],
      ['Write', 'Timing', 'feedsInto'], ['Visual', 'Timing', 'feedsInto'],
      // Engagement
      ['Listen', 'Reply', 'feedsInto'], ['Timing', 'Analytics', 'feedsInto'],
      ['Reply', 'Grow', 'collaboratesWith'],
      // Analytics feedback loop
      ['Analytics', 'Ideate', 'feedsInto'], ['Analytics', 'Timing', 'feedsInto'],
      ['Grow', 'Analytics', 'feedsInto'],
      // Collaborations
      ['Listen', 'Compete', 'collaboratesWith'], ['Trends', 'Compete', 'collaboratesWith'],
      // Dependencies
      ['Write', 'Ideate', 'dependsOn'], ['Timing', 'Write', 'dependsOn'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
];

export class TemplateService {
  constructor(private db: Database.Database) {}

  listTemplates(): Array<Omit<SwarmTemplate, 'agents' | 'relationships' | 'layers'>> {
    return templates.map(t => ({
      id: t.id,
      name: t.name,
      domain: t.domain,
      description: t.description,
      agentCount: t.agentCount,
      layerCount: t.layerCount,
      tags: t.tags,
    }));
  }

  getTemplate(id: string): SwarmTemplate | null {
    return templates.find(t => t.id === id) || null;
  }

  instantiate(templateId: string, swarmName: string): Swarm | null {
    const template = this.getTemplate(templateId);
    if (!template) return null;

    const swarmId = uuidv7();
    const now = new Date().toISOString();

    // Create layer IDs
    const layerIds = template.layers.map(() => uuidv7());

    // Build layers
    const insertSwarm = this.db.prepare(
      "INSERT INTO swarms (id, name, description, template_source, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
    );
    const insertLayer = this.db.prepare(
      'INSERT INTO layers (id, swarm_id, name, color_theme, display_order) VALUES (?, ?, ?, ?, ?)'
    );
    const insertAgent = this.db.prepare(
      'INSERT INTO agents (id, swarm_id, nickname, formal_name, descriptor, layer_id, badges, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertRel = this.db.prepare(
      'INSERT INTO relationships (id, swarm_id, source_agent_id, target_agent_id, type) VALUES (?, ?, ?, ?, ?)'
    );

    const transaction = this.db.transaction(() => {
      insertSwarm.run(swarmId, swarmName, template.description, templateId, now, now);

      for (let i = 0; i < template.layers.length; i++) {
        const l = template.layers[i];
        insertLayer.run(layerIds[i], swarmId, l.name, l.colorTheme, l.order);
      }

      const agentIdMap = new Map<string, string>();
      for (const agent of template.agents) {
        const agentId = uuidv7();
        agentIdMap.set(agent.nickname, agentId);
        const layerId = layerIds[agent.layerIndex];
        const posX = 150 + agent.positionIndex * 300;
        const posY = 150 + agent.layerIndex * 250;
        const defaultConfig = agent.config || {};
        if (!defaultConfig.coreTask && DEFAULT_CORE_TASKS[agent.nickname]) {
          (defaultConfig as any).coreTask = DEFAULT_CORE_TASKS[agent.nickname];
        }
        insertAgent.run(
          agentId, swarmId, agent.nickname, agent.formalName, agent.descriptor,
          layerId, JSON.stringify(agent.badges), posX, posY,
          JSON.stringify(defaultConfig)
        );
      }

      for (const rel of template.relationships) {
        const sourceId = agentIdMap.get(rel.sourceNickname);
        const targetId = agentIdMap.get(rel.targetNickname);
        if (sourceId && targetId) {
          insertRel.run(uuidv7(), swarmId, sourceId, targetId, rel.type);
        }
      }
    });

    transaction();

    // Load and return the full swarm using inline query (avoids circular import)
    const row = this.db.prepare('SELECT * FROM swarms WHERE id = ?').get(swarmId) as any;
    if (!row) return null;

    const layerRows = this.db.prepare('SELECT * FROM layers WHERE swarm_id = ? ORDER BY display_order').all(swarmId) as any[];
    const agentRows = this.db.prepare('SELECT * FROM agents WHERE swarm_id = ?').all(swarmId) as any[];
    const relRows = this.db.prepare('SELECT * FROM relationships WHERE swarm_id = ?').all(swarmId) as any[];

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      templateSource: row.template_source || undefined,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      layers: layerRows.map((l: any) => ({ id: l.id, name: l.name, colorTheme: l.color_theme, order: l.display_order })),
      agents: agentRows.map((a: any) => ({
        id: a.id, swarmId: a.swarm_id, nickname: a.nickname, formalName: a.formal_name,
        descriptor: a.descriptor, layerId: a.layer_id, badges: JSON.parse(a.badges),
        position: { x: a.position_x, y: a.position_y }, config: JSON.parse(a.config),
      })),
      relationships: relRows.map((r: any) => ({
        id: r.id, swarmId: r.swarm_id, sourceAgentId: r.source_agent_id,
        targetAgentId: r.target_agent_id, type: r.type, metadata: JSON.parse(r.metadata),
      })),
    };
  }
}
