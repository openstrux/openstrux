## MODIFIED Requirements

### Requirement: Rod taxonomy

The rod taxonomy SHALL include three categories:

1. **Basic rods** (18) — atomic primitives that cannot be decomposed. Defined in `specs/modules/rods/`.
2. **Standard rods** — certified composite rods that ship with core. Compose basic rods into reusable units. Defined in `specs/modules/rods/standard/`. First standard rod: `private-data`.
3. **Hub rods** — community-contributed composite rods with adapter-specific trust. Defined in the hub registry.

The overview document SHALL list standard rods in a dedicated section after basic rods, with the same knot documentation format (cfg, arg, in, out, err).

#### Scenario: Overview lists standard rods
- **WHEN** the rod overview (`specs/modules/rods/overview.md`) is read
- **THEN** it contains a "Standard Rods" section listing `private-data` with its category ("Privacy"), knot signature, and compliance mappings

#### Scenario: Standard rods distinct from basic
- **WHEN** the rod overview is consulted for the rod count
- **THEN** it states "18 basic rods + N standard rods" (where N starts at 1), making clear that standard rods are additive
