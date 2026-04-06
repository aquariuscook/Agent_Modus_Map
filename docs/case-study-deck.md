# Agent Modus: Case Study
## Designing Transparent, Human-Centered Multi-Agent AI Systems

**Presenter:** Anne Cook
**Role context:** Design role at Superhuman, focused on AI design, transparency, ethics

---

## SLIDE 1: Title

**Agent Modus**
Designing Transparent, Human-Centered Multi-Agent AI Systems

Anne Cook | Design Case Study

*Speaker notes: Brief intro. "I'm going to walk you through something I built to solve a problem I kept seeing in the AI space. It's called Agent Modus, and it's a visual tool for designing, testing, and deploying multi-agent AI systems."*

---

## SLIDE 2: The Problem

**Building AI agent systems today requires code. Understanding them requires even more.**

- Enterprises building agent swarms involve legal, compliance, ops, product, and engineering
- The only shared artifact is a codebase nobody outside engineering can read
- No way for non-technical stakeholders to understand what agents do, how they decide, or where the guardrails are
- Observability, transparency, and human oversight are afterthoughts, not design primitives

*Speaker notes: "Right now, if a company wants to build a team of AI agents that work together, the only way to do it is in code. And the only way to understand what those agents are doing is to read logs. That means legal can't review it. Compliance can't audit it. Product can't design it. The people who should have the most say in how AI behaves are locked out of the process."*

---

## SLIDE 3: The Thesis

**"Building an agent swarm will be as common as using a calculator. The tools need to be just as accessible."**

- AI agent teams will be standard infrastructure for every business
- The people deploying them won't always be engineers
- The tool for building them should be visual, transparent, and collaborative

*Speaker notes: "My thesis is simple. Multi-agent AI systems are going to be something everyone uses. Not just developers. Business owners, project managers, conversation designers, ops teams. If that's true, then the tools to build them need to be as intuitive as a spreadsheet or a slide deck. That's what I set out to build."*

---

## SLIDE 4: What I Built

**Agent Modus: A no-code visual design tool for multi-agent AI systems**

- Design agent teams on a visual canvas
- Configure every agent's autonomy, guardrails, relationships, and behavior
- Test with simulations before spending money on API calls
- Deploy and monitor with full observability
- Works for enterprise teams in a room together, or a solo founder at a laptop

[SCREENSHOT: Full canvas view showing the lead gen swarm with 15 agents across 4 color-coded layers, relationship lines visible, legend open]

*Speaker notes: "This is Agent Modus. Each node is an AI agent. The colors represent functional layers. The lines show how agents pass data to each other, depend on each other, or collaborate. Every agent has a nickname so you know at a glance what it does: Scout finds companies, Profile researches them, Qualify scores them, Craft writes outreach. You can see the whole system in one view."*

---

## SLIDE 5: Design Principle 1 - Legibility

**Every agent tells you what it is and what it's allowed to do, without clicking.**

- **Nicknames**: Scout, Profile, Qualify, Craft, Command (not "Agent-017")
- **Badges**: ENTRY, CRITICAL, APPROVAL, HUMAN, AUTO, HUB, ALWAYS_ON
- **Color-coded layers**: Discovery (blue), Outreach (purple), Qualification (green), Pipeline (gold)
- **Relationship types**: "feeds into", "depends on", "collaborates with", "can override" with a visible legend

[SCREENSHOT: Close-up of 3-4 agents showing badges, nicknames, and relationship lines with the legend panel open]

*Speaker notes: "I wanted someone to walk into a room, look at this screen, and understand the system in 30 seconds. The badges tell you the governance story. APPROVAL means a human has to sign off before this agent acts. CRITICAL means if this agent fails, the whole pipeline breaks. HUMAN means there's a person in the loop. You don't have to open a config file to understand the power dynamics of the system."*

---

## SLIDE 6: Design Principle 2 - Configurable Autonomy

**Every agent has an autonomy level: autonomous, semi-autonomous, or human-in-the-loop.**

- Visible in the agent config panel, not buried in code
- Blocked topics and content filters per agent
- Output format constraints
- A compliance officer can look at this and say "that agent has too much freedom" without reading a single line of code

[SCREENSHOT: Agent config modal showing autonomy level dropdown, core task, guardrails section with blocked topics]

*Speaker notes: "This is the agent editor. You can set the autonomy level right here. You can define what topics it's not allowed to discuss. You can constrain its output format. The point is that governance isn't something you bolt on after the system is built. It's a first-class design decision that anyone can see and change."*

---

## SLIDE 7: Design Principle 3 - Testing Before Trusting

**Three tiers of testing, each increasing in cost and confidence.**

| Tier | What it does | Cost | What you learn |
|------|-------------|------|----------------|
| **Mock Run** | Simulates the flow with no API calls | Free | Does the pipeline logic work? |
| **Live Test** | Real LLM calls through the agent graph | ~$0.05 | Do the agents produce good output? |
| **Deploy** | Full run with persistence and scheduling | ~$0.06 | Does it work at scale? |

- Cost estimate tab shows per-agent and monthly projections BEFORE you run anything
- Search preview lets you validate data quality before agents touch it

[SCREENSHOT: Test mode showing the simulation panel with Mock/Cost/Live Test/Deploy tabs, with a completed live test showing agent responses and the diagnostics section]

*Speaker notes: "You shouldn't have to deploy something to find out if it works. Mock runs are free. They show you the execution path, which agents fire, what data flows where. Live tests make real API calls but you see every agent's response, its cost, its duration, and any issues. The diagnostics section literally tells you what to fix. I built three tiers because each one gives you a different level of confidence, and each one costs more. You graduate through them."*

---

## SLIDE 8: Design Principle 4 - The Agents Check Each Other

**Hallucination prevention isn't a feature. It's the architecture.**

Real example from the lead gen swarm:
1. **Scout** searched for companies and returned training providers instead of prospects
2. **Profile** flagged it: "Scout's output contains fabricated/speculative prospects"
3. **Qualify** refused to score: "Cannot assess without actual prospect company data"
4. **Craft** refused to write emails: "Unable to proceed. These are suppliers, not buyers."
5. **Command** returned `"prospects": []` with a full explanation of why

The system said "I don't have good data" instead of making something up.

[SCREENSHOT: Deploy results showing a run where agents flagged bad data, or the Command output with the "excludedProspects" section showing rejected companies with reasons]

*Speaker notes: "This is the moment that convinced me the architecture was right. The search returned bad data. Training providers instead of actual companies. And instead of the system quietly producing garbage, each downstream agent independently identified the problem and refused to act on it. Profile said the data was speculative. Qualify said it couldn't score without real companies. Craft said it couldn't write outreach without real prospects. The system chose honesty over output. That's not a prompt I wrote. That's an emergent property of having agents validate each other's work."*

---

## SLIDE 9: The Full Loop - From Search to Send

**A working lead generation pipeline, end to end.**

1. **Write your query** in plain language ("Find women-owned businesses on Long Island...")
2. **Preview the search** to see what the AI will work with (zero cost)
3. **Deploy** and 15 agents process the query through research, profiling, scoring, outreach writing
4. **Review in the Prospect Dashboard** with scores, signals, contact info, and draft emails
5. **Take action**: send emails, update pipeline status, export to CSV, track in the database

[SCREENSHOT: The Prospect Dashboard showing the full layout - prospect list on left, detail panel on right with company info, buying signals, outreach email, pipeline status buttons]

*Speaker notes: "Here's a real use case. I built a 15-agent swarm for consulting lead generation. You type what you're looking for in plain language. The system searches the web, scrapes business directories, identifies real companies, scores them, writes personalized outreach in three different tones, and presents everything in an actionable dashboard. You can send the email right from here, or copy it, or export the whole pipeline to a spreadsheet. Every step is visible. Every decision is explainable."*

---

## SLIDE 10: The Prospect Dashboard

**From AI output to human action, with nothing hidden.**

- **Scores are visible with reasoning**: "8/10 because: WBEC-certified, multi-state operations, compliance needs"
- **Three email tones**: Professional, Conversational, Value-First (because one size doesn't fit all)
- **Manual pipeline**: User moves prospects through stages (new, contacted, meeting, proposal, won)
- **Nothing auto-sends**: Every email is a draft. The human is always the sender.
- **Persistent database**: Prospects accumulate across runs. Deduplicated. Searchable. Exportable.

[SCREENSHOT: Close-up of a single prospect card showing the score, buying signals tags, contact info, and the three email tone tabs with a draft visible]

*Speaker notes: "The dashboard is deliberately not automated. I could have had the system auto-send emails. I chose not to. The AI finds the companies, does the research, writes the drafts. But the human decides who to contact, edits the message, and hits send. That's a design decision about trust. The AI is the research assistant. The human is the relationship builder. And the scores and signals are visible so you can always ask: why did the AI recommend this company?"*

---

## SLIDE 11: Trade-offs I Made

**Transparency over speed. Control over convenience. Honesty over volume.**

| I could have... | Instead I... | Why |
|-----------------|-------------|-----|
| Auto-sent emails from the dashboard | Made them mailto drafts | Outreach is a human relationship. AI assists, humans connect. |
| Hidden low-confidence results | Showed scores and let users filter | Users should decide their own quality threshold. |
| Automated the pipeline stages | Made them manual click-to-advance | The user should own the sales process, not watch it happen. |
| Suppressed "no good data" responses | Let agents refuse to act on bad data | A system that fakes confidence is worse than one that says "I don't know." |
| Skipped search preview | Added a free preview step before deploy | Users deserve to see what the AI is working with before spending money. |

*Speaker notes: "Every one of these was a choice. The faster, shinier version would have been more automated. But I think trust in AI systems comes from transparency, not from polish. If I can't see why the AI made a decision, I shouldn't trust the decision. Every feature in Agent Modus is designed around that principle."*

---

## SLIDE 12: How This Connects to Superhuman

**Superhuman builds AI that amplifies human capability without replacing it. That's exactly what Agent Modus does.**

- **Multi-agent orchestration**: Superhuman Go coordinates agents across apps. Agent Modus is the design surface for that kind of system.
- **"Amplify, don't replace"**: Agent Modus keeps humans in the loop at every decision point. The AI does the heavy lifting. The human stays in control.
- **Trust through transparency**: Superhuman's products are built on speed and confidence. Confidence requires knowing what the AI is doing and why. That's what observability, decision traces, and visible guardrails provide.
- **Design for everyone**: Superhuman makes complex productivity simple for professionals. Agent Modus makes complex AI systems simple for non-technical teams.

*Speaker notes: "I built Agent Modus because I believe the tools for AI need the same design rigor as the products AI powers. Superhuman makes email and productivity beautiful, fast, and trustworthy. The AI systems underneath those products deserve the same treatment. That's what I do. I design AI systems that people can understand, trust, and control."*

---

## SLIDE 13: What's Next

**Agent Modus is a working product. Here's where it's going.**

- OAuth email integration (send from the dashboard, not just mailto)
- Real-time collaboration (multiple designers on one canvas)
- Template marketplace (share and reuse swarm designs)
- Enterprise audit trail (who changed what agent config and when)
- Deeper analytics (pipeline conversion rates, cost per qualified lead)

*Speaker notes: "This is a working product today, not a prototype. I've been running real lead gen campaigns through it. The next phase is about scaling: letting teams collaborate in real time, building a marketplace for swarm templates, and adding the audit and compliance features that enterprises need. The foundation is solid because I built transparency and control into the architecture from day one, not as an afterthought."*

---

## SCREENSHOT GUIDE

Take these screenshots from the running app (http://localhost:3000):

1. **01-canvas-overview**: Open "My Consulting Lead Gen" swarm. Build mode. All 15 agents visible with relationship lines. Legend open on the left.

2. **02-agent-badges-closeup**: Zoom in on 4-5 agents showing different badges (ENTRY on Scout, CRITICAL on Qualify, APPROVAL on Craft, HUB on Funnel). Relationship lines visible between them.

3. **03-agent-config**: Click on any agent (try Scout or Qualify). The agent editor/modal should show: autonomy level, core task, guardrails/blocked topics, model config.

4. **04-watch-mode**: Switch to Watch mode. Shows health indicators (green/yellow/red dots) on agents, any decision trace data.

5. **05-test-panel**: Switch to Test mode, open the Run Test modal. Show the Mock/Cost/Live Test/Deploy tabs. If there's a completed live test result, show the agent responses with the diagnostics section.

6. **06-deploy-panel**: Switch to Ship mode, click Deploy. Show the deploy form with the search preview results visible (run Preview Search first with the lead gen query).

7. **07-prospect-dashboard**: Click "Prospect Database" button. Full dashboard showing: prospect list on left, detail panel on right with a prospect selected showing score, signals, contact info, email drafts, pipeline status buttons.

8. **08-prospect-detail-email**: In the dashboard, select a prospect that has outreach emails. Show the Professional email tab with the draft visible and the Send/Copy buttons.

9. **09-excluded-prospects**: If possible, show a deploy result where Command returned excluded prospects with reasons (the "excludedProspects" section from the JSON).

---

## DECK INSTRUCTIONS FOR CLAUDE CHAT

When you bring this to Claude Chat for deck design:

- Use a dark theme matching Agent Modus (dark navy/charcoal background, teal/cyan accents, white text)
- Keep slides clean with lots of whitespace
- Screenshots should be large, centered, with a subtle drop shadow
- Use the trade-offs table on Slide 11 as-is, it's the most important slide
- The speaker notes are for Anne to practice with, not for the slides
- Total: 13 slides, about 15-20 minutes of presentation
- The narrative arc: Problem -> Thesis -> Solution -> Principles (4 slides) -> Live Demo Flow -> Trade-offs -> Connection to Superhuman -> What's Next
