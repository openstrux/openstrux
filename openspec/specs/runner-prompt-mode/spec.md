## ADDED Requirements

### Requirement: Prompt assembly and persistence
In `--mode prompt`, `generate.ts` SHALL assemble the full benchmark prompt from the worktree's config and prompt files, write it to the result-dir, and exit without calling any LLM.

#### Scenario: Prompt file written to result-dir
- **WHEN** `generate.ts --mode prompt --path <path> --result-dir <dir>` is invoked
- **THEN** `<dir>/prompt-<path>.txt` is created containing the fully assembled prompt (system, constraints, specs, tasks, generation instructions, path instructions, output format)

#### Scenario: Worktree path persisted
- **WHEN** `--mode prompt` completes successfully
- **THEN** `<result-dir>/worktree.txt` is created containing the absolute worktree path

#### Scenario: Cleanup reminder printed
- **WHEN** `--mode prompt` exits
- **THEN** the script prints to stderr the `git worktree remove <path>` command for the created worktree

#### Scenario: Worktree is not removed on exit
- **WHEN** `--mode prompt` exits
- **THEN** the worktree directory remains on disk intact

#### Scenario: Exit 0 on success
- **WHEN** prompt assembly and file writing succeed
- **THEN** the script exits with code 0
