# Gemini security patch sample

This local Python example deliberately omits the document ownership check. All records are fictitious. It is not a deployed service.

- `app/access.py`: original vulnerable source.
- `gemini-proposal.json`: actual model response after parsing, when Gemini returns a valid proposal.
- `gemini.patch`: exact generated patch, when the proof completes.
- `access.fixed.py`: corrected source, when the proof completes.
- `results.json`: recorded baseline, provider outcome and verification results. Check `ai_generated` and `patched.status`; a provider failure is not a passing result.

Run from the SENTINEL-X-PHASE6 project root in PowerShell:

    $env:PATH = 'C:\Users\Dell\AppData\Local\Programs\DockerDesktop\resources\bin;C:\Program Files\Git\usr\bin;' + $env:PATH
    $env:PYTHONPATH = '.'
    & .\.venv\Scripts\python.exe scripts/test_gemini_security_demo.py

The runner loads your local Gemini configuration without printing the API key. It sends only the fictitious sample to Gemini, checks backend and verifier patch policies, rejects a changed hash and missing approval, applies the patch to a temporary copy, and runs protected functional/security tests in a restricted Docker container. The original source stays vulnerable for repeatable testing.

This standalone proof does not approve or modify a website job. The current website upload path still needs its source/verifier binding fixed for arbitrary uploaded files, including C files.
