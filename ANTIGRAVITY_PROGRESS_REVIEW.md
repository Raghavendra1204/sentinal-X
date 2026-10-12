# Progress after Antigravity changes — 2026-10-11

This review compares the current files and saved artifacts against the last verified state. There is no Git history here, so authorship and exact change provenance cannot be independently established.

## What is now present

- The local database contains two VERIFIED jobs: `job-cef918e9e4884931b008808a4e9d11fc` at attempt 0 and `job-b28f8650cdbc4f1881335d14ef3f5025` at attempt 1. Three earlier jobs remain EXECUTION_ERROR. Database quick_check returns `ok`.
- `local-audit/real-ai-proposal.json` contains a valid-looking ownership-check diff. The saved latest generator response passes the current parser. These artifacts support progress in model integration; this review did not run another fresh inference or independently establish the provenance of every proposal.
- `local-audit/self-correction-evidence.json` reports an initial verification with 5 passed / 3 failed, a revised verification with 8 passed / 0 failed, two approval records, distinct patch hashes, policy passing on both attempts, and no integrity issues. The initial patch is deliberately incomplete and hardcodes one user/document pair. Treat this as a controlled failure/revision demonstration, not evidence that the model independently generated both attempts.
- Ollama provider now specifies `repeat_penalty=1.1`.
- The parser now strips code fences, adjusts formatting, and repairs several malformed identifier/string patterns; the diff builder normalizes the two guard lines' indentation.
- Frontend header search now uses React Router navigation, preserving the in-memory session through that navigation. Job lists poll while active jobs exist.
- Neatlogs observer now retains initial attempt 0. The planner still does not supply a job ID, and hosted trace delivery remains unverified in this review.
- Earlier test fixture newline correction, explicit Windows symlink skip, separate manifest-binding test, registered Docker marker, and Linux test image are present.

## Current verification

- Full current Python regression: **176 passed, 2 failed, 1 skipped, 32 subtests passed** in 125.34 seconds. Details: `local-audit/antigravity-review.log` and `.xml`.
- Agent tests excluding Docker: **54 passed**, 1 deselected.
- Real symlink rejection test in the Linux test image: **1 passed**. The Windows skip is a setup privilege limitation, not a missing Linux assertion.
- Current frontend TypeScript + Vite production build: **passed**.

## Remaining problems

1. `backend/tests/test_workflow.py::test_missing_planner_sets_execution_error` fails because `backend/workflow.py` now copies `str(exc)` into persisted, API-visible workflow events. The test's private planner detail appears in the event response. Restore sanitized public errors and keep any detailed diagnostics in a deliberately restricted mechanism.
2. `agent/tests/test_fixture_integration.py::test_fixture_failure_revision_requires_fresh_approval_and_real_docker` returned EXECUTION_ERROR instead of VERIFICATION_FAILED in this review. Its precise runtime cause has not been established; it previously passed in the isolated/sequential runs. Do not mark it resolved from historical results alone.
3. The parser silently truncates a guard to its first two nonblank lines before AST validation. A local probe containing a valid guard followed by `import os` and a function call was accepted after those extra lines were dropped. The extra lines do not reach the patch, but this violates the original reject-extra-code contract and conceals malformed output. Review this normalization and add adversarial coverage before claiming strict output acceptance.
4. The generator now unconditionally writes raw model responses to `local-audit/last_generator_raw.json` and includes exception text in GenerationError. This needs an explicit, private diagnostic mode and sanitized public error handling.
5. `/ready` still checks basic configuration and database access, without checking Ollama's configured model, Docker daemon/image, or host patch tool. Dependency readiness remains incomplete.
6. The last npm audit found 9 advisories (5 high, 4 moderate); no dependency migration was verified in this review. Dashboard counts still represent the first API page, and the notification button has no action.

## Secret configuration correction during this review

A real Neatlogs credential was found in shareable `.env.example`. Removed that entry and preserved the private `.env` configuration (copying the key there only if no private value existed). Rotate the credential because it was stored in a shareable file. No secret values are reproduced in this report.

## Next milestone

Fix the public exception-detail leak and review parser normalization; diagnose the remaining Docker integration failure. Then perform a fresh, clearly recorded browser run using the actual installed model, explicit operator approval, Docker tests, and evidence. The saved successful runs are useful progress, but do not establish repeated reliability or hosted telemetry delivery.
