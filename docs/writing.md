# Writing Rules

## Scope and Priority

- Every Markdown document created or edited in this repository must follow these rules, regardless of subject. All documents are agent-authored and agent-consumed. Do not optimize for human readers or create human-facing variants.
- Apply this priority order: correctness and complete requirements, unambiguous meaning, explicit scope/conditions, selective retrieval, no duplication, minimum total token consumption, consistent terminology/formatting.
- Do not rewrite unrelated documents for consistency. Preserve authoritative content, exceptions, evidence and necessary examples in affected sections.

## Rule Authoring

- State meaningful scope, trigger, required action, prohibitions, exceptions and stop conditions. Omit fields that add no constraint.
- Use imperative language for operations. Use explicit conditions such as WHEN, IF, MUST or STOP IF where they remove ambiguity.
- Replace subjective requirements with executable criteria only when supported by the requirement. Do not convert optional guidance into mandatory constraints.
- Use exact paths, symbols, commands, interfaces and schemas when applicable.

## Specification Content

| Category | Include when applicable |
| --- | --- |
| Repository instructions | Scope, triggers, mandatory actions, constraints, routing, delegation |
| Domain definitions | Canonical term, meaning, invariants, ownership, relationships. Omit generic domain-driven design explanations. |
| Technical contracts | Inputs, outputs, constraints, failures, compatibility, implementation location |
| Design specifications | Separate hard constraints, guidance, permitted variation and ambiguity-resolving examples |
| Testing specifications | Obligations, invariants, fixtures, determinism |
| Operational procedures | Commands, conditions, failure handling, ordered steps when order matters |

## Canonical References and Retrieval

- Define each requirement once. Link its authoritative location instead of creating summary copies or documentation layers.
- Use the canonical sources in [Documentation Routing](../AGENTS.md#documentation-routing). Architecture remains in [Architecture](../AGENTS.md#architecture). Commit operations belong in [Commit Messages](commit-messages.md). Authoring requirements belong here.
- Use descriptive, predictable headings and independently retrievable sections. Keep related requirements together without splitting one invariant across unrelated sections.
- Link directly to required canonical sections. Avoid dependencies that force complete-document reads for one section.

## Syntax and Density

- Use directive lists for independent requirements, numbered lists for ordered actions, tables for mappings and code blocks for exact syntax. Use only structures the task needs.
- Use relative Markdown links. Follow [.markdownlint.json](../.markdownlint.json).
- Use headings for hierarchy. Never use bold text or bullets as section dividers, bold emphasis, horizontal rules or hashtags.
- Use US English and consistent canonical terminology. Avoid idioms and colloquialisms. Expand unfamiliar acronyms on first use when needed for interpretation.
- No em dashes. Rewrite sentence structure instead of substituting punctuation.
- Remove narrative introductions, conclusions, motivation, rhetorical transitions, filler, hedges, marketing, repeated explanations and redundant examples.
- Retain examples only to resolve ambiguity. Do not mandate paragraph length, sentence variation or narrative flow.

## Other Prose

- For messages, commit bodies and pull request descriptions: state only provided or verified facts. Use precise wording without editorializing, persuasion or soft closers.
- Match length to required information. Preserve wording unless correction is necessary. Requested deletion adds no replacement filler.
- Pull request descriptions include change, reason, validation and known risks. Follow [Commit Messages](commit-messages.md) for commit-specific constraints.
