## ADDED Requirements

### Requirement: Worktree recovery from result-dir
In `--mode apply`, `generate.ts` SHALL read the worktree path from `<result-dir>/worktree.txt` with no additional `--worktree` flag required.

#### Scenario: Worktree path read automatically
- **WHEN** `generate.ts --mode apply --response <file> --result-dir <dir>` is invoked
- **THEN** the worktree path is read from `<dir>/worktree.txt`

#### Scenario: Missing worktree.txt is a fatal error
- **WHEN** `--mode apply` is set but `<result-dir>/worktree.txt` does not exist
- **THEN** the script exits non-zero with a descriptive error message

### Requirement: Response parsing and file writing
`generate.ts` SHALL parse fenced code blocks from the response file using the same block-extraction logic used by the agent mode, writing each file to its path within the recovered worktree.

#### Scenario: Fenced blocks written to worktree
- **WHEN** the response file contains fenced blocks with a `// path/to/file` first-line comment
- **THEN** each file is written to `<worktree>/<path>` with parent directories created as needed

#### Scenario: Response archived as attempt file
- **WHEN** `--mode apply` writes files
- **THEN** the response text is saved as `<result-dir>/response-attempt-<N>.txt` where N is one more than existing attempt files

### Requirement: Unit test execution and retry prompt
After writing files, `generate.ts` SHALL run unit tests. On failure it SHALL print a filled retry prompt and exit non-zero. On success it SHALL archive results and clean up.

#### Scenario: Tests pass — archive and clean up
- **WHEN** all unit tests pass after applying the response
- **THEN** `save-result.sh` is invoked, the worktree is removed via `git worktree remove`, and the script exits 0

#### Scenario: Tests fail — retry prompt printed
- **WHEN** one or more unit tests fail
- **THEN** the script prints a filled retry prompt to stdout (retry.md template with {{passed}}, {{total}}, {{attempt}}, {{maxRetries}}, {{failures}} substituted), exits non-zero, and does NOT remove the worktree

#### Scenario: Retry attempt number is accurate
- **WHEN** the retry prompt is printed
- **THEN** {{attempt}} reflects the current attempt number derived from existing response-attempt-*.txt count
