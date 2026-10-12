# Writing Rules

Readers are agents. Optimize for correct, unambiguous, retrievable rules at minimum token cost.

## Rule Authoring

- Write imperative rules. Use WHEN, IF, MUST or STOP IF only where they remove ambiguity.
- Name exact paths, symbols, commands and schemas.
- Do not turn optional guidance into mandatory constraints.
- Design specifications separate hard constraints, guidance, permitted variation and ambiguity-resolving examples.

## Canonical References

- Define each requirement once. Link its home instead of copying or summarizing it.
- Keep the headings that other files link to.
- Keep one invariant in one section.

## Syntax and Density

- Use lists for independent rules, numbered lists for ordered steps, tables for mappings and code blocks for exact syntax.
- Use relative links. Follow [.markdownlint.json](../.markdownlint.json).
- Use headings for hierarchy. No bold text, horizontal rules or hashtags.
- Use US English and canonical terminology. No idioms or colloquialisms.
- No em dashes and no semicolons joining clauses. Rewrite the sentence instead of swapping punctuation.
- No introductions, conclusions, motivation, transitions, filler, hedges or repeated explanations. Keep examples only when they resolve ambiguity.
- Keep code facts out of prose when the code holds them. Link the source file instead.

## Other Prose

- Messages, commit bodies and pull request descriptions state only provided or verified facts, without persuasion or soft closers.
- Pull request descriptions cover change, reason, validation and known risks.
