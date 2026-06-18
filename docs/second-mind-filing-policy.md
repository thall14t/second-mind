# Second Mind Filing Policy

This document defines how Second Mind should file notes, when it should create a new category, and when it should stop guessing and ask for review.

The goal is stability. Filing should follow durable rules, not one-off prompt patches.

## Core Principle

File by the **kind of note it is for the system**, not just by the most concrete noun it contains.

A note can mention a concrete object without belonging to the concrete-object category.

Examples:
- A practical remedy using a spray bottle belongs with practical methods, not with philosophy.
- A book idea using a garden as a metaphor belongs with ideation or creative development, not with gardening.

## Filing Priorities

When filing a note, evaluate it in this order:

1. Determine the note's function.
2. Determine the dominant domain.
3. Prefer an existing reusable shelf.
4. Create a new category only if the shelf is likely to hold many future notes.
5. Fall back to manual review if the note remains ambiguous.

## Note Functions

Second Mind should recognize these note functions before it chooses a category:

- `source_note`
  A quote, paraphrase, or claim tied to a source.

- `concept_note`
  A principle, argument, distinction, analogy, doctrine, or conceptual claim.

- `practical_method`
  A tactic, remedy, procedure, workflow, recipe, setup, or applied skill.

- `idea_seed`
  A possible book idea, article idea, chapter idea, story idea, project idea, or creative seed.

- `project_material`
  Material clearly intended for a current project or artifact rather than a general knowledge card.

The note function may outweigh literal topic words.

## Subject Versus Function

If subject and function point in different directions, prefer the function when the function is explicit.

Examples of strong function signals:
- `book idea`
- `article idea`
- `chapter idea`
- `story idea`
- `how to`
- `recipe`
- `workflow`
- `remedy`
- `setup`
- `quote from`
- `page`
- `timestamp`

Implication:
- `Book idea where man's life is analogous to his garden` should file as ideation, not as gardening.
- `Milk and water in a spray bottle fights powdery mildew` should file as a practical method, not as abstract philosophy.

## Range Doctrine

This policy does not redefine the full category tree. It defines how filing should interpret it.

### `9800-9899 Creativity and Innovation`

Use this range for:
- book ideas
- article ideas
- chapter ideas
- sermon ideas
- story ideas
- metaphor or analogy seeds intended for future writing or creative work
- conceptual framing intended for a future artifact

If a note explicitly presents itself as an idea for a future work, this range should be strongly preferred over literal subject ranges unless the note is clearly about a different active shelf.

### `9900-9999 Practical Skills and Hobbies`

Use this range for:
- practical methods
- remedies
- recipes
- repair instructions
- hands-on tactics
- applied hobby knowledge
- concrete maintenance or use instructions

If the note describes something a person can do, apply, mix, fix, or use in ordinary life, this range should be strongly preferred over abstract ranges.

### `0000-0999 Philosophy and Ethics`

Use this range for:
- concepts
- principles
- analogies used as claims rather than project ideas
- epistemic or moral distinctions
- truth, evidence, reasoning, judgment, wisdom, virtue

If a note is making a conceptual claim rather than proposing a project or method, this range should be preferred.

## Existing Category Versus New Category

Prefer an existing category when it is a clear fit.

Create a new category only when all of the following are true:
- the note does not fit an existing leaf well
- the proposed category represents a reusable class of notes
- at least several future notes could plausibly belong there
- the new shelf can be named generally, not just as a paraphrase of the current note

## New Category Naming Rules

New categories must be:
- reusable
- general
- short
- shelf-like

Good category names:
- `Book Ideas`
- `Article Ideas`
- `Garden Remedies`
- `Spiritual Formation`
- `Cultural Liturgies`

Bad category names:
- `Life Garden Analogy`
- `Milk Water Spray Powdery Mildew`
- `Stand Firm and Act in Love`

Rule:
- card titles may be specific
- category titles must be general

If the system cannot produce a general category title, it should prefer an existing broader category instead of inventing a brittle new one.

## Card Title Versus Category Title

The card title should capture the specific idea.

The category title should describe the repeatable family of notes.

Example:
- Category: `Book Ideas`
- Card: `Life as Garden Analogy`

Not:
- Category: `Life Garden Analogy`

## Ambiguity Rules

When a note is ambiguous:
- prefer a broader existing shelf over a brittle new shelf
- prefer manual review over a low-confidence guess
- never create a new category just because the card is novel

Novelty is not enough. Reusability is required.

## Source Parsing Versus Filing

Source extraction and filing are different tasks.

`File With AI` should:
- cleanly separate body from source
- normalize source details
- leave source blank when unsupported

`Suggest Filing` should:
- decide where the note belongs
- not let source formatting dominate the filing unless the note function clearly depends on source type

Example:
- `book idea` is primarily an ideation signal, not a source signal
- `quote from X page 24` is primarily a source note signal

## When To Prefer Manual Review

Use manual review when:
- the note is too short to classify well
- subject and function conflict with no clear winner
- the top candidates are weak and close together
- a new category title would be too specific to the current note

## Confidence Doctrine

High confidence means:
- strong note-function signal
- strong domain signal
- clear reusable shelf

Low confidence means:
- weak note-function signal
- only literal noun overlap
- candidate categories fit only superficially
- new category title sounds like a paraphrase of the card

## Regression Examples

These are not special-case rules. They are benchmark examples of the general doctrine.

- `Book idea where man's life is analogous to his garden`
  Expected direction:
  `9800-9899`
  Prefer a reusable idea shelf such as `Book Ideas`, not a one-off category like `Life Garden Analogy`.

- `Milk and water in a spray bottle fights powdery mildew`
  Expected direction:
  `9900-9999`
  Prefer a practical-method shelf, not abstract philosophy.

- `There is a hierarchy of duties and lower loves must answer to higher loves`
  Expected direction:
  philosophy / ethics
  If no existing leaf fits, a reusable ethical shelf is acceptable.

- `The modern self is catechized by liturgies long before it is persuaded by arguments`
  Expected direction:
  sociology / culture / religion
  If no existing leaf fits, a reusable cultural or religious shelf is acceptable.

## Implementation Guidance

Future filing work should follow this order:

1. detect note function
2. score domain candidates
3. score existing shelves
4. evaluate whether a new shelf would be reusable
5. only then produce the final filing suggestion

If a future refinement improves one example but violates this doctrine, the doctrine wins.
