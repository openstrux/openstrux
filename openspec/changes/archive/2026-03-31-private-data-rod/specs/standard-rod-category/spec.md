## ADDED Requirements

### Requirement: Standard rod category

The spec SHALL define a **standard rod** category distinct from basic rods and hub rods. Standard rods are certified composite rods that ship with core. They compose basic rods into reusable, pre-certified units.

Standard rods:
- Are defined in the spec (`specs/modules/rods/standard/`)
- Are implemented in core (`packages/generator/src/adapters/*/rods/standard/`)
- Expand to a sub-graph of basic rods during IR lowering
- Carry `@cert` that covers the composition as a whole
- Cannot be overridden by panel authors

#### Scenario: Standard rod parses as valid rod type
- **WHEN** a panel uses `pd = private-data { ... }` (a standard rod)
- **THEN** the parser accepts it as a valid rod statement, not an unknown identifier

#### Scenario: Standard rod appears in rod taxonomy
- **WHEN** the rod overview documentation is consulted
- **THEN** standard rods appear in their own section, separate from the 18 basic rods

### Requirement: Standard rod expansion

The compiler SHALL expand each standard rod into its constituent basic rods during IR lowering. The expansion is deterministic: same config produces the same sub-graph.

#### Scenario: Expansion produces basic rods in IR
- **WHEN** a `private-data` rod is compiled
- **THEN** the IR contains the expanded basic rods (validate, pseudonymize, encrypt, guard) with snaps wired according to the framework config

#### Scenario: Expansion is deterministic
- **WHEN** the same `private-data` rod config is compiled twice
- **THEN** both compilations produce identical IR sub-graphs and identical lock hashes

### Requirement: Standard rod certification scope

A standard rod's `@cert` block SHALL certify the composition as a unit. The certification scope includes all expanded basic rods and their wiring.

#### Scenario: Certification covers composition
- **WHEN** a `private-data` rod has `@cert { tested: { ... } }`
- **THEN** the manifest records the certification as covering the entire expanded sub-graph, not individual basic rods
