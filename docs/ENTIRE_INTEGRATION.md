# Entire integration: preflight and remaining setup

Entire records development sessions and links them to Git commits. It does not
provide SENTINEL-X runtime verification, approve patches, or replace Docker tests.

## Actual local findings — 2026-10-12

- The running project is the `SENTINEL-X-PHASE6` directory inside the Phase6
  archive on the Desktop. `git rev-parse --show-toplevel` fails: no Git repository.
- The other inspected copies, `sentinel final/Agent-Solution--feat-verification`
  and `SENTINEL-X-final/SENTINEL-X`, also lack a valid Git repository.
- The verification copy already has `.entire/settings.json` and
  `.agents/hooks.json`. Settings declare enablement and `git-refs` storage, but
  those files alone do not establish a working Git integration.
- Existing agent hooks mention `pre-tool-use`, `pre-invocation`, and `stop`.
  They were inspected without being changed or executed.
- Antigravity CLI `agy` reports version **1.2.1**.
- Existing global Antigravity settings were inspected and preserved.
- Backend `/health` and frontend `/` both returned HTTP 200 during this check.
- No repository was initialized; no commits, pushes, branch changes, or remote
  configuration changes were performed. No session capture or checkpoint linkage
  has been proved.

## Repository prerequisite

Provide the path of the team's existing Git clone. Do not run `git init` inside
an extracted archive simply to enable Entire. If no clone exists, provide the
team repository URL so a separate clone can be prepared without replacing local
work. Before setup, inspect branch, working changes, existing Git hooks,
`core.hooksPath`, remotes, tracked sensitive files, and repository privacy there.

## Official installation

Use the [official installation instructions](https://github.com/entireio/cli#quick-start).
The stable Windows installer was downloaded to the sibling `entire-integration`
directory and inspected before execution. Its GitHub asset download stalled and
was stopped. A retry uses the same official release and release checksum.
Executable installation and command validation must be reported separately from
repository enablement.

## Privacy and source control

The project ignore file now also excludes local audit output, Python caches,
virtual environments, node dependencies, the local backend database, and Entire's
private metadata, logs, temporary files and local settings. Source code, examples,
protected tests and the sample Gemini patch remain eligible for source control.
This archive has no Git index, so already-tracked secret detection cannot yet be
performed. Repeat the audit in the real clone. Ignore rules do not untrack files
and do not prevent an agent from reading a secret into a captured conversation.

Entire captures development context, including tool interactions. Review its
[security and privacy documentation](https://github.com/entireio/cli/blob/main/docs/security-and-privacy.md).
Secret redaction is best effort; screenshots and binary content are not guaranteed
to be protected. Keep checkpoint auto-pushing disabled until the destination and
privacy have been explicitly approved. Keep default secret scanners enabled.
Do not enable optional external privacy services as part of this setup.

## Validation remaining

Once a real clone and usable CLI are available, inspect the installed CLI's help
for enablement, agent management, configuration, sessions, checkpoints, diagnostics
and disablement. Use only flags confirmed by that binary. Back up existing hooks
and settings before enablement; let the official CLI merge/generate its hooks.
Verify that unrelated hooks remain chained and global settings remain intact.

Start a new Antigravity session in that clone and request a harmless documentation
change. Confirm that Entire observes the actual session. A future normal,
user-authorized commit is required to prove commit-to-checkpoint linkage; do not
commit existing changes or fabricate a session merely for the demonstration.
Session recovery can change branches or the working tree and needs separate
authorization. A separate private checkpoint remote likewise requires approval
of its URL and access before configuration or publishing.

No SENTINEL-X runtime source or verifier configuration was changed for this task.
