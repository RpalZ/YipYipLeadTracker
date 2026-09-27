**PRODUCT REQUIREMENTS DOCUMENT**

# YipYip Early Signal Lead System

A configurable system for finding and qualifying digital project opportunities before formal procurement

| **Item** | **Detail** |
| --- | --- |
| **Document status** | Draft for product and engineering alignment |
| **Version** | 2.0 |
| **Date** | 25 September 2026 |
| **Primary audience** | YipYip stakeholders, product, engineering, research operations, and business development |
| **Decision requested** | Validate whether the corrected live campaign produces 2–3 current organizations worth YipYip's human relevance judgment |

**Product direction**

The system should operate as an autonomous lead engine: people configure commercial intent and approve a reputable source once; bounded automation repeatedly discovers, assesses, researches, and qualifies opportunities. Humans review finished leads and genuine exceptions rather than performing routine assessment steps.

## Contents

**01** Executive Summary

**02** Product Purpose and Problem

**03** Goals and Non Goals

**04** Users and Jobs

**05** Product Principles

**06** Core Data Concepts

**07** End to End Workflow

**08** Functional Requirements

**09** Scoring and Qualification

**10** Provenance and Trust

**11** Data Schemas

**12** System Requirements

**13** Architecture and Processing Controls

**14** Human Review

**15** Observability and Evaluation

**16** Risks and Mitigations

**17** MVP Scope

**18** Phased Roadmap

**19** Open Decisions

**20** Acceptance Criteria

## Executive Summary

YipYip needs earlier visibility into organizations that may soon commission digital work. Published tenders arrive after the market is crowded and, in many cases, after an organization has already formed a preferred supplier profile. The product will therefore look for public signals that precede formal procurement, such as funding announcements, policy plans, calls for pitches, new digital roles, strategic roadmaps, market consultations, and project announcements.

The system will run separate discovery jobs for each enabled source or source family. It will normalize each result as a Signal, resolve related Signals into a shared Opportunity, score that Opportunity against a versioned YipYip profile, identify missing qualification data, and perform focused research only when the missing data could change the decision. A final assessment will rerank the enriched set and promote only the strongest opportunities to Leads.

Opportunity is the central product entity. A Signal records something observed in a source. An Assessment records a time bound judgment against a specific YipYip profile and scoring configuration. A ResearchFinding records new information obtained through focused research. A Lead is a qualified presentation of an Opportunity for action. This separation preserves auditability and prevents delivery records from becoming the source of truth.

The research loop will have two levels. The agent may conduct several searches within one run, but application logic will validate whether each requested question is answered or explicitly unresolved. If the result is incomplete, the application may continue research within configured pass, time, and cost limits. Unknown is a valid outcome when reasonable attempts do not establish a value.

### Success Measures

| **Outcome** | **Initial product measure** | **Why it matters** |
| --- | --- | --- |
| Earlier discovery | Median days between first captured signal and formal tender or public supplier selection event, where one later occurs | Tests whether the system creates a useful timing advantage |
| Lead usefulness | Share of delivered leads marked relevant or worth contacting by YipYip | Measures practical value rather than model confidence |
| Evidence quality | Share of externally sourced facts that resolve to accessible provenance | Protects trust and makes outreach defensible |
| Research efficiency | Useful leads and resolved qualification questions per research cost unit | Controls the expense of deep research |
| Coverage | Known relevant signals captured across enabled sources | Reveals source and query blind spots |

## Product Purpose and Problem

### Purpose

Build an agentic lead intelligence system that identifies opportunities before they become official tenders and turns the strongest early signals into sourced, actionable leads for YipYip.

### Problem Statement

Useful pre procurement signals are scattered across unrelated channels and expressed in inconsistent language. YipYip cannot subscribe to one complete feed, and manual discovery depends on chance. Existing tender feeds solve a later problem: they make official opportunities visible after many competitors can see them. The missing capability is a repeatable way to detect, combine, qualify, and explain weaker early signals while there is still time to build a relationship or influence scope.

### Product Hypothesis

If the system searches a diverse, configurable source set, links corroborating signals to the same opportunity, and applies YipYip specific qualification criteria before expensive research, then it can deliver fewer but more actionable opportunities earlier than tender monitoring alone.

### Constraints

- Public availability does not remove source terms, privacy, or data use obligations. Each source adapter must record its permitted access method.

- A model score cannot represent a true probability of winning. The product will assess commercial access and relationship potential instead.

- A high budget is not automatically positive. Delivery fit must identify work that is too small, suitable, partner dependent, or too large.

- The system must distinguish observed facts, model inferences, human judgments, and unresolved questions.

## Goals and Non Goals

### Goals

- Detect credible public signals of a possible digital project before formal procurement or broad supplier competition.

- Let business users define discovery coverage through signal areas and criteria without assembling source URLs, while operations govern the exact sources and adapters in an internal registry.

- Combine related signals into a durable opportunity record without losing their individual provenance.

- Rank opportunities against a current, versioned YipYip profile and configurable scoring policy.

- Spend deep research effort only on promising opportunities and decision relevant gaps.

- Deliver concise lead records that explain why the opportunity matters now, what remains uncertain, and what YipYip should do next.

- Retain intermediate decisions and rejection reasons so product quality can be measured and improved.

### Non Goals

- Replacing TenderNed or building a complete tender aggregation product for the initial YipYip use case.

- Guaranteeing that an opportunity will become a project, tender, or sale.

- Estimating a literal win probability or automating supplier selection decisions.

- Automating unauthorized scraping, bypassing access controls, or making restricted social platforms a core dependency.

- Sending outreach or contacting people automatically in the MVP.

- Building a general purpose customer relationship management system.

- Requiring normal business users to find, validate, or maintain individual source links.

- Requiring every qualification field to contain a value when the information is not publicly available.

## Users and Jobs

| **User** | **Primary job** | **Product need** |
| --- | --- | --- |
| Business development lead | Decide which organizations deserve attention now and what kinds of signals should be monitored | A short ranked list, clear rationale, source links, contact context, a suggested next action, and criteria based discovery coverage |
| Research operator | Investigate missing qualification data and resolve conflicting evidence | Candidate specific questions, preserved prior findings, bounded research runs, and explicit unknown results |
| Source administrator | Govern the proposed source network | Lead Strategy, Source Scout proposals, one-time approvals, schedules, source reputation, health, and legal or access notes |
| YipYip delivery lead | Judge whether the work fits current capability and capacity | Project size, technical scope, timing, partner need, and the profile version used |
| Product owner | Improve relevance, quality, and cost | Decision logs, user feedback, missed signal analysis, evaluation sets, and configurable thresholds |
| System operator | Keep scheduled processing reliable | Run status, retry controls, cost limits, alerts, and idempotent recovery |

## Product Principles

| **Principle** | **Product consequence** |
| --- | --- |
| **Search wide then research deeply** | Discovery favors coverage and low unit cost. Deep research is reserved for high potential opportunities with material gaps. |
| **Opportunity is the central record** | Signals, assessments, findings, contacts, and the optional lead all attach to an Opportunity. |
| **Coverage is intent; sources are implementation** | Business users configure what signal areas, markets, organizations, and project types matter. Exact URLs, adapters, schedules, access methods, and source health remain in a governed internal registry. |
| **Evidence follows the claim** | Structured fields copied from a raw signal use the signal source as provenance. New researched claims create ResearchFinding records with their own sources. |
| **Unknown can be complete** | A research question may close as unknown after reasonable attempts. The product never pressures the model to invent a value. |
| **Scores remain explainable** | Every dimension includes a score, confidence, rationale, and policy version. The overall score never appears alone. |
| **Human attention is scarce** | The system routes borderline, high value, and high risk cases for review while allowing routine low risk decisions to proceed automatically. |

## Core Data Concepts

| **Concept** | **Definition** | **Relationship** |
| --- | --- | --- |
| **Signal** | A source specific observation that may indicate an emerging need, project, budget, organizational change, or supplier search. | Several Signals can support one Opportunity. A Signal remains immutable apart from processing metadata. |
| **Opportunity** | The canonical representation of a possible underlying project or commercial opening at an organization. | Central entity that aggregates Signals, contacts, facts, findings, assessments, and lifecycle state. |
| **Assessment** | A versioned judgment of an Opportunity against YipYip profile data, evidence, scoring weights, and thresholds at a point in time. | An Opportunity may have initial, final, and human adjusted Assessments. |
| **ResearchFinding** | A focused answer, justified inference, conflict, or explicit unknown produced to resolve a question about an Opportunity. | Created only when research adds knowledge beyond the source facts already captured in Signals. |
| **Lead** | An actionable delivery record created when an Opportunity passes final qualification, or by an explicitly attributed manual override that remains visibly non-qualified. | References the Opportunity and final Assessment rather than duplicating the whole knowledge graph; its origin determines whether it represents automatic qualification or a human commercial choice. |

Candidate is a workflow label rather than a separate persistent entity. An Opportunity is a candidate while it is being evaluated. This avoids a second object that would duplicate Opportunity state.

## End to End Workflow

0. **Lead Strategy.** An owner or operator edits one versioned Lead Strategy per workspace: geography, languages, sectors, YipYip software capabilities, project types, budget fit, hard-excluded and sensitive sectors, search exclusions, effective-dated delivery capacity, freshness, cadence, and cost limits. Dutch agency-pitch defaults are prefilled but remain editable.

1. **Source Scout.** Saving or materially changing the strategy automatically queues a bounded Source Scout. It proposes specific reputable sources with sample evidence, access and policy checks, reputation, confidence, coverage rationale, and operating cost.

2. **One-time source approval.** An owner or operator approves or rejects each source proposal. Approval immediately creates an enabled weekday monitor. Rejection records the reason and suppresses unchanged proposals. No source is enabled solely by an agent.

3. **Recurring monitoring.** A Supabase Cron dispatcher claims approved source jobs due at 07:00 Europe/Amsterdam each weekday. A protected server-only worker processes one durable, leased stage per invocation.

4. **Normalization and resolution.** New results are citation/date/URL/policy validated and deterministically deduplicated. Organization-specific signals are exactly matched to Organizations and Opportunities. A funding call or programme without an identified commissioning buyer or concrete applicant remains a programme-level Signal for monitoring and never creates a synthetic organization Lead. Probabilistic merging remains a human exception.

5. **First Assessment.** A bounded assessor produces evidence-backed dimension judgments. Technical capability fit must list both the configured YipYip services supported by the evidence and concrete project requirements that remain unsupported or unclear. This evidence-backed project match is distinct from the operator-owned delivery-capacity setting. Application code applies hard exclusions and calculates the configured score; users do not click an Assess button.

6. **Gap Analysis and focused research.** Only missing information capable of changing qualification, route, or rank becomes a research question. Application policy injects focused questions for unresolved YipYip-addressable commercial scope, capability fit, current actionability, and an actionable contact route. Research executes separate commercial, buyer-access, capability, and timing bundles. Each focused pass is limited to three hosted web-search/tool calls. A first valid `unknown` or `not_found` receives one materially different search pass before becoming terminal; strongly inferred claims require at least two cited sources, while one authoritative primary source may confirm a direct fact.

7. **Final Assessment and routing.** The complete evidence snapshot is rescored and produces evidence-grounded email and cold-call drafts. Only `score.decision = qualify` plus every persisted deterministic gate may create a Lead. Proven poor fit rejects; a strong fit whose public commercial, buyer, capability, or timing evidence remains unavailable after bounded research enters Monitoring; conflicting evidence, sensitive sectors, unusual size, partner dependency, internal capacity ambiguity, review-band scores, and invalid outreach enter Needs attention. Agent confidence cannot override these gates.

8. **Exception resolution and Lead decisions.** A non-Lead Opportunity enters **Needs attention** only when automation needs a human exception decision. Its drawer exposes a **Resolve** tab: request focused research, pass on the Opportunity, or deliberately create a clearly labelled manual Lead despite overridable gaps. Qualified or manually created Leads instead expose a **Decision** tab where humans decide whether YipYip should start pursuing the finished Lead. People do not perform routine discovery or assessment.

   A queued or running automatic qualification workflow is an operational **Progress** state, not an exception. The drawer must state that research is already underway and show how the operator can continue the live queue. It must not require an `automation_exception` record, expose duplicate research controls, or imply that human resolution is needed until deterministic routing creates a genuine terminal exception.

   The implemented Decision tab supports **Start pursuing**, **Pass on Lead**, **Research a gap**, and **Change route**. Lead decisions are written through one atomic, version-checked RPC with stable reason codes, idempotency keys, immutable events, and role enforcement. The Opportunity Resolve tab uses a separate atomic RPC so exception state, Opportunity lifecycle, immutable decision history, and any queued qualification workflow change together. Research starts again at First Assessment; it does not imply that a missing public value will be found.

   Each qualifying Lead version stores an immutable outreach snapshot with language, recommended channel, a capped email, a capped cold-call opening, discovery questions, evidence references, and caveats. The Outreach tab can copy these drafts but never sends them.

   The implemented session basket remains accessible from the shared header across Leads, Source Network, and the **Pursuit workspace**. It reconciles saved IDs against current Opportunities so its badge and drawer cannot disagree after resets, quarantine, or data changes. The `/reviewed` route receives that session shortlist and persistent Lead/decision state, grouping projects into **Needs requalification**, **Working on**, **Research running**, **Saved and awaiting decision**, and **Passed**. Historical Leads whose final Assessment was not actually `qualify` are quarantined without changing their Lead status or decision history. Shortlist membership remains browser-session-only; Lead status and immutable history remain authoritative in Supabase.

   During low-volume periods, an owner or reviewer may deliberately **Create manual Lead** from a completed Monitoring, Needs-attention, or Rejected Opportunity. This creates a separately labelled `manual_promotion` Lead version, immutable promotion event, and caveated outreach snapshot without changing the automated lifecycle, score, Assessment, or failed gates. It does not approve pursuit: the Lead still awaits an explicit Decision. A hard-excluded sector or an expired Opportunity without a supported current follow-on remains non-overridable. Manual promotion is a human commercial choice—not a claim that the Opportunity automatically qualified.

9. **Implemented product-validation path.** The public demo simulates this complete workflow in browser `sessionStorage`: editable Lead Strategy, automatic Source Scout, individual approval, accelerated monitoring/assessment/research/routing, qualified leads, an exception, and repeat-run deduplication. It never calls Supabase or OpenAI and never represents simulated evidence as live.

### Workflow States

| **Stage** | **Entry condition** | **Exit condition** |
| --- | --- | --- |
| Discovered | At least one Signal is stored | Signal is normalized and resolved |
| Assessing | Opportunity has usable source facts | Initial Assessment is completed |
| Rejected | Hard rule or threshold fails | Terminal unless policy or evidence changes |
| Needs research | Promising but decision relevant gaps remain | Questions are resolved or research budget is exhausted |
| Ready for final assessment | Information is sufficient or explicitly unresolved | Final Assessment is completed |
| Monitoring | Potential fit remains but bounded public research could not establish a required fact | A new source Signal or explicit reassessment restarts qualification |
| Needs attention | A configured qualification-exception rule fires | Resolve by requesting research, passing on the Opportunity, or creating an explicitly manual Lead when policy permits |
| Qualified | Final policy passes | Lead is created |
| Delivered | Lead reaches the configured destination | Feedback and later outcomes remain trackable |

## Functional Requirements

### YipYip Profile

The assessment layer shall use a versioned YipYip profile. A run must record the exact profile version so later score changes can be explained.

- Preferred sectors, organization types, and social impact themes

- Desired project types, technical challenges, and relevant experience

- Excluded or sensitive sectors and hard policy constraints

- Minimum plausible budget and preferred project size ranges

- Current availability, role capacity, and delivery window

- Geographic, contractual, partnership, and procurement constraints

- Effective date, owner, approval status, and change note

Availability is a time dependent input. The system shall not embed it as permanent prompt text or reuse a stale value without recording its effective period.

### Lead Strategy and Source Network

The product shall separate the user-facing definition of **what makes a worthwhile lead** from the technical definition of **where and how to monitor it**. Coverage Profiles and Query Packs are legacy internal storage/runtime terms and must not appear as user-managed concepts.

One active, versioned Lead Strategy is the normal YipYip-facing configuration surface. It uses criteria and signal areas rather than requiring specific links:

| **Coverage area** | **User-facing configuration** |
| --- | --- |
| **Signal areas** | Pitches and agency calls, newsletters and sector publications, grants and funding, policy plans and strategic roadmaps, digital hiring signals, market consultations and pre tenders, organization announcements, and regional business networks |
| **Targets** | Sectors, organization types, named target organizations when useful, geographies, languages, desired project types, technical themes, and social impact themes |
| **Search intent** | Positive keywords, negative terms, project clues, freshness or lookback window, and confidence or evidence preferences |
| **Operating envelope** | Weekday cadence, freshness window, result ceiling, per-run and daily cost ceilings, timezone, and monitor hour |

The user-facing Source Network shows Source Scout proposals, approved recurring monitors, reputation, health, automation history, and exceptions. The internal Source Registry contains the exact websites, feeds, APIs, newsletters, search endpoints, and adapter instances. Users approve proposed sources; they are never expected to assemble the registry manually.

| **Configuration area** | **Required behavior** |
| --- | --- |
| **Identity** | Unique source ID, display name, source family, owner, jurisdiction, and base domain or endpoint |
| **Access** | Adapter type, permitted access method, authentication reference, terms or policy note, robots policy where applicable, and personal data risk classification |
| **Discovery** | Query templates, keywords, language, geography, lookback window, schedule, rate limit, and result cap |
| **Processing** | Parser or extraction profile, expected fields, content retention policy, and duplicate window |
| **Operations** | Enabled state, priority, cost budget, timeout, retry policy, last success, health state, and alert owner |
| **Evaluation** | Expected signal types, known benchmark examples, precision notes, and coverage observations |

Initial source families may include newsletters, public pitch announcements, funding and grant announcements, strategic roadmaps, policy plans, company newsrooms, annual reports, job openings, regional business networks, market consultations, procurement calendars, pre tender notices, sector publications, and public databases.

#### Autonomous Source Bootstrap — Implemented Vertical Slice

**Implementation status as of 26 September 2026:** `20260924111240_autonomous_lead_workflow.sql` establishes the autonomous pipeline; `20260924124107_live_operator_controls.sql` adds authenticated operator processing and bounded recovery; `20260925015218_original_brief_alignment.sql` adds complete YipYip policy/capacity strategy fields, persisted qualification checks, guarded Lead creation, idempotent historical quarantine, and immutable outreach snapshots; `20260925034218_focused_multi_source_research.sql` adds the explicit Monitoring lifecycle plus the wider bounded pass contract for focused research; and `20260926163906_split_capability_and_capacity_exceptions.sql` separates technical-fit exceptions from internal delivery-capacity exceptions. The `/sources` route is the Source Network. Source Scout now receives a deterministic inventory of approved, pending, and rejected domains plus per-signal-area coverage before searching; it prioritizes uncovered/lowest-covered areas and independently rejects duplicate domains and concentrated proposal sets. Live automation remains feature-flagged off by default; hosted Cron activation remains a separately configured deployment step. A controlled provider campaign must still prove 2–3 genuinely relevant organizations before the original brief is considered validated.

**Current local validation state:** the full non-billable gate passes and the three previously approved local sources are restored. The active historical Strategy predates the capacity field and therefore correctly restores as `unknown`. The capped live campaign must not start until an owner/operator records factual current capacity and an effective-until date, because unknown or expired capacity cannot auto-qualify under this PRD.

The default onboarding experience offers Dutch agency-pitch criteria already selected. A user may adjust and save the strategy without identifying websites. Saving queues a bounded Source Scout that resolves strategy intent into candidate sources and draft registry configuration.

Adding a specific domain, feed, API, newsletter, or portal remains available only as an advanced source-operations action. It is not required from a normal business user.

For each proposed source, Source Scout returns the Lead Strategy and signal areas it serves, the primary coverage gap it fills, an explicit novelty rationale relative to the current network, candidate identity, source family, primary/secondary classification, jurisdiction, public endpoint, access method, expected signal types, example public results, observed update frequency, coverage rationale, reputation evidence, confidence, estimated operating cost, and terms, robots, privacy, retention, or ownership concerns.

Every proposal starts disabled. The system never enables a production adapter, stores credentials, bypasses access controls, or infers legal permission from public availability. An owner/operator approves each source once before it enters weekday monitoring. Rejected candidates and reasons remain attributable, and the Scout suppresses the same fingerprint until materially new evidence appears.

Source scouting is bounded by query, result, hosted-search-call, time, and cost limits. The current slice permits at most five proposals and six hosted web-search calls per Scout stage. Application code ranks uncovered and least-covered configured signal areas first, then rejects already-active domains, same-run domain duplicates, off-strategy gaps, more than two proposals for one gap, and more than two proposals from one normalized source family. The coverage policy, prior inventory, coverage counts, and rejection reasons are retained in the run snapshots. It may suggest an adapter type and configuration, but custom adapter implementation and a self-service adapter marketplace remain outside this feature. Lead Strategies and approved sources remain separately versioned so YipYip can change intent without losing source provenance or approval history.

#### Autonomous Agent Contract

- Specialized bounded agents perform Source Scout, source monitoring, First Assessment, Gap Analysis, focused Research, and Final Assessment; deterministic application orchestration owns state transitions, scoring, deduplication, limits, and routing.
- Source Scout uses a strict structural provider contract and a separate bounded application contract. Application code normalizes safe length/item excesses, validates proposals independently, rejects invalid siblings without discarding valid proposals, and records only sanitized issue paths/codes. It also applies deterministic domain novelty and coverage-diversity rules after the agent response; the agent cannot override them. A generated-but-wholly-invalid result is an explicit failure, not a valid zero-result run.
- Versioned internal Search Plan snapshots replace user-facing Query Packs. Every run records strategy, source, model, prompt, limits, queries, citations, usage, estimated cost, validation outcomes, and stop reason for reproducibility.
- External OpenAI calls occur outside database transactions. Short persistence steps use workspace-safe records and service-only worker RPCs.
- Full page bodies and chain-of-thought are not stored. Structured outputs, short excerpts, consulted URLs, usage, validation results, and non-sensitive errors are retained.
- Agent confidence is evidence metadata, not commercial fit. Application scoring uses the versioned policy; agents cannot qualify their own outputs or set source health.
- Reputation measures source trust/relevance. Health measures monitor execution reliability. A pure deterministic policy updates health and appends an immutable event after terminal monitor cycles; individual pages do not receive health.
- Authentication, policy, budget, ambiguous identity, conflicting evidence, unusual budgets, partner dependency, and repeated failures route to an exception rather than an unbounded retry loop.
- Identical provider-output contract failures receive at most one automatic retry. A second failure is terminal and retains its specific non-sensitive error code for operator diagnosis.
- Provider cost estimates use a versioned model-price registry, provider-reported cached-input usage, hosted-tool call counts, and an explicit USD-to-EUR planning conversion. An unreviewed model price is a configuration failure before execution, never a silent fallback to another model's rate.
- Owners/operators may process a workspace queue interactively before hosted Cron is enabled. Reviewers may request a new bounded qualification cycle for a material exception; this restarts assessment, gap analysis, conditional research, final assessment, and routing rather than treating a human click as the missing research itself.

### Source Scoped Discovery Jobs

- The system shall create a separate weekday job per approved source rather than relying on one unrestricted discovery run.

- Each job shall receive a bounded search space, a time window, a result limit, and a structured Signal output contract.

- Discovery shall not require budget, buyer contact, route, or addressable scope to be known before a concrete current software-project signal can enter assessment. These facts may remain explicitly unknown for bounded research.

- Jobs shall record query or feed position, source configuration version, model version, tool calls, cost, and outcome.

- A valid zero-candidate run shall remain successful, persist a concise zero-result reason, and expose searched URLs/calls plus generated, accepted, rejected, programme-only, and resolved-Opportunity counts to operators.

- One job failing shall not prevent other sources from completing.

- A job shall support incremental checkpoints so recurring runs do not repeatedly process the same content.

- Discovery shall favor recall, but a lightweight eligibility filter may discard clearly irrelevant content before entity resolution.

### Normalization and Deduplication

- Normalize organization names, domains, locations, dates, currencies, contacts, signal type, and maturity stage while preserving the raw source representation.

- Separate facts directly present in the source from extracted inferences. Inferred fields require an inference label and confidence.

- Use deterministic keys where possible, including canonical URL, source item ID, normalized domain, and content fingerprint. A canonical page URL is evidence provenance and may contain several independent source items; each normalized candidate therefore receives a stable logical source-item ID derived from the page, organization, and initiative identity.

- Use probabilistic matching only after deterministic checks. Candidate matches should consider organization, initiative name, geography, dates, scope, and linked sources.

- Never merge Opportunities solely because they belong to the same organization. One organization may have several distinct initiatives.

- Retain merge and split decisions, match features, confidence, and the responsible model or reviewer.

- Reruns shall update or link existing records instead of creating duplicate Leads.

### First Assessment

The First Assessment shall be a separate structured step. It evaluates the Opportunity using source facts available at that time and decides whether further attention is justified.

- Apply hard exclusions before weighted scoring.

- Produce one score, confidence value, and concise rationale for every configured dimension.

- Record the profile version, scoring configuration version, evidence snapshot, model version, and prompt version.

- Reject Opportunities below the configured first stage threshold and retain a machine readable and human readable reason.

- Allow a borderline band that routes an Opportunity to review or low cost research rather than rejecting it outright.

### Gap Analysis

Gap Analysis determines what the system still needs to know and whether learning it could change qualification, rank, route, or outreach. It shall identify missing, weak, stale, contradictory, or inferred data and produce prioritized research questions.

| **Gap attribute** | **Meaning** |
| --- | --- |
| **Field or decision** | The qualification field or decision affected |
| **Current status** | Missing, weak, inferred, conflicting, stale, or sufficient |
| **Decision impact** | Estimated likelihood that resolution would alter score, rejection, route, or next action |
| **Researchability** | Expected availability, likely source types, and cost to investigate |
| **Priority** | Order derived from decision impact and researchability |
| **Stop rule** | Condition that closes the question as answered or adequately unresolved |

### Optional Deep Research

Deep research shall run only when the Opportunity passes the first assessment and one or more material questions remain. An Opportunity with sufficient budget, scope, timing, contact, and evidence may proceed directly to final reassessment.

An inferred contact label alone is not sufficient for automatic qualification. Before final routing, application code—not Gap Analyst discretion—shall require a bounded question for an actionable contact route. A confirmed or strongly inferred answer must include citation-valid evidence, a concrete person/team/procurement/tender channel, and confidence of at least 0.65. If two bounded, diversified attempts remain unknown on an otherwise promising Opportunity, it enters Monitoring rather than becoming a qualified Lead or being mislabeled as poor fit.

- Generate research tasks from prioritized gaps rather than using one generic organization prompt. Keep commercial, buyer-access, capability, and timing questions in focused bundles of at most three questions.

- Prefer primary sources and record why secondary sources were used when primary evidence is unavailable.

- Preserve established findings across passes and instruct later passes to investigate only unresolved or conflicting questions.

- Resolve each requested question to confirmed, strongly inferred, contradicted, not found, or unknown.

- Treat unknown as a valid completed state when the configured attempt standard is met. A first semantic unknown is not terminal for a high-impact question; it receives one diversified pass using a different query angle or source family.

- Record consulted URLs separately from claim citations. Consulted URLs measure search breadth; only cited URLs support a persisted finding. Require corroboration for strongly inferred claims.

- Stop on completion, maximum passes, elapsed time, tool calls, monetary cost, source exhaustion, or repeated no progress.

#### Research Completion Control

The agent run may stop whenever the model emits a final output, so the application shall independently validate completion. A research pass is accepted only when every requested question has a valid terminal status, required provenance, a confidence value, and an explanation that meets the output contract. An incomplete result may trigger another pass within budget. Output validation must never force the system to claim a value that the evidence does not support.

### Final Reassessment and Reranking

- Recalculate every dimension from the current evidence snapshot instead of adding an opaque research bonus.

- Show score movement from the First Assessment and identify the evidence or profile change that caused it.

- Apply final threshold, confidence floor, hard rules, and human review routing.

- Rank by final score with explicit tie breakers such as signal freshness, confidence, commercial access, and delivery fit.

- Allow a promoted Opportunity to be classified as direct delivery, partner opportunity, nurture, or monitor rather than forcing all qualified items into one route.

### Lead Delivery

Lead delivery shall favor a small, ranked set of complete records. The destination is configurable and may begin as an internal review interface or export before later CRM integration.

- Organization overview and relevant context

- Opportunity title, description, likely technical scope, and maturity stage

- The early signal and an evidence based explanation of why it matters now

- Expected timeline and timing confidence

- Budget evidence, estimate, capacity proxy, or explicit unknown

- YipYip fit by scoring dimension, including delivery route and partner need

- Risks, unresolved questions, and conflicting evidence

- Suggested contact and next action, clearly labeled when inferred

- Complete source list, final score, confidence, and scoring explanation

## Scoring and Qualification

### Scoring Dimensions

| **Dimension** | **Question answered** | **Important qualification** |
| --- | --- | --- |
| Social impact fit | Does the work align with YipYip values, preferred sectors, and intended outcomes? | Excluded sectors remain hard rules rather than negative weights. |
| Technical fit | Does the likely scope match YipYip capabilities and desired technical challenge? | Complexity should be assessed against relevant experience, not novelty alone. |
| Budget fit | Is there enough plausible budget, and is the size commercially suitable? | Reward the preferred range. Very large budgets may reduce direct fit. |
| Timing fit | Is the signal fresh and is there a realistic window to engage? | Separate publication freshness from expected project start. |
| Availability fit | Can YipYip staff the likely work in the relevant period? | Use the profile effective for the assessment date. |
| Delivery fit | Can YipYip deliver independently, with a partner, or not realistically? | Represent too small, suitable, partner required, and too large states. |
| Commercial access | Is there a plausible route to a useful conversation before supplier choice is fixed? | Use relationship and access evidence, not a fabricated win probability. |
| Evidence confidence | How reliable, recent, and corroborated is the qualification evidence? | Confidence may gate delivery but should not silently duplicate fit dimensions. |

### Score Policy

The score shall use a configurable common scale, initially 0 to 100 overall with dimension scores normalized to 0 to 10. The default formula is a weighted sum after hard rules. Weights, minimum dimension scores, overall thresholds, confidence floors, and review bands shall be stored as versioned configuration.

| **Policy element** | **Behavior** |
| --- | --- |
| **Hard exclusion** | Reject regardless of weighted score and record the triggering rule |
| **Preferred range** | Support non linear curves, especially for budget and project size |
| **First threshold** | Controls whether an Opportunity proceeds to Gap Analysis |
| **Research threshold** | Controls whether expected information value justifies research cost |
| **Final threshold** | Controls qualification after all accepted evidence is considered |
| **Review band** | Routes borderline or high consequence cases to a person |
| **Confidence floor** | Prevents a high score with weak evidence from being delivered automatically |
| **Tie breakers** | Apply freshness, confidence, access, and delivery route in a documented order |

Initial weights and thresholds are hypotheses. They must be tuned with YipYip feedback and a labeled evaluation set, not treated as permanent business truth.

The active MVP policy is `2026-09-25.2`: Social impact 12%, Technical fit 16%, Budget fit 16%, Timing fit 13%, Availability 10%, Delivery fit 16%, Commercial access 10%, and Evidence confidence 7%. The first-stage threshold remains 58, the final threshold 72, the review band 66–76, and the overall confidence floor 0.62. In addition, either Social impact or Technical fit must reach 6/10 with confidence of at least 0.65. A high-confidence failure on both axes rejects; promising unresolved evidence is researched and, when public facts remain unavailable after the attempt standard, enters Monitoring. Version `2026-09-25.1` remains immutable on historical Assessments.

Budget fit and Delivery fit are final qualification gates: both require at least 6/10 and confidence of at least 0.65. A confirmed YipYip-addressable value below €30,000 is rejected; €30,000–€50,000 is acceptable but below preference; €50,000–€100,000 receives maximum budget fit; larger supported work declines gradually rather than being automatically rejected. A total procurement value is never treated as YipYip-addressable value without cited scope evidence. Above €250,000, or when a large programme has no bounded YipYip scope, the result enters Needs attention unless delivery is explicitly supported. An evidence-backed capacity or funding proxy may pass the budget gate; an unsupported public-budget unknown triggers focused research and, if still unavailable for an otherwise promising case, Monitoring.

Delivery capacity is deterministic and effective-dated: available is 10/10, limited 6/10, unavailable 2/10 and cannot qualify automatically, while unknown or expired is 5/10 with zero confidence and routes to Needs attention after the bounded workflow. It answers whether YipYip has staffing room, not whether YipYip has the technical skills. Technical capability fit is independently supported, partial, unsupported, or unknown and retains matched services, unresolved requirements, confidence, rationale, and citation-valid evidence references. Capacity-only exceptions use `delivery_capacity_uncertain`; project-skill ambiguity uses `capability_fit_uncertain`. Gambling, video games, retail/e-commerce, and heavy-polluting industry are hard exclusions. Pharma and unresolved ethical concerns are sensitive-sector exceptions rather than automatic rejection. Explicit expired deadlines reject unless a separately cited current follow-on exists.

## Provenance and Trust

### Provenance Model

Every externally sourced factual claim shall be traceable to its origin, but the database shall not create redundant evidence rows for each structured field copied from the same Signal. A Signal stores the raw source item, source metadata, capture time, content fingerprint, and relevant excerpt or evidence summary. Fields extracted directly from that Signal reference the Signal as their provenance.

A ResearchFinding is required when focused research adds, infers, contradicts, or closes information beyond the originating Signal. The finding stores its own source references, status, explanation, confidence, and research question. Assessments cite the Signal facts and ResearchFindings that materially support each dimension rationale.

### Claim Statuses

| **Status** | **Use** |
| --- | --- |
| **Confirmed** | Directly supported by a reliable source |
| **Strongly inferred** | Supported by relevant indirect evidence with an explicit inference path |
| **Contradicted** | Credible sources conflict with or disprove the current claim |
| **Not found** | The search produced no relevant evidence within the attempted source set |
| **Unknown** | Reasonable research was completed but the value cannot be established |

### Source Requirements

- Store canonical URL or stable source identifier, title, publisher, publication date when available, access time, and source type.

- Preserve enough supporting text or a faithful evidence summary to understand the claim, subject to retention and copyright constraints.

- Record source accessibility and whether the evidence was primary, secondary, or user supplied.

- Detect link failure and content change without silently rewriting historical evidence.

- Display inferences and human edits distinctly from source facts.

## Data Schemas

The following logical schemas define the MVP contract. Exact storage types may change during technical design, but entity boundaries and provenance behavior should remain stable.

### Signal Schema

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| id | UUID | Yes | Stable internal identifier |
| sourceId | UUID | Yes | Registry entry used for discovery |
| sourceItemId | String | When available | Publisher or feed identifier for idempotency |
| canonicalUrl | URL | Yes | Normalized public location or stable source reference |
| title and rawText | String | Yes | Captured source title and relevant content |
| publisher and publishedAt | String and datetime | When available | Original publication identity and date |
| capturedAt | Datetime | Yes | Time of ingestion |
| signalType | Enum | Yes | Funding, hiring, pitch, strategy, project, consultation, or another configured type |
| organizationMentions | Array | Yes | Raw and normalized organization candidates |
| extractedFacts | Object | Yes | Structured fields directly supported by this Signal |
| extractedInferences | Object | No | Labeled inferences with confidence |
| contentFingerprint | String | Yes | Duplicate and change detection value |
| processingMetadata | Object | Yes | Job, parser, model, prompt, and error details |

### Opportunity Schema

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| id | UUID | Yes | Canonical opportunity identifier |
| organizationId | UUID | Yes | Owning or commissioning organization |
| title and description | String | Yes | Normalized description of the underlying initiative |
| maturityStage | Enum | Yes | Early signal, exploring, funded, planning, selecting, formalized, or closed |
| signalIds | Array UUID | Yes | All supporting Signals |
| technicalScope | Object | No | Likely product, platform, service, integration, and complexity clues |
| budget | Qualified value | No | Amount, range, currency, status, and provenance |
| timeline | Qualified value | No | Milestones, expected start, freshness, and provenance |
| contactIds | Array UUID | No | Known relevant people and roles |
| missingFields | Array | Yes | Current decision relevant gaps |
| lifecycleStatus | Enum | Yes | Workflow state |
| resolutionMetadata | Object | Yes | Merge, split, and match decisions |

### Assessment Schema

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| id and opportunityId | UUID | Yes | Assessment and subject identifiers |
| assessmentType | Enum | Yes | Initial, final, or human adjusted |
| profileVersion | String | Yes | YipYip profile used |
| scoreConfigVersion | String | Yes | Weights, curves, thresholds, and hard rules used |
| dimensionResults | Array | Yes | Score, confidence, rationale, and supporting claim references per dimension |
| overallScore | Number | Yes | Calculated overall score |
| overallConfidence | Number | Yes | Confidence in assessment given evidence quality |
| decision | Enum | Yes | Reject, research, review, qualify, nurture, or monitor |
| deliveryRoute | Enum | No | Direct, partner, consortium, or unsuitable |
| rejectionReason | Code and text | When rejected | Auditable reason |
| evidenceSnapshot | Array | Yes | Signals and findings considered |
| executionMetadata | Object | Yes | Model, prompt, time, cost, and validation state |
| commercialFit | Object | Yes | Evidence status, total project value, YipYip-addressable value, scope boundary, confidence, evidence references, and explanation captured for this Assessment |
| qualificationChecks | Object | Yes | Immutable policy version, ordered gate results, hard rejection, reasons, and `allPassed`; service-only Lead creation requires `allPassed = true` |

### ResearchFinding Schema

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| id and opportunityId | UUID | Yes | Finding and subject identifiers |
| questionId | UUID | Yes | Gap Analysis question answered |
| field | String | Yes | Qualification field affected |
| status | Enum | Yes | Confirmed, strongly inferred, contradicted, not found, or unknown |
| value | Typed nullable | Yes | Answer value or null for unknown |
| explanation | String | Yes | Evidence based reasoning and unresolved limits |
| confidence | Number | Yes | Confidence in status and value |
| sourceRefs | Array | Required except justified unknown | Sources consulted or supporting evidence |
| attemptSummary | Object | Yes | Queries, source families, passes, and stop reason |
| createdAt | Datetime | Yes | Finding time |

### Lead Schema

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| id and opportunityId | UUID | Yes | Lead and canonical opportunity identifiers |
| finalAssessmentId | UUID | Yes | Final Assessment referenced by the Lead; it qualified an automated Lead or records the unchanged evidence state for a manual promotion |
| whyNow | String | Yes | Evidence based timing explanation |
| suggestedNextAction | String | Yes | Recommended action with inference label where needed |
| primaryContactId | UUID | No | Best known contact |
| route | Enum | Yes | Direct, partner, nurture, or monitor |
| status | Enum | Yes | Draft, in review, approved, delivered, accepted, rejected, or archived |
| reviewRecord | Object | When reviewed | Reviewer, decision, edits, and time |
| deliveryMetadata | Object | When delivered | Destination, time, version, and idempotency key |
| outreachDraft | Object | For new qualified versions | Immutable language, channel, ≤120-word email, ≤60-word call opening, up to three questions, evidence references, and caveats; never implies sending |
| origin | Enum | Yes | `automated` or `manual_promotion`; manual origin must never be displayed as automatic qualification |
| promotion attribution | Object | For manual promotion | Reviewer, time, stable reason, optional note, unchanged automated status/decision, unresolved checks, and primary evidence reference |

### Lead Strategy and Source Network Data Contract — Implemented

| **Field group** | **Key fields** |
| --- | --- |
| **Identity** | id, workspaceId, profileKey, name, description, status, isDefault, version, effectiveAt, createdBy, changedBy, changeNote |
| **Signal areas** | pitches, newsletters, funding, strategy, hiring, consultations, announcements, regional networks, and future configured families |
| **Targets** | sectors, organizationTypes, organizationTargets, regions, languages, projectTypes, technicalThemes, impactThemes |
| **Policy** | hardExcludedSectors, sensitiveSectors, and search exclusions kept as distinct concepts |
| **Search intent** | keywords, negativeTerms, projectClues, lookback, evidencePreferences |
| **Operating envelope** | weekday cadence, lookback, resultLimit, runCostLimit, dailyCostLimit, timezone, monitorHour, automationEnabled, nextScoutAt, €30k minimum, €50k–€100k preferred range, €250k large-project review threshold, and effective-dated capacity status/note |
| **Internal search plan** | immutable strategy/source/model/prompt versions, normalized search criteria, limits, and generated time; never user-managed |
| **Source candidates** | strategyId, origin, candidate identity, source family, classification, jurisdiction, baseUrl, public access, update frequency, proposedConfig, sampleEvidence, rationale, reputation, confidence, estimated cost, policy checks, suppression fingerprint, review decision, and optional resolvedSourceId |
| **Approved mappings** | profileId, sourceId, optional sourceCandidateId, signalAreas, linkRationale, linkedBy, createdAt |

Strategy and Source Network data is workspace-scoped and protected by RLS. Workspace members may read it. Only owners/operators may version strategies, approve sources, pause automation, or retry failed workflows. Reviewers may inspect Leads and resolve qualification exceptions. Candidate approval requires an attributable owner/operator decision and immediately creates an enabled recurring monitor.

### Automation Runtime Data Contract — Implemented Vertical Slice

| **Entity** | **Purpose and key fields** |
| --- | --- |
| **SearchPlanSnapshot** | Immutable Lead Strategy, approved source, model, prompt, criteria, limits, and scheduled-time snapshot |
| **WorkflowRun** | Workspace, kind, idempotency key, trigger, current stage, status, strategy/source/Opportunity, costs, stop reason, and timestamps |
| **WorkflowStageRun** | Stage, status, attempt, availability, lease token/owner/expiry, input/output snapshot, usage, cost, errors, and next action |
| **AutomationException** | Ambiguous entity, low confidence, borderline score, sensitive sector, unusual budget, partner dependency, conflicting evidence, unresolved commercial/technical-capability/delivery-capacity/actionability/contact evidence, invalid outreach, qualification-policy mismatch, policy/cost failure, or repeated failure requiring a person |
| **SourceHealthEvent** | Immutable previous/current monitor health, policy version, reason, telemetry metrics, optional workflow, actor, and evaluation time |

Runtime tables are workspace-scoped, protected by explicit grants and RLS, and use one active leased stage per workflow. Same-workspace composite references protect strategies, sources, Signals, Organizations, Opportunities, Assessments, Research Questions/Findings, and Leads. Repeated unchanged results create no duplicate Signal, Opportunity, Assessment, or Lead.

### Internal Source Registry Schema

This is an operations and system contract for exact sources. It is not the normal business-user onboarding model.

| **Field group** | **Key fields** |
| --- | --- |
| **Identity** | id, name, sourceFamily, owner, jurisdiction, baseUrl |
| **Access** | adapterType, permittedMethod, authRef, termsNote, privacyClass, retentionPolicy |
| **Schedule** | enabled, weekday cadence, lookback, checkpoint, timezone, nextRunAt, lastRunAt |
| **Search** | queryTemplates, languages, regions, keywords, negativeTerms, resultCap |
| **Controls** | rateLimit, timeout, retryPolicy, costLimit, contentLimit |
| **Reputation and health** | reputation evidence for trust/relevance; lastAttempt, lastSuccess, health, errorRate, and alertOwner for execution reliability |
| **Versioning** | version, effectiveAt, changedBy, changeNote |

## System Requirements

### Functional Requirements Summary

| **ID** | **Requirement** | **Priority** |
| --- | --- | --- |
| FR 01 | Create independent scheduled Discovery Jobs from enabled Source Registry entries | Must |
| FR 02 | Store raw and normalized Signal data with stable provenance | Must |
| FR 03 | Resolve Organizations and Opportunities with reversible merge and split history | Must |
| FR 04 | Run versioned initial and final Assessments with configurable policy | Must |
| FR 05 | Generate prioritized, candidate specific gap questions | Must |
| FR 06 | Skip deep research when current evidence is sufficient | Must |
| FR 07 | Validate research completion outside the agent run and allow bounded continuation | Must |
| FR 08 | Represent unknown and not found as valid structured results | Must |
| FR 09 | Create and deliver Lead records without duplicating Opportunity truth | Must |
| FR 10 | Support configured human review routing and reviewer decisions | Must |
| FR 11 | Capture business feedback and later outcomes for evaluation | Should |
| FR 12 | Support source, profile, prompt, model, and score policy version history | Must |
| FR 13 | Let users edit one Lead Strategy and automatically receive governed Source Scout proposals without supplying links | Must · implemented vertical slice |
| FR 14 | Require one-time owner/operator source approval, then create independent weekday monitors automatically | Must · implemented vertical slice |
| FR 15 | Orchestrate bounded source monitoring, normalization, exact resolution, first assessment, material-gap research, final assessment, and automatic routing as durable stages | Must · implemented vertical slice |
| FR 16 | Show qualified Leads by default and route only genuine ambiguity/risk to Needs attention | Must · implemented vertical slice |
| FR 17 | Inject and research an evidence-backed actionable contact route before automatic qualification; route bounded unavailable public evidence to Monitoring | Must · implemented vertical slice |
| FR 18 | Provide a dedicated pursuit workspace for saved, research-pending, pursued, and passed Leads | Must · implemented vertical slice |
| FR 19 | Require a final `qualify` decision and persisted passing qualification checks before service-only Lead creation; quarantine historical mismatches without rewriting history | Must · implemented vertical slice |
| FR 20 | Generate an immutable, evidence-referenced email and cold-call draft for each newly qualified Lead version without sending it | Must · implemented vertical slice |
| FR 21 | Allow owners/reviewers to manually promote an eligible completed Opportunity into the pursuit pipeline while preserving and visibly distinguishing the unchanged automated decision | Must · implemented vertical slice |

### Nonfunctional Requirements

| **Area** | **Requirement** |
| --- | --- |
| **Reliability** | Every job is idempotent, retryable, and recoverable from a recorded checkpoint. Partial source failure does not invalidate completed jobs. |
| **Auditability** | A reviewer can reconstruct why a Signal was linked, why an Opportunity was scored, and why a Lead was delivered. |
| **Security** | Secrets remain in a managed secret store. Access follows least privilege. Sensitive data access is logged. |
| **Privacy** | Collect only data needed for qualification, record purpose and source, apply retention rules, and support deletion or correction workflows. |
| **Compliance** | Source adapters enforce approved access methods and retain terms, licensing, robots, and policy notes. |
| **Performance** | Discovery runs within configured source windows. The product surfaces partial progress instead of waiting for every source. |
| **Cost control** | Each stage enforces per run and aggregate budgets for model, search, storage, and external services. |
| **Scalability** | Jobs are independently queueable and safe to parallelize by source and Opportunity within configured rate limits. |
| **Explainability** | Scores, rejections, inferences, unknowns, and human overrides remain visible and attributable. |
| **Accessibility** | The review interface supports keyboard navigation, a comfortable 16px+ reading scale, readable light/dark contrast, meaningful labels, and non-color status indicators. |
| **Localization** | The application shell and product controls are available in English and Dutch. Dates, currency, language, organization names, and source evidence preserve source meaning while supporting normalized comparison. |
| **Appearance preferences** | Users can switch between light and dark themes without losing workflow state. Theme and interface-language preferences persist in first-party cookies and apply before page rendering to avoid a mismatched first paint. |

## Architecture and Processing Controls

### Logical Components

| **Component** | **Responsibility** |
| --- | --- |
| **Configuration service** | Stores versioned Lead Strategies, the internal Source Registry, YipYip profiles, scoring policies, prompts, limits, and feature flags |
| **Source Scout** | Converts Lead Strategy criteria into bounded, evidence-backed source proposals; never enables a source |
| **Cron dispatcher and durable stages** | Claims due timezone-aware jobs, creates source/workflow stages, leases one stage per invocation, and supports bounded retries/checkpoints |
| **Source adapters** | Search, fetch, or ingest permitted content and emit Raw Signals |
| **Normalization service** | Extracts structured data, classifies signals, normalizes values, and flags uncertainty |
| **Entity resolution service** | Links organizations and opportunities and retains merge or split history |
| **Assessment service** | Applies hard rules, dimension scoring, confidence, thresholds, and routing |
| **Research orchestrator** | Creates gap tasks, invokes the research agent, validates completion, and manages bounded continuation |
| **Evidence store** | Maintains source artifacts, claim links, findings, and immutable execution metadata |
| **Router and lead service** | Reranks final assessments, automatically creates review-ready Leads, and sends true exceptions to Needs attention |
| **Review application** | Supports source inspection, correction, override, approval, rejection, and feedback |
| **Telemetry and evaluation** | Captures traces, metrics, costs, labels, and regression test results |

### Two Level Research Loop

1. The research agent performs its internal sequence of searches, inspections, and tool calls within a configured turn ceiling.

2. The agent returns a structured result for the requested questions.

3. The application validator checks terminal status, provenance, confidence, explanation, and coverage of every requested question.

4. If valid, supported answers close their questions. A first-pass semantic unknown or not-found answer remains open for one diversified continuation; its attempt is still preserved.

5. If incomplete and budget remains, the orchestrator continues only unresolved questions in one focused evidence bundle using prior findings and explicit source-family guidance.

6. If a stop limit is reached, the orchestrator closes remaining questions as incomplete or unknown according to policy and routes the Opportunity appropriately.

### Idempotency and Versioning

- Use source ID plus logical source item ID and revision for item history, with source ID plus canonical URL and content fingerprint for unchanged-run idempotency. Allocate revisions atomically so several candidates from one roundup page and concurrent retries cannot collide.

- Use Opportunity identity and final Assessment version as part of the Lead idempotency key.

- Never overwrite the policy, profile, prompt, or evidence snapshot referenced by a completed Assessment.

- A material source change creates a new Signal revision or change event and may trigger reassessment.

- Human corrections remain attributable and survive automated reruns unless explicitly superseded.

## Human Review

### Required Review Points

| **Review point** | **Default trigger** | **Reviewer action** |
| --- | --- | --- |
| Source approval | Source Scout proposal, new adapter, or material access method change | Source operations—not the business user—approve or reject exact sources, access, retention, ownership, schedules, and operational limits before enablement |
| Entity resolution | Ambiguous merge, high value Opportunity, or conflicting organization identity | Confirm, merge, split, or defer |
| Qualification exception | Borderline score, low confidence, exceptional budget, partner required, or sensitive sector | Request research, pass on the Opportunity, or create a manual Lead with visible unresolved gates |
| Lead pursuit decision | MVP default for every new Lead | Start pursuing, pass on the Lead, research a gap, or change route after inspecting summary, evidence, risks, contact, and next action |
| Policy change | New score weights, thresholds, hard rules, or YipYip profile version | Review impact on benchmark cases before activation |

### Reviewer Experience

- Show raw Signal context beside normalized fields and every supporting source link.

- Show what changed between initial and final Assessment and why.

- Allow reviewers to correct facts, split or merge Opportunities, change route, and record a reason.

- Never hide unknowns or unresolved conflicts behind a summary score.

- Capture reviewer decision time and free text feedback without requiring unnecessary fields.

- Use different user-facing surfaces for qualification exceptions and finished Leads. **Resolve** applies to a non-Lead Opportunity; **Decision** applies to a Lead. Never use the generic word “review” as the only CTA for either job.

- Persist Start pursuing, Pass on Lead, Research a gap, and route changes against an exact Lead version. Pass, research, and route changes require stable reason codes; Other additionally requires a note. Owners/reviewers decide pursuit and route, owners/operators/reviewers may request research, and viewers remain read-only.

- Persist Opportunity-level Request research and Pass actions atomically with the open exception, lifecycle transition, immutable event, and optional qualification workflow. Operators may request research; only owners/reviewers may pass.

- Permit owners/reviewers to create an eligible manual Lead with a stable reason and idempotency key. Preserve the automated lifecycle and Assessment, show unresolved gates and a human-override label, block hard-excluded/expired cases, retain immutable promotion attribution, and require a separate pursuit Decision.

## Observability and Evaluation

### Operational Observability

| **Layer** | **Minimum telemetry** |
| --- | --- |
| **Discovery job** | Run ID, source version, query or checkpoint, start and end, status, results, errors, retries, tool calls, and cost |
| **Signal processing** | Extraction outcome, schema validation, duplicate decision, entity match, and processing latency |
| **Assessment** | Profile and policy versions, dimension outputs, hard rules, threshold decision, evidence references, and cost |
| **Research** | Question set, pass count, searches, sources consulted, no progress signal, stop reason, validation errors, and cost |
| **Delivery** | Review decision, export destination, idempotency key, delivery result, and user feedback |

### Quality Evaluation

| **Measure** | **Definition** |
| --- | --- |
| **Signal precision** | Share of discovered Signals judged relevant enough to attach to an Opportunity |
| **Source recall** | Share of known relevant benchmark Signals captured by the configured source jobs |
| **Opportunity resolution accuracy** | Correct merges and separations in a labeled organization and initiative set |
| **Qualification precision** | Share of qualified Opportunities that YipYip judges relevant or actionable |
| **High value miss rate** | Relevant benchmark Opportunities rejected or never discovered |
| **Evidence validity** | Claims whose cited source actually supports the displayed fact or inference |
| **Research completion validity** | Question sets correctly closed as answered or adequately unresolved |
| **Calibration** | Relationship between stated confidence and reviewer agreement |
| **Freshness** | Delay from source publication to captured Signal and delivered Lead |
| **Cost efficiency** | Cost per useful Signal, assessed Opportunity, and accepted Lead |

### Evaluation Process

- Create a benchmark set containing useful, irrelevant, duplicate, ambiguous, rejected, direct fit, partner fit, and unknown cases.

- Run regression evaluation before activating material changes to prompts, models, extraction rules, source configurations, or scoring policy.

- Sample accepted and rejected records for manual review. Rejections matter because silent false negatives undermine the product goal.

- Track YipYip feedback using stable reason codes and optional notes. Separate poor discovery, wrong facts, wrong fit, stale timing, and weak actionability.

- Review source level yield and cost monthly. Add a custom adapter only when measured coverage or quality justifies it.

## Risks and Mitigations

| **Risk** | **Impact** | **Mitigation** |
| --- | --- | --- |
| Source terms or access restrictions | Loss of a source, account action, or legal exposure | Approve access methods in the registry, avoid bypassing controls, and maintain alternative sources |
| Privacy overcollection | Unnecessary personal data and compliance burden | Collect role relevant public data only, record purpose, minimize retention, and support correction or deletion |
| Model fabrication | False budget, contact, project, or rationale | Structured outputs, provenance checks, unknown status, application validation, and human review |
| Premature research completion | Material gaps remain hidden | Two level loop, required terminal states, no progress detection, and bounded continuation |
| Infinite or expensive research | Cost overruns and delayed output | Per Opportunity pass, time, tool, and cost limits with value of information prioritization |
| False entity merge | Evidence from separate initiatives is combined | Conservative matching, reversible history, confidence thresholds, and review for ambiguous cases |
| Duplicate output | Users receive the same lead repeatedly | Stable keys, canonical Opportunity, Lead versioning, and idempotent delivery |
| Score overconfidence | A neat number hides weak evidence or policy assumptions | Dimension rationale, separate confidence, visible policy version, and benchmark calibration |
| Availability drift | A good opportunity is scored with stale capacity data | Effective dated profiles, expiry warnings, and reassessment on material profile change |
| Large budget bias | Oversized projects outrank realistic work | Non linear budget fit and separate delivery route including partner required and too large |
| Source concentration | Discovery reflects the easiest indexed channels | Independent source jobs, source level coverage metrics, and diversity targets |
| Low user trust | Leads are ignored even when relevant | Concise delivery, source links, visible uncertainty, reviewer corrections, and feedback loops |

## MVP Scope

### Included

- A versioned YipYip profile with manually maintained availability and delivery constraints

- A Source Registry and three to five approved source families with independent schedules

- Source scoped search or feed jobs with checkpoints and structured Signal output

- Signal normalization, deterministic duplicate checks, and reviewer assisted Opportunity resolution

- Initial Assessment across the seven requested fit dimensions plus evidence confidence

- Configurable hard rules, weights, thresholds, confidence floor, and review band

- Gap Analysis and optional research for budget, scope, timing, organizational capacity, contact, and commercial access

- Two level research completion control with unknown as a valid result

- Final reassessment, ranking, a qualification-exception queue, and a separate finished-Lead decision workspace

- Deterministic qualification checks requiring a final `qualify` decision, current actionability, YipYip fit, addressable commercial evidence, contact route, current capacity, and valid outreach evidence

- Immutable, evidence-grounded first-email and cold-call drafts on each new qualified Lead version; copy only, never send

- Editable Lead records with source links and export to one agreed destination

- Run logs, stage costs, reviewer feedback, and a small labeled evaluation set

### Excluded from MVP

- Unauthorized LinkedIn scraping or dependence on any restricted public post search capability

- Automatic outreach, email sequencing, or CRM workflow automation

- A full self service source adapter marketplace

- Hosted Cron activation, live production-source monitoring, and billable OpenAI execution until separately authorized and configured

- Probabilistic entity resolution; ambiguous identities remain explicit human exceptions

- Automatic source approval; Source Scout proposals always require a one-time owner/operator decision

- Continuous training or online weight optimization from sparse feedback

- Multilingual expansion beyond the languages required for the first Dutch source set

- Predictive revenue, true win probability, or automatic proposal generation

- A secondary tender coverage product for tender heavy companies

### Suggested MVP Source Mix

The first source set should test distinct signal mechanisms rather than several nearly identical publications. A practical mix is one agency or pitch publication, one regional business network, one funding or innovation source, one company or policy announcement search pack, and one hiring signal source. Final choices remain subject to access, coverage, and legal review.

## Phased Roadmap

| **Phase** | **Product outcome** | **Key deliverables** | **Exit evidence** |
| --- | --- | --- | --- |
| Phase One Autonomous Foundation | The product can execute the intended workflow behind safe flags | Lead Strategy, Source Scout, approval, weekday scheduling contract, durable stages, exact resolution, automated assessment/research/routing, and browser-local demo | Mocked and database acceptance tests prove an approved source can produce a qualified Lead without routine user clicks |
| Phase Two Calibration | The team establishes whether qualification quality is useful | Labeled evaluation set, live operator smoke tests, source precision measurement, score/research calibration, and cost validation | YipYip agrees that qualified Leads are materially better than an unranked feed at acceptable cost |
| Phase Three Production Operations | Approved sources run reliably in the hosted environment | Vault secrets, Cron activation, monitored worker, source-specific adapters, alerts, privacy/retention review, and runbooks | Approved sources run repeatedly without duplicate growth, silent failures, or budget surprises |
| Phase Four Review and Delivery | Finished Leads enter the commercial workflow | Persistent reviewer decisions and bounded research requests are implemented; field correction, export, notifications, CRM delivery, and outcome tracking remain future | Users act on delivered Leads and provide structured feedback |
| Phase Five Optimization | Coverage and efficiency improve from evidence | Source drift rescans, source expansion, probabilistic-resolution assistance, custom adapters, calibration, policy tuning, and selective integrations | Measured coverage and lead value improve without bypassing source approval or evidence controls |

## Open Decisions

| **Decision** | **Why it matters** | **Recommended owner** |
| --- | --- | --- |
| First source set and access methods | Determines coverage, legality, operating cost, and implementation effort | Product with legal and engineering |
| Default signal areas, coverage criteria, and Source Scout policy | Determines the recommended YipYip profile, how intent maps to curated packs, what evidence a suggested exact source needs, and how rejected candidates are suppressed | Product with business development, source operations, legal, and engineering |
| Required Lead fields | Defines when information is sufficient and when research can stop | Business development with product |
| Scoring weights and thresholds | Controls rejection, research spend, and review volume | YipYip with product |
| Availability update process | Prevents stale capacity from distorting qualification | YipYip delivery lead |
| Budget and project size curves | Prevents minimum budget logic from favoring work that is too large | YipYip commercial and delivery leads |
| Human review policy | Balances risk, speed, and reviewer workload | Product owner |
| Research budgets and stop limits | Sets cost and completion behavior | Product with engineering |
| Lead destination | Determines MVP interface and integration scope | Business development |
| Personal data retention | Affects compliance and contact usefulness | Privacy owner |
| Outcome feedback taxonomy | Determines whether relevance and revenue learning are measurable | Product owner |
| Partner opportunity handling | Defines whether partner required work is promoted, routed, or monitored | YipYip leadership |
| Tender heavy secondary market | May be a separate product hypothesis with different sources and goals | Strategy lead |

## Acceptance Criteria

### Discovery and Sources

- An authorized user can add, disable, reschedule, and version a source without changing the central workflow code.

- Each enabled MVP source produces an independent run record with checkpoint, status, cost, and errors.

- Repeated ingestion of the same unchanged source item does not create a second Signal.

- A failed source job can retry or resume without reprocessing completed work from other sources.

### Autonomous Lead Engine

- An owner/operator can edit and save one active Lead Strategy. Saving or materially changing it automatically queues a bounded Source Scout workflow.
- The strategy versions YipYip-specific software capabilities, hard-excluded sectors, sensitive sectors, search exclusions, commercial thresholds, and effective-dated delivery capacity. Every Search Plan and Assessment records that version.
- Source Scout proposals include classification, access method, samples, freshness, reputation evidence, policy concerns, coverage rationale, coverage gap, novelty rationale, confidence, and estimated cost. The Scout sees the bounded current-network inventory, prioritizes missing coverage, and proposals still pass deterministic domain and concentration checks. Each source requires one explicit approval; unchanged rejected proposals remain suppressed.
- Approving a source immediately creates an enabled recurring monitor. A frequent dispatcher schedules weekday work at 07:00 in the configured timezone and never creates duplicate cycles for the same scheduled time.
- The protected worker accepts only the server automation secret/service credential, processes one leased stage per invocation, reclaims expired leases, retries transient failure with bounded backoff, and routes terminal policy/budget/repeated failures to exceptions.
- Uncited, non-HTTPS, stale, restricted, low-confidence, or deterministic duplicate candidates cannot create a Signal or Opportunity.
- An approved source can produce a Signal, exact Organization/Opportunity match, initial Assessment, prioritized gaps, bounded findings, final Assessment, and review-ready qualified Lead without an Assess button.
- A Gap Analyst omission cannot skip contact research: application policy injects the actionable-contact-route question, citation-valid findings appear in the Lead, and an otherwise promising case with two bounded unknown attempts routes to Monitoring.
- Evidence-backed poor fits reject, evidence-sufficient candidates skip research, first-pass semantic unknowns receive one diversified continuation, and borderline/ambiguous/partner-dependent candidates enter Needs attention. A promising Opportunity is not denied research solely because missing evidence depressed its provisional weighted score; unavailable public evidence after bounded research enters Monitoring.
- A programme-level funding call without an identified commissioning buyer or concrete applicant persists as a Signal only and cannot create an Organization, Opportunity, Assessment, or Lead.
- A final `research` or `review` decision cannot fall through to qualified. Service-only Lead creation independently verifies `decision = qualify`, no hard rejection, `qualificationChecks.allPassed = true`, and a valid outreach snapshot.
- Repeating unchanged source results creates no duplicate Signal, Opportunity, Assessment, or Lead.
- Every terminal source-monitor cycle updates deterministic health and appends one immutable policy-versioned health event. Reputation remains separate from health; individual cited pages receive neither job health nor synthetic trust scores.
- Automated tests mock every agent boundary. Hosted Cron activation and a live OpenAI smoke test remain explicit operator-only actions requiring separate authorization and configured secrets.

### Interactive MVP Demo

- The demo Source Network uses the same persistent information architecture as the live slice: automation summary, worker status, full Lead Strategy fields, weekday control, approval inbox, approved monitors, activity, and exceptions. It must not teach a separate wizard or omit settings that materially affect live qualification.
- A visitor starts with zero sources, runs, Opportunities, or Leads; edits the prefilled Lead Strategy; and watches Source Scout begin automatically.
- The visitor approves sources individually. The demo then advances through monitoring, normalization, resolution, first assessment, gap analysis, focused research, final assessment, and routing without further clicks.
- Finished results include qualified Leads and a genuine Needs-attention exception with complete score/evidence snapshots; the gallery defaults to qualified Leads.
- Qualified demo Leads include visibly simulated email and call drafts, while historical/no-draft versions show an explicit unavailable state.
- Saving an Opportunity and choosing **Open pursuit workspace** opens `/reviewed`; Start pursuing moves a Lead to Working on, research requests remain visible as running, and Pass retains it in history.
- Demo state remains isolated to the browser tab and never writes to Supabase or calls OpenAI. Simulated sources/evidence are visibly distinguished from live results.
- Repeating the weekday simulation exact-matches existing Signals/Opportunities and creates no duplicate Assessment or Lead; reset returns a truly empty state.

### Data and Provenance

- Every delivered externally sourced fact resolves to a Signal or ResearchFinding with accessible source metadata.

- Fields copied from one Signal do not require separate duplicate evidence rows.

- Every new researched claim is represented by a ResearchFinding with status, explanation, confidence, and sources or a justified unknown attempt record.

- A reviewer can inspect and reverse an Opportunity merge without losing the original Signals.

### Assessment and Research

- The system calculates all configured dimensions and records score, confidence, rationale, profile version, and policy version.

- Budget and delivery fit can distinguish too small, suitable, partner required, and too large outcomes.

- Commercial access is presented as access or relationship fit and never as a true win probability.

- An Opportunity with sufficient information can skip Deep Research and still receive a Final Assessment.

- The application rejects an agent result that omits a requested question or required terminal status.

- A research task can complete successfully with an unknown value after reasonable attempts are recorded.

- Research stops when any configured pass, time, tool, cost, exhaustion, or no progress limit is reached.

### Lead Delivery and Review

- Only Opportunities that pass final policy and required review become Leads.
- Historical current Leads whose final Assessment is not `qualify` remain immutable but are excluded from the qualified gallery and grouped under Needs requalification until a later passing reassessment creates a new version.

- Each Lead contains why now, timing, budget status, fit reasoning, delivery route, risks, next action, sources, score, and confidence.
- Each new qualified Lead version contains an immutable citation-valid email and call draft with language, channel, evidence links, caveats, and copy controls. The system never sends it.

- The Decision screen shows initial and final score changes and the evidence responsible for the change; the Resolve screen shows the exact open exception and unresolved gates.

- Leads, Source Network, Pursuit workspace, login, shortlist, and the deterministic demo share the same English/Dutch interface and light/dark visual tokens; source-authored evidence remains untranslated.

- A reviewer can approve, reject, request research, correct a field, or change route with an attributable reason.

- Pursue, Pass, Request research, and route changes are atomic, role-scoped, idempotent, stale-version safe, and append immutable review history. Field correction remains a later slice.

- Rerunning the pipeline does not deliver an identical Lead twice to the same destination.

### Operations and Evaluation

- Operators can see stage latency, errors, retries, cost, and stop reasons by source and Opportunity.

- A labeled benchmark set can be rerun before a material prompt, model, source, or scoring change is activated.

- YipYip feedback is captured with stable reason codes and remains linked to the delivered Lead version.

- No production source adapter is enabled without a recorded owner, access method, policy note, rate limit, and retention rule.

### Conversation-readiness shadow experiment (implemented, disabled by default)

`CONVERSATION_READINESS_ENABLED=false` controls an independent `conversation-readiness-v1` evaluation. This answers whether an exploratory conversation is worthwhile, not whether YipYip should commit to delivery. It does not modify existing scores, thresholds, capability gates, lifecycle routing, Lead creation, pursuit, or outreach.

- Evidence inputs cover concrete software need, transferable capability, buying intent, commercial potential, timing, legitimate contact, exclusions/conflicts, and up to three prospect questions. Positive and negative factual claims require allow-listed references, rationale and confidence ≥0.65. An allowed URL is not proof that the rationale is factually correct.
- Conversation-ready requires a concrete need, transferable services, current enquiry reason, contact route and supported commercial case. Exact scope/budget can remain unknown with a cited funding/spending proxy. Organization size alone is insufficient; programme totals cannot be represented as addressable scope. Unknown buying intent is acceptable only with cited future planning or supplier engagement, not internal activity alone.
- Supported exclusions, closed work without an active opening, no new software, unsupported mandatory capabilities, assigned/internal scope without an opening and confirmed subminimum addressable packages are not suitable. Other material uncertainties/conflicts/sensitive sectors remain monitor. Missing or invalid historical inputs are not evaluated, never negative business judgments. Capacity does not prove capability or authorize a commitment.
- When enabled, the existing monitor and assessment calls collect shadow evidence without extra agents, passes or search allowance. Unknown buying intent never rejects intake. Pure application policy owns classification; invalid semantic evidence produces a diagnostic and not evaluated. Provider-level transport failures remain subject to existing bounded error handling.
- Immutable workspace-scoped evaluations reference the exact Opportunity and Assessment, policy, fingerprint and provenance. Existing historical records are read-only by default; explicit loopback-only persistence writes only the shadow table. Latest final replay is distinguished from current applicability; newer Assessments supersede older evaluations, dated expiry is honored and undated evaluations age out after 90 days.
- The secondary gallery view presents qualification versus readiness, rationale, citations, uncertainty and questions, with “Experimental—not qualified.” It never unlocks Lead actions. Owner/reviewer feedback is append-only, attributed and idempotent against the current exact version: Worth contacting, Monitor, Pass, Insufficient evidence. A stable reason is required and Other requires notes. Operators/viewers inspect only. Corrections append a replacement label.
- Label-first mode hides per-case automated scores/recommendations until submission (or explicit opt-out); it is an anti-anchoring aid, not a claim of complete blinding. Coverage, current human-label counts, comparable disagreements and potential false negatives are reported. Unlabeled, insufficient-evidence, not-evaluated, expired and superseded cases do not establish agreement. GPT judgments are never human ground truth.

The slice establishes evaluation plumbing, not commercial effectiveness. EN/NL chrome, themes and explicitly simulated demo labels are included. See `docs/READINESS_EXPERIMENT.md` for commands, evidence gaps and verification boundaries. Paid historical reassessment, live research A/B, hosted activation, outreach and CRM changes remain outside this slice.

### Core release decision (unchanged)

The original brief is validated only when a controlled campaign yields 2–3 distinct, current organizations with a supported YipYip fit axis, realistic addressable budget, valid contact route, current actionability, and both outreach drafts for YipYip's human relevance judgment. Otherwise the hypothesis remains unproven and hosted Cron stays disabled. The MVP is ready for broader controlled use when the remaining acceptance criteria pass on the agreed source set, the evaluation set shows acceptable evidence validity and qualification precision, and YipYip approves the profile, thresholds, review policy, and delivery format.
