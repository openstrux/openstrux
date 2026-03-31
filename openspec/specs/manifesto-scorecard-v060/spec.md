## ADDED Requirements

### Requirement: v0.6.0 manifesto scorecard covers all 7 principles
`openstrux-spec/reviews/v0.6.0.md` SHALL contain a PASS/WARN/FAIL rating for each of the 7 manifesto principles, per the review rules in `MANIFESTO_OBJECTIVES.md`. Ratings SHALL cite actual measured data where available.

#### Scenario: Scorecard contains a rating for every principle
- **WHEN** `reviews/v0.6.0.md` is read
- **THEN** it SHALL contain exactly 7 principle entries, each with a `PASS`, `WARN`, or `FAIL` rating and a rationale

#### Scenario: No principle scores FAIL
- **WHEN** the v0.6.0 scorecard is complete
- **THEN** no principle SHALL be rated `FAIL` (release gate: all MUST objectives met)

### Requirement: Scorecard records partial benchmark data
For principles where the full benchmark suite is not yet complete (< 20 cases, < 3 LLM families), the scorecard SHALL record a `WARN` with a note citing the specific gap and referencing v0.7.0 as the target for full compliance.

#### Scenario: Principle 1 warns on incomplete benchmark suite
- **WHEN** the scorecard is written with 10 of 20+ required cases
- **THEN** Principle 1 SHALL be rated `WARN` with text noting "10/20+ benchmark cases complete; full benchmark gate deferred to v0.7.0"
