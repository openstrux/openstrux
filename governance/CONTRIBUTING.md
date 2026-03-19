# Contributing to Openstrux

## Commit format

All commits must follow [COMMIT_FORMAT.md](COMMIT_FORMAT.md).

The repo ships a git commit template (`.gitmessage`) that pre-fills the human format. To activate it locally:

```bash
git config commit.template .gitmessage
```

This is already set for this clone. VSCode Source Control will show the template in the commit message box — fill in the title and body, the `Author:` line is pre-filled.

### AI-assisted commits

Replace the `Author:` line and append the two disclosure lines:

```
Author: Olivier Fabre with Claude Sonnet 4.6 <olivierfabre@homofaberconsulting.com>
[Gen AI contribution: <what AI did>]
Defined and Reviewed by author
```

See [COMMIT_FORMAT.md](COMMIT_FORMAT.md) for full rules and rationale.

## Pull requests

Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`). All commits in the PR must be compliant before merge.

## Drafts and spec material

Working drafts go in `tmp/` and are promoted to `../openstrux-spec` via change packages. Never commit `tmp/` to main. See [CLAUDE.md](../CLAUDE.md) for folder guide.
