# Second Mind AI Rewrite Contract

This document defines the canonical rewrite contract for AI-assisted structuring and filing in Second Mind.

The goal is not to make AI "always right." The goal is to make the system:
- generalizable
- hierarchical
- measurable
- safe when uncertain
- independent from the default taxonomy

## Non-Negotiables

1. The current user category tree is the only filing truth.
2. AI recommends; the app validates and generates addresses.
3. Structuring and filing are separate tasks.
4. Filing happens hierarchically, not with one giant category dump.
5. Low-confidence decisions must degrade gracefully instead of guessing.

## System Boundaries

### `File With AI`

Purpose:
- turn a rough capture into a structured draft

Allowed outputs:
- cleaned note title
- cleaned note body
- normalized source fields
- meaningful corrections
- confidence

Not allowed to decide:
- category
- new category title
- card address
- related cards

### `Suggest Filing`

Purpose:
- decide where an already-structured draft belongs

Allowed outputs:
- best top-level branch
- best existing shelf within that branch
- or a reusable new shelf title within that branch
- confidence
- short reasoning

Not allowed to decide:
- next numeric category code
- next card address
- whether a returned code is valid

Those are deterministic app mechanics.

## Canonical Filing Stages

### Stage 1: Branch Selection

Input:
- structured draft
- current top-level categories only

Output:
- one or two likely top-level ranges
- confidence
- short reasoning

Rules:
- prefer one branch unless the note clearly spans two
- use note function as well as topic
- never choose a leaf or address in this step

### Stage 2: Shelf Decision

Input:
- structured draft
- selected top-level branch
- existing leaf candidates inside that branch
- candidate subranges that could host a new shelf

Output:
- `existing_category`
- `new_category`
- or `manual_review`

Rules:
- prefer an existing shelf when it clearly fits
- create a new shelf only when the note does not fit the existing leafs well
- a new shelf title must be reusable, not a paraphrase of the current note
- do not invent numbers or addresses

### Stage 3: Deterministic App Mechanics

Input:
- filing decision from Stage 2
- actual local categories and cards

Output:
- validated category range
- next category number if creating a category
- next card address

Rules:
- never trust AI with numbering
- never save an invalid range or address
- reject impossible outputs and fall back to review

### Optional Stage 4: Enrichment

Purpose:
- suggest tags, status, and nearby links

This stage is optional and must not block filing.

If it times out, the filing result is still usable.

## Confidence Doctrine

Confidence is not just a number. It drives behavior.

### High

Behavior:
- show one strong suggestion

Conditions:
- strong note-function signal
- clear branch fit
- clear shelf fit
- reusable new shelf if needed

### Medium

Behavior:
- show a preferred suggestion, but prepare alternatives

Conditions:
- branch is clear
- shelf choice is somewhat close
- or new shelf is plausible but not decisive

### Low

Behavior:
- return `manual_review`

Conditions:
- weak note-function signal
- weak branch fit
- only superficial noun overlap
- new shelf title would be too specific

## Sustainability Rules

To avoid "illusions of progress," changes must follow these rules:

1. No note-specific patches.
   A fix must be phrased as a general principle, not an example lookup.

2. No hidden dependence on default categories.
   The same logic must work if a user deletes the defaults and creates a custom tree.

3. No multi-purpose AI calls.
   Each call should have one narrow responsibility.

4. No speed regressions without measurable accuracy gains.
   We track correctness and latency together.

5. No untested fallback branches.
   If a path exists, it must be intentional and benchmarked.

## Benchmark Contract

Every meaningful change should be evaluated against:
- structured quotes
- unsourced aphorisms
- source-heavy notes
- book ideas
- article ideas
- project notes
- practical methods
- remedies
- theology/scripture notes
- custom category trees
- sparse category trees
- large category trees

We should score at least:
- branch correctness
- shelf correctness
- reusable new-shelf quality
- manual-review rate
- timeout rate
- median latency

## Code Ownership

### App-side deterministic layer

Owns:
- numbering
- address generation
- validation
- save rules
- confidence-based UI behavior

### Local heuristic layer

Owns:
- lightweight parsing
- cheap category scoring
- early local fast path
- fallback suggestions when AI is unavailable

### AI layer

Owns:
- structured draft cleanup when local parsing is insufficient
- branch selection
- shelf selection
- reusable shelf naming when needed

## Rewrite Standard

A rewrite step counts as real progress only if it:
- reduces ambiguity in system responsibilities
- improves or preserves benchmark quality
- improves or preserves latency
- works with custom taxonomies
- removes stale or duplicate paths instead of adding more
