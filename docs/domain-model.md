# Domain Model

## Modeling

- Model with aggregate roots, entities and immutable value objects. Wrap domain concepts in value objects that validate at creation. Plain numbers are fine for raw coordinates and constants.
- Put business rules in aggregates, entities and value objects. Application services only load, invoke and save.
- Domain events use the past tense.

## Naming

- Use [glossary](glossary.md) names in code and docs. Update the glossary before introducing or changing a domain term. Technical terms need no entry.
- When a domain term changes, rename the code that uses it.

## Aggregates

- Expose only aggregate roots. Enforce each invariant inside its aggregate. Reference other aggregates by identity.
- Change one aggregate per application-service operation.
- `Level` creates and owns `Hero` from a starting position and facing. Outside code reads the immutable `HeroState` and moves the hero only through `Level.tick()`.
- Repositories: one per aggregate root, interface in domain, implementation in infrastructure, whole aggregates only.
