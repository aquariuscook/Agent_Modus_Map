# Quality Experience (QX) Analysis: Agent Modus Map

**Date:** 2026-03-26
**Target:** Agent Modus Map (non-technical user audience)
**Method:** Source code analysis of 9 key UI components
**Framework:** QX 23-Heuristic Model with Oracle Detection and Rule of Three

---

## Executive Summary

Agent Modus is a visual tool for designing, testing, and deploying multi-agent AI swarms. Its target audience includes non-technical users who need to build agent workflows without writing code.

**Overall QX Score: 71/100 (C+)**

The application has strong visual design fundamentals, a well-structured wizard flow, and genuinely helpful validation messages. However, it has significant language accessibility gaps, some interaction patterns that assume technical familiarity, and missing onboarding guidance that will block first-time users from achieving their goals.

| Dimension | Score | Grade |
|-----------|-------|-------|
| Overall QX | 71 | C+ |
| Usability | 68 | D+ |
| Visual Design | 82 | B |
| Accessibility | 55 | F |
| Trust & Safety | 76 | B- |
| Language Clarity | 58 | F |
| Task Completion | 70 | C |

**Top Strengths:**
1. Smart suggestion engine in the wizard detects task patterns and pre-fills fields, reducing cognitive load dramatically
2. Validation messages are written in plain, conversational English that explains consequences, not just errors
3. Four-mode workflow (Build/Watch/Test/Ship) provides clear progression from design to deployment
4. Dark/light theme with proper CSS variable architecture and AAA-compliant contrast ratios

**Critical Issues:**
1. Technical jargon throughout the UI will stop non-technical users cold (MCP servers, RAG sources, blast radius, feedsInto)
2. No onboarding, guided tour, or contextual help for first-time users
3. 8-step wizard is front-loaded with technical concepts (Model & Memory at step 4, Integrations at step 5)
4. Browser `prompt()` and `confirm()` dialogs used for critical actions (naming swarms, deleting swarms)

---

## Section 1: First-Time User Experience

### H1.1: Understand the Problem (65/100)

The dashboard hero text reads: "Design your agent swarm. Build, connect, and monitor multi-agent AI systems." This is reasonably clear, but "agent swarm" and "multi-agent AI systems" assume familiarity with these concepts. A non-technical user looking at this for the first time may wonder: What is an agent? What is a swarm? Why would I want one?

**Findings:**
- Hero copy uses domain jargon without definition
- Three entry points (Start from Scratch, Use a Template, Import CSV) are clear and well-differentiated
- Empty state message "No swarms yet. Create one above to get started." is helpful but minimal
- No explanation of what a completed swarm looks like or does
- No example screenshots, video, or walkthrough to set expectations

**Rule of Three failure modes:**
1. User does not understand what "swarm" means and leaves without trying
2. User clicks "Start from Scratch" but has no mental model of what to build, abandons the blank canvas
3. User tries a template but does not understand the pre-built agent relationships, cannot modify meaningfully

**Recommendation:** Add a brief "What is this?" explainer below the hero, or a single interactive example that shows a completed 3-agent swarm with annotations. Even one sentence like "An agent is an AI assistant with a specific job. A swarm is a team of agents that work together." would help.

### H1.2: Identify Who is Affected (60/100)

The app targets "non-technical users" but the interface frequently assumes technical knowledge. There is no user segmentation, no role-based simplification, and no progressive disclosure based on expertise level.

**Findings:**
- The wizard's Step 4 (Model & Memory) asks users to set temperature, max tokens, context window, and memory backend with no guidance beyond hint text
- Step 5 (Integrations) surfaces MCP servers, RAG sources, API calls, and database connections, which are developer-facing concepts
- Step 6 (Behavior & Safety) asks for "content filters," "output validation," and "retry count"
- Badge names like CAN_OVERRIDE, ALWAYS_ON, LOGS_ALL use developer conventions

**Rule of Three failure modes:**
1. Non-technical user encounters "temperature" slider at Step 4 and does not know what it does (hint text says "0 = deterministic and precise" but "deterministic" is also jargon)
2. User sees "MCP servers" in Step 5 and has no idea what MCP stands for or why they need it
3. User is asked to set "retry count" and "timeout in ms" in Step 6, which are operational engineering concepts

### H1.3: Recognize Oracle Problems (72/100)

The application has some clear quality criteria (validation rules in ValidationPanel.tsx are excellent) but lacks defined success criteria for the overall user journey. When is a swarm "done"? When is it "good enough" to test? The app does not answer these questions.

### H1.4: Apply Rule of Three (70/100)

The validation system identifies multiple failure modes per issue (disconnected agents, hub overload, missing monitoring), which is good. But it only triggers after agents exist on the canvas. There is no guidance during the design phase.

---

## Section 2: Navigation Clarity (Build/Watch/Test/Ship)

### H2.1: User Goals (78/100)

The four-mode system (Build, Watch, Test, Ship) maps well to a natural workflow progression. Each mode has a distinct color (cyan, green, yellow, purple) and context-specific toolbar buttons. This is one of the strongest UX decisions in the application.

**Findings:**
- Mode labels are short and action-oriented
- Color coding provides instant visual feedback about current context
- Toolbar buttons change per mode, reducing clutter
- The colored bottom border on the toolbar reinforces which mode is active

**Rule of Three failure modes:**
1. Users do not understand the sequence (should I Watch before I Test? What does Watch even mean in this context?)
2. The back button is just a `<` character with no label, which is not obvious
3. Swarm metadata shows "rel" as abbreviation for relationships, which is opaque to non-technical users

### H2.2: Pain Points (62/100)

**Watch mode** buttons are: Health, Decisions, Audit, History. These are reasonable labels for technical users but unclear for non-technical ones. What are "Decisions" tracking? Whose decisions? "Audit" sounds compliance-heavy.

**Test mode** has three buttons: Run Test, Optimize, Docs. "Optimize" is vague. Optimize what? Performance? Cost? Agent behavior?

**Ship mode** has five buttons: Deploy Package, Handoff Doc, Export JSON, Export HTML, Import. "Export JSON" and "Export HTML" are developer-oriented exports. "Handoff Doc" is a good idea but the label does not explain what it is.

### H2.3: Expectations (70/100)

The SimulationPanel has four sub-tabs: Mock, Cost, Live Test, Deploy. The "Mock" tab lets users run simulations with sample input, which is well-designed. The placeholder text "What should the agents work on? (leave blank for a default example)" is clear and helpful.

However, the "Live Test" tab is colored red, which could signal danger rather than "this uses real API calls." There is no warning about costs before running a live test.

### H2.4: Frustration Points (65/100)

The `prompt()` dialog for naming swarms is a significant UX regression. This is a browser-native dialog that:
- Cannot be styled
- Cannot show validation
- Cannot be pre-populated with a suggestion
- Feels like a broken experience on modern web apps
- Blocks the UI thread

This pattern is used in three places: creating a blank swarm, naming a template swarm, and (implicitly) in the delete confirmation via `confirm()`.

**Rule of Three failure modes:**
1. User accidentally dismisses the prompt dialog and the action is silently cancelled
2. User types a name they already used and gets no duplicate warning until later
3. User on mobile has a poor experience with browser-native dialogs

### H2.5: Context Awareness (74/100)

The toolbar shows agent count and relationship count, plus a health indicator dot. The legend panel on the canvas is collapsible and explains relationship types visually. This is good contextual information.

### H2.6: Emotional Response (72/100)

The warm plum dark theme and gem-tone palette create a distinctive, premium feel. The Outfit font is modern and readable. The overall aesthetic is well above average for developer tools, which helps non-technical users feel this is an approachable product.

---

## Section 3: Agent Creation Flow (8-Step Wizard)

### H3.1: Business Value (75/100)

The wizard's smart suggestion engine is the standout feature. When a user describes the core task in Step 2, the system matches against patterns (content moderation, customer service, code analysis, etc.) and pre-fills fields across all subsequent steps. This is excellent design that dramatically reduces the number of decisions a user must make.

**Findings:**
- 8 task patterns are pre-configured with full suggestion sets
- Green "Suggestion" chips appear with one-click apply
- Suggestion banners group related suggestions so users can accept them in batches
- The callout at Step 1 tells users that Step 2 drives the suggestions, which sets expectations

### H3.2: Revenue Impact (68/100)

The wizard asks for information that most non-technical users will not have: model provider, model ID, temperature, max tokens, context window, memory backend. If these fields block progress (they do not, since only Step 1 has required fields), users would abandon. Even as optional fields, their presence is intimidating.

**Rule of Three failure modes:**
1. User skips Steps 4-6 entirely, leaving their agent with defaults they do not understand
2. User applies suggestions without understanding them, creating an agent configuration they cannot troubleshoot later
3. User fills in everything, but the agent does not work because the model/provider combination is invalid and there is no runtime validation

### H3.3: Compliance (80/100)

Step 6 (Behavior & Safety) covers guardrails, blocked topics, output validation, citation requirements, cost limits, and permissions. This is thorough and important. The labels are clear: "What must it NEVER do?" is plain language.

### H3.4: Retention (65/100)

The wizard has no save-as-draft capability. If a user is midway through the 8 steps and closes the browser, all progress is lost. For a complex wizard with this many fields, that is a retention risk.

---

## Section 4: Visual Hierarchy and Theming

### H4.1: Visible Impacts (82/100)

**Dark mode (warm plum):**
- Background progression: #140e18 (base) to #271d2e (elevated) provides clear depth
- Text hierarchy: #f1f5f9 (primary), #94a3b8 (secondary), #64748b (tertiary) is well-differentiated
- Border system uses opacity-based white overlays, which works well on the plum base
- Gem tones (cyan, sapphire, amethyst, emerald, amber, ruby) provide clear semantic meaning

**Light mode (warm neutral):**
- AAA compliant: primary text #2d2015 on #FEFCFB = 15.5:1 contrast ratio
- Secondary text #5a4637 on #FEFCFB = 7.8:1 (exceeds AAA)
- Tertiary text #8a7566 = 4.5:1 (meets AAA for large text)

**Issues:**
- Some inline styles use hardcoded colors (e.g., `#fff`, `rgba(255,255,255,0.1)` in AgentNode badges) that will not adapt properly in light mode
- The ValidationPanel popup background is hardcoded to `rgba(15, 23, 42, 0.97)`, which is dark-only
- Edge styles in SwarmCanvas use hardcoded hex colors that will not adjust per theme

### H4.2: Invisible Impacts (70/100)

- No reduced-motion support for animations (healthPulse animation, transitions)
- No high-contrast mode option
- Agent cards have a fixed 220px width, which could overflow on small screens
- The SimulationPanel is fixed at 480px width, which may not fit mobile viewports

---

## Section 5: Error Prevention and Validation

### H5.1: Proactive Prevention (85/100)

The ValidationPanel is one of the best-designed components in the application. Its validation messages are exceptional:

- "X isn't connected to anything. It won't receive work from other agents or pass results along." This explains both the problem AND the consequence.
- "Y is important to your workflow, but nothing is watching it for problems." This is anticipatory, not just reactive.
- "Z is a bottleneck. 8 other agents can't work without it." This quantifies the risk.

Six validation rules cover: orphan agents, unmonitored critical agents, hub overload, unauthorized overrides, dead-end entry points, and bottleneck detection.

### H5.2: Recovery Support (58/100)

When things go wrong, recovery options are limited:
- Delete is an "X" button on the swarm list with a `confirm()` dialog and no undo
- Edge deletion asks "Delete this relationship?" with `confirm()` and no undo
- There is no version history, no undo/redo stack, and no autosave
- The wizard has no back-to-previous-step validation (you can go back but lose nothing, which is good)

**Rule of Three failure modes:**
1. User accidentally deletes a swarm (confirm dialog is easy to click through on autopilot)
2. User deletes the wrong edge and has to manually reconnect agents
3. User makes a series of bad changes and cannot revert to a known-good state

---

## Section 6: Task Completion (Blank Canvas to Tested Swarm)

### H6.1: End-to-End Flow Assessment (70/100)

The critical path is: Dashboard > Create Swarm > Add Agents (wizard) > Connect Agents > Validate > Test > Ship.

**Gaps in the flow:**
1. After creating a blank swarm, the user sees an empty canvas with no guidance. The "+" Agent button in the toolbar is visible, but there is no onboarding prompt.
2. Connecting agents requires dragging from one node's handle to another. This interaction pattern (React Flow handles) is not explained anywhere.
3. After connecting, the user must know to click "Validate" to check for issues. There is no automatic validation.
4. Moving from Build to Test mode requires clicking the mode switcher, then "Run Test," then understanding the Mock/Live/Cost/Deploy tabs.
5. Going from Test to Ship requires understanding what "Deploy Package" produces.

### H6.2: Drop-off Risk Assessment (65/100)

Estimated drop-off points:

| Step | Risk | Reason |
|------|------|--------|
| Dashboard to Canvas | LOW | Clear entry points |
| First agent creation | MEDIUM | Wizard is long, technical fields |
| Second agent creation | LOW | Same wizard, user knows the flow |
| Connecting agents | HIGH | No instructions for drag-to-connect |
| Understanding connections | MEDIUM | "feedsInto" vs "dependsOn" vs "collaboratesWith" requires domain knowledge |
| Running first test | MEDIUM | Mock vs Live distinction unclear |
| Deploying | HIGH | Export options are unclear for non-technical users |

---

## Section 7: Language Accessibility (Jargon Audit)

### H7.1: Terminology Barrier Assessment (58/100)

This is the weakest area of the application. Here is a catalog of terms that non-technical users will not understand, grouped by severity:

**Blocking (user cannot proceed without understanding):**

| Term | Location | Suggested Alternative |
|------|----------|----------------------|
| MCP servers | Wizard Step 5, Modal | Tool connections |
| RAG sources | Wizard Step 5, Modal | Knowledge sources |
| feedsInto | Canvas legend, relationship types | Sends data to |
| dependsOn | Canvas legend, relationship types | Needs input from |
| canOverride | Canvas legend, relationship types | Can overrule |
| Temperature | Wizard Step 4 | Creativity level (with scale explanation) |
| Max tokens | Wizard Step 4 | Response length limit |
| Context window | Wizard Step 4 | How much the agent can remember at once |
| Memory backend | Wizard Step 4 | Where memories are stored |

**Confusing (user can proceed but makes poor choices):**

| Term | Location | Suggested Alternative |
|------|----------|----------------------|
| Blast radius | Toolbar, canvas | Impact zone |
| Badges | Agent cards, wizard | Labels or Tags |
| HUB / CRITICAL / ENTRY | Badge names | Central agent / Essential / Starting point |
| CAN_OVERRIDE | Badge name | Has authority |
| LOGS_ALL | Badge name | Records everything |
| Guardrails | Wizard Step 6 | Safety rules |
| Content filters | Wizard Step 6 | Content rules |
| Output validation | Wizard Step 6 | Quality checks |
| Retry count | Wizard Step 6 | How many times to try again |
| Timeout in ms | Wizard Step 6 | Time limit |
| Circuit breaker | Config (code only) | Automatic shutoff |

**Acceptable with tooltip (domain terms that can be taught):**

| Term | Location | Notes |
|------|----------|-------|
| Swarm | Throughout | Core concept, needs one-time definition |
| Agent | Throughout | Core concept, needs one-time definition |
| Layer | Canvas, wizard | Organizational concept, needs brief explanation |
| Relationship | Canvas | Intuitive enough with visual context |

### H7.2: Plain Language Score (55/100)

The wizard Step 2 has excellent placeholder text: "Reviews all user-generated content against community guidelines and brand standards before it goes live. Flags problematic content, auto-approves clean content, and queues borderline cases for human review." This is the model for how the rest of the app should communicate.

The validation messages are also written in plain language. But the wizard field labels, badge names, and technical configuration sections undermine this.

---

## Section 8: Oracle Problems Detected

### Oracle Problem 1 (HIGH): Power vs. Simplicity Conflict

**Type:** User vs. Business conflict

The application wants to be both a no-code tool for non-technical users AND a comprehensive agent configuration platform. These goals conflict directly.

- **User Need:** Simple, guided experience where they describe what they want and the tool figures out the technical details
- **Business Need:** Expose every configuration option so power users can fine-tune agents for production workloads

**Evidence:** The wizard has 8 steps with 40+ fields. Steps 1-3 are approachable. Steps 4-7 are technical. The smart suggestion engine tries to bridge this gap, but it only covers 8 task patterns.

**Resolution Options:**

| Option | User Score | Business Score | Net |
|--------|-----------|----------------|-----|
| Remove technical fields entirely | 90 | 30 | 60 |
| Hide advanced fields behind "Show advanced" toggles | 82 | 78 | 80 |
| Two-track wizard: Simple (3 steps) and Advanced (8 steps) | 85 | 82 | 84 |
| Current approach (smart suggestions) | 65 | 85 | 75 |

**Recommendation:** Option 3 (two-track wizard). A "Quick Create" path that uses Steps 1-3 plus smart defaults from the suggestion engine would let non-technical users create agents in under 2 minutes. The full 8-step wizard remains available for power users via an "Advanced" toggle.

### Oracle Problem 2 (MEDIUM): Jargon as Identity vs. Jargon as Barrier

**Type:** Stakeholder conflict

The application uses terms like "blast radius," "swarm," "MCP servers," and "feedsInto" that signal technical sophistication. For technical users and buyers, this jargon builds credibility. For non-technical end users, it creates anxiety and confusion.

**Resolution:** Use plain language in the UI with technical terms available in tooltips. Example: Show "Impact zone" on the button, show "Blast radius: Shows which agents are affected when this one fails" in a tooltip.

### Oracle Problem 3 (MEDIUM): Native Dialogs vs. UX Quality

**Type:** Technical debt vs. user experience

Using `prompt()` and `confirm()` for naming and deletion is a shortcut that saves development time but produces a jarring, unstyled experience that undermines the premium feel of the rest of the UI.

**Resolution:** Replace with inline modals or form fields. The existing modal pattern (AgentBuilderWizard, AgentModusModal) demonstrates the team knows how to build quality modals. Apply the same pattern to swarm creation and deletion.

---

## Section 9: Heuristic Scores Summary

### Problem Analysis (H1.x)

| Heuristic | Score | Summary |
|-----------|-------|---------|
| H1.1: Understand the Problem | 65 | Dashboard explains the tool but not the domain |
| H1.2: Identify Who is Affected | 60 | No user segmentation or expertise-level adaptation |
| H1.3: Recognize Oracle Problems | 72 | Good validation rules, missing success criteria |
| H1.4: Apply Rule of Three | 70 | Validation catches multiple failure modes post-build |

### User Needs (H2.x)

| Heuristic | Score | Summary |
|-----------|-------|---------|
| H2.1: User Goals | 78 | Build/Watch/Test/Ship is a clear workflow |
| H2.2: Pain Points | 62 | Watch/Test mode labels assume technical context |
| H2.3: Expectations | 70 | Simulation panel is well-designed, live test cost unclear |
| H2.4: Frustration Points | 65 | Browser native dialogs, no undo, no autosave |
| H2.5: Context Awareness | 74 | Good metadata display, helpful legend |
| H2.6: Emotional Response | 72 | Premium visual design builds confidence |

### Business Needs (H3.x)

| Heuristic | Score | Summary |
|-----------|-------|---------|
| H3.1: Business Value | 75 | Smart suggestions are a differentiator |
| H3.2: Revenue Impact | 68 | Wizard complexity could reduce conversion |
| H3.3: Compliance | 80 | Safety and guardrails section is thorough |
| H3.4: Retention | 65 | No draft save, no undo history |

### Balance (H4.x)

| Heuristic | Score | Summary |
|-----------|-------|---------|
| H4.1: Visible Impacts | 82 | Strong theme system, minor hardcoded color issues |
| H4.2: Invisible Impacts | 70 | No reduced-motion, no responsive design for panels |
| H4.3: Trade-off Analysis | 68 | Power/simplicity trade-off unresolved |

### Impact (H5.x)

| Heuristic | Score | Summary |
|-----------|-------|---------|
| H5.1: Proactive Prevention | 85 | Validation messages are best-in-class |
| H5.2: Recovery Support | 58 | No undo, no autosave, destructive actions too easy |
| H5.3: Cascading Effects | 72 | Blast radius feature shows downstream impact |
| H5.4: Long-term Impact | 65 | Agent configs may become stale without maintenance guidance |

### Creativity (H6.x)

| Heuristic | Score | Summary |
|-----------|-------|---------|
| H6.1: End-to-End Flow | 70 | Path exists but lacks guided transitions |
| H6.2: Drop-off Risk | 65 | Connecting agents and deploying are high-risk steps |
| H6.3: Alternative Approaches | 75 | Templates, CSV import, and blank canvas offer multiple entry points |

---

## Section 10: Prioritized Recommendations

### Priority 1: Do Now (High Impact, Low-Medium Effort)

| # | Recommendation | Impact | Effort | Timeline |
|---|---------------|--------|--------|----------|
| 1 | Replace `prompt()`/`confirm()` with styled inline modals | High | Low | 1-2 days |
| 2 | Add tooltips to all badge names with plain-language explanations | High | Low | 1 day |
| 3 | Rename "Blast radius" to "Impact zone" (or similar) | Medium | Trivial | Hours |
| 4 | Rename relationship types in the legend: "Feeds Into" to "Sends data to", "Depends On" to "Needs input from" | Medium | Low | Hours |
| 5 | Add a "What is a swarm?" one-liner below the dashboard hero | Medium | Trivial | Hours |
| 6 | Fix hardcoded dark-mode colors in ValidationPanel popup and AgentNode badges | Medium | Low | 1 day |

### Priority 2: Do Next (High Impact, Medium Effort)

| # | Recommendation | Impact | Effort | Timeline |
|---|---------------|--------|--------|----------|
| 7 | Create a "Quick Create" 3-step wizard path for non-technical users | High | Medium | 1 week |
| 8 | Add first-time onboarding: canvas tour showing how to add agents, connect them, and run tests | High | Medium | 1 week |
| 9 | Add undo/redo for canvas operations (add agent, delete agent, add/remove edge) | High | Medium | 1 week |
| 10 | Add autosave to the wizard (persist draft to localStorage) | Medium | Low | 2-3 days |
| 11 | Add a cost warning before running live tests ("This will make real API calls that cost money") | Medium | Low | Hours |

### Priority 3: Do Later (Medium Impact, Higher Effort)

| # | Recommendation | Impact | Effort | Timeline |
|---|---------------|--------|--------|----------|
| 12 | Implement responsive design for SimulationPanel and modals on smaller screens | Medium | Medium | 1 week |
| 13 | Add reduced-motion media query support for all animations | Low | Low | 1-2 days |
| 14 | Add keyboard navigation for canvas operations (arrow keys to select agents, Enter to open details) | Medium | High | 2 weeks |
| 15 | Create an "Agent Glossary" panel that defines all domain terms in one place | Medium | Medium | 3-5 days |
| 16 | Add version history or "snapshots" so users can revert to a previous swarm state | High | High | 2-3 weeks |

---

## Section 11: Methodology

This analysis applies the QX (Quality Experience) framework, which bridges quality assurance and user experience through 23+ heuristics organized in 6 categories. The framework identifies oracle problems (situations where quality criteria are unclear or conflicting) and applies the Rule of Three (every issue must have at least 3 identified failure modes) to ensure analysis depth.

**Analysis was performed by:** Source code review of 9 primary UI components, CSS theme definitions, and component interaction patterns. No live browser testing was possible for this evaluation.

**Components analyzed:**
- `Dashboard.tsx` (270 lines) - Home page and entry points
- `EditorToolbar.tsx` (178 lines) - Mode switcher and context actions
- `AgentBuilderWizard.tsx` (600+ lines) - 8-step agent creation wizard
- `AgentModusModal.tsx` (400+ lines) - Agent detail view and editing
- `SwarmCanvas.tsx` (295 lines) - Visual canvas with React Flow
- `SimulationPanel.tsx` (400+ lines) - Mock/live testing and deployment
- `ValidationPanel.tsx` (204 lines) - Error and warning validation
- `AgentNode.tsx` (177 lines) - Individual agent card rendering
- `theme.css` (187 lines) - Design tokens and theme definitions

**Limitations:** This analysis is based on source code review only. Live interaction testing would likely reveal additional usability issues related to timing, animation, responsive behavior, and interaction feedback that are not visible in static code analysis.
