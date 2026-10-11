# Domain Model

## Modeling

- Use aggregate roots, entities and value objects; describe designs with domain-driven design (DDD) terminology.
- Use domain value objects only; no primitives. Prefer immutable value objects over native types; never bypass these rules for speed of implementation.

## Naming and Ubiquitous Language

- Use [glossary](glossary.md) names/meanings in code and documentation.
- Before introducing/changing domain terminology: update glossary. Technical/implementation terminology does not require glossary changes.
- Use unambiguous domain names, not technical concepts or jargon.
- Within each bounded context: one term per concept, one meaning per term.
- When domain language changes: rename corresponding code.

## Bounded Contexts

- Define explicit boundaries.
- Share code between contexts only through `src/domain/shared`.

## Aggregates

- Expose only aggregate roots; external code must never hold inner-entity references.
- Enforce every invariant inside its aggregate.
- Include only objects requiring consistency together; keep aggregates small.
- Reference other aggregates by identity only.
- Change only one aggregate per application-service operation.
- `Level` creates/owns `Hero` from supplied starting position/facing. External reads use immutable `HeroState`; movement only through `Level.tick()`.

## Entities

- Define and compare by identity, never attributes.

## Value Objects

- Define by attributes; no identity. Compare by value.
- Immutable: replace, never mutate.
- Validate at creation; invalid instances must not exist.
- Keep behavior free of side effects.

## Domain Behavior

- Put business rules in aggregates, entities and value objects; no anemic domain model.
- Domain services: stateless; only operations belonging to no entity/value object.
- Factories: use when aggregate-creation complexity obscures the constructor.
- Domain events: name in past tense after the domain occurrence.

## Application Services

- Load aggregates, invoke behavior, save aggregates. No business rules.

## Repositories

- One repository per aggregate root.
- Interface in domain; implementation in infrastructure.
- Load/save whole aggregates.

## Integration

- Protect domain from external models with an anti-corruption layer.
