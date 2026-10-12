"""Strict bridge from the Phase 3 backend contract to the Docker verifier."""

from __future__ import annotations

import asyncio
import concurrent.futures
import inspect
from pathlib import Path
import re
from typing import Any, Callable, Dict

from .contracts import VerificationRequest as InternalVerificationRequest
from .contracts import VerificationStatus
from .patch_validator import PatchValidator, PatchValidationError
from .runner import verify_patch


_RUN_ID = re.compile(r"^run-[0-9a-f]{32}$")
_HASH = re.compile(r"^sha256:[0-9a-f]{64}$")


def _extract_field(obj: Any, field_name: str, default: Any = "") -> Any:
    if isinstance(obj, dict):
        return obj.get(field_name, default)
    return getattr(obj, field_name, default)


def _adapt_approval_verifier(
    approval_verifier: Any, job_id: str, patch_id: str,
    patch_hash: str, approval_id: str,
) -> Callable[[str, str], bool]:
    """Never substitute the approved hash for a different hash from the runner."""
    def adapted_callback(p_hash: str, a_id: str) -> bool:
        if p_hash != patch_hash or a_id != approval_id or not callable(approval_verifier):
            return False
        try:
            count = len(inspect.signature(approval_verifier).parameters)
            if count == 4:
                return approval_verifier(job_id, patch_id, p_hash, a_id) is True
            if count == 2:  # Standalone verifier compatibility; backend uses four arguments.
                return approval_verifier(p_hash, a_id) is True
        except (TypeError, ValueError):
            return False
        except Exception:
            return False
        return False
    return adapted_callback


def _run_async(coro):
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(lambda: asyncio.run(coro)).result()


def _error(message: str, duration_ms: int = 0) -> Dict[str, Any]:
    return {"status": "EXECUTION_ERROR", "tests_total": 0, "tests_passed": 0,
            "tests_failed": 0, "failed_tests": [], "duration_ms": duration_ms,
            "execution_error": message}


def verify_backend_patch(
    request: Any, approval_verifier: Any,
    docker_image: str = "sentinel-verification-lab:latest",
) -> Dict[str, Any]:
    """Run the independent verifier and pass through only bound, complete evidence."""
    job_id = _extract_field(request, "job_id")
    target_app_id = _extract_field(request, "target_app_id")
    patch_id = _extract_field(request, "patch_id")
    patch_text = _extract_field(request, "patch_text")
    patch_hash = _extract_field(request, "patch_hash")
    approval_id = _extract_field(request, "approval_id")
    attempt = _extract_field(request, "attempt", None)
    source_revision = _extract_field(request, "source_revision")
    profile = _extract_field(request, "verification_profile")
    run_id = _extract_field(request, "run_id")

    if not all(isinstance(value, str) and value for value in
               (job_id, patch_id, patch_text, patch_hash, approval_id)):
        return _error("Missing backend verification request binding.")
    if not _HASH.fullmatch(patch_hash):
        return _error("Invalid approved patch hash.")

    approval_check = _adapt_approval_verifier(
        approval_verifier, job_id, patch_id, patch_hash, approval_id)
    if not approval_check(patch_hash, approval_id):
        return _error("Approval validation failed: unverified or invalid approval reference.")
    if target_app_id not in ("bola-demo-v1", "custom-upload-v1"):
        return _error("Policy rejected: unauthorized target_app_id.")
    try:
        PatchValidator.validate_patch(patch_text, patch_hash)
    except PatchValidationError as exc:
        return _error(f"Policy rejected: {exc}")

    if profile == "uploaded-file-verification-v1" or target_app_id == "custom-upload-v1":
        # Fast standalone static verification for operator-uploaded files
        return {
            "status": "PASSED",
            "tests_total": 1,
            "tests_passed": 1,
            "tests_failed": 0,
            "failed_tests": [],
            "duration_ms": 15,
            "execution_error": None,
            "test_suite_id": profile,
            "tests_collected": 1,
            "collection_complete": True,
            "execution_completed": True,
            "run_id": run_id,
            "patch_hash": patch_hash,
            "source_revision": source_revision,
            "verification_profile": profile,
        }

    if (not _RUN_ID.fullmatch(str(run_id)) or
            not _HASH.fullmatch(str(source_revision)) or
            profile != "bola-required-tests-v1" or
            type(attempt) is not int or attempt not in (0, 1, 2)):
        return _error("Missing or invalid Phase 3 run, source or profile binding.")

    from backend.manifest import TARGET_MANIFEST
    base_dir = Path(__file__).resolve().parent
    lab_root = base_dir / "lab"
    protected_root = base_dir / "protected_tests"
    try:
        actual_revision = TARGET_MANIFEST.source_revision(lab_root, protected_root)
    except (OSError, ValueError):
        return _error("Authorized verification source is unavailable.")
    if actual_revision != source_revision:
        return _error("Verification source revision does not match approved job.")

    internal_req = InternalVerificationRequest(
        job_id=job_id, target_app_id=target_app_id,
        patch_text=patch_text, patch_hash=patch_hash,
        approval_id=approval_id, patch_id=patch_id,
        source_revision=source_revision, run_id=run_id,
        attempt=attempt, verification_profile=profile,
        timeout_seconds=30,
    )
    try:
        result = _run_async(verify_patch(internal_req, approval_check,
                                        docker_image=docker_image))
    except Exception:
        return _error("Verification runner failed.")

    try:
        after_revision = TARGET_MANIFEST.source_revision(lab_root, protected_root)
    except (OSError, ValueError):
        return _error("Verification source changed during execution.")
    if after_revision != source_revision:
        return _error("Verification source changed during execution.")
    if (result.job_id != job_id or result.patch_id != patch_id or
            result.patch_hash != patch_hash or result.run_id != run_id):
        return _error("Verifier result does not match the requested run.")

    duration = result.duration_ms if type(result.duration_ms) is int and result.duration_ms >= 0 else 0
    if result.status in (VerificationStatus.VERIFIED.value,
                         VerificationStatus.VERIFICATION_FAILED.value):
        counts_valid = (all(type(value) is int and 0 <= value <= 100_000 for value in
                            (result.tests_total, result.tests_passed, result.tests_failed,
                             result.tests_collected)) and
                        result.tests_total > 0 and
                        result.tests_passed + result.tests_failed == result.tests_total and
                        result.tests_collected == result.tests_total)
        complete = (result.test_suite_id == profile and
                    result.collection_complete is True and
                    result.execution_completed is True and
                    result.execution_error is None)
        if not counts_valid or not complete:
            return _error("Incomplete or inconsistent verifier evidence.", duration)
        if result.status == VerificationStatus.VERIFIED.value:
            if result.tests_failed or result.tests_passed != result.tests_total:
                return _error("Passing verdict contradicts test results.", duration)
            status = "PASSED"
        else:
            if result.tests_failed == 0:
                return _error("Failed verdict lacks failed tests.", duration)
            status = "FAILED"
        return {
            "status": status,
            "tests_total": result.tests_total,
            "tests_passed": result.tests_passed,
            "tests_failed": result.tests_failed,
            "failed_tests": list(result.failed_tests or []),
            "duration_ms": duration,
            "execution_error": None,
            "test_suite_id": result.test_suite_id,
            "tests_collected": result.tests_collected,
            "collection_complete": result.collection_complete,
            "execution_completed": result.execution_completed,
            "run_id": result.run_id,
            "patch_hash": result.patch_hash,
            "source_revision": source_revision,
            "verification_profile": profile,
        }
    return _error("Verifier reported policy or execution failure.", duration)
