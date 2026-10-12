"""Direct, configured planner integration. No implicit mock or shell execution."""

from importlib import import_module
from typing import Any, Protocol

from ..config import Settings
from ..models import WorkflowError
from ..policy import ALLOWED_PATHS
from ..schemas import AgentProposal, Finding


class AgentAdapter(Protocol):
    def propose_patch(self, finding: dict[str, Any], source_context: dict[str, str],
                      attempt: int, feedback: dict[str, Any] | None = None) -> AgentProposal: ...


def load_callable(spec: str, allowed_root: str):
    """Import only a public callable under the trusted component package."""
    from ..config import _CALLABLE

    module_name, separator, function_name = spec.partition(":")
    if (not separator or not _CALLABLE.fullmatch(spec) or
            not module_name.startswith(allowed_root + ".") or
            function_name.startswith("_")):
        raise RuntimeError("integration callable is outside the trusted package")
    function = getattr(import_module(module_name), function_name)
    if not callable(function):
        raise RuntimeError("configured integration is not callable")
    return function


class ConfiguredAgentAdapter:
    def __init__(self, settings: Settings):
        self.settings = settings

    def propose_patch(self, finding: dict[str, Any], source_context: dict[str, str],
                      attempt: int, feedback: dict[str, Any] | None = None) -> AgentProposal:
        if not self.settings.agent_callable:
            raise RuntimeError("planner integration is not configured")
        result = load_callable(self.settings.agent_callable, "agent")(finding, source_context, attempt, feedback)
        return AgentProposal.model_validate(result)


def bounded_source_context(settings: Settings, finding: Finding) -> dict[str, str]:
    if finding.file_path not in ALLOWED_PATHS:
        if finding.source_snippet:
            return {finding.file_path: finding.source_snippet}
        raise WorkflowError("finding path is not authorized", 422)
    root = settings.source_root.resolve()
    candidate = root
    for component in finding.file_path.split("/"):
        candidate = candidate / component
        if candidate.is_symlink():
            raise RuntimeError("authorized source contains a symlink")
    path = candidate.resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise RuntimeError("authorized source file is unavailable")
    if path.stat().st_size > settings.max_source_bytes:
        raise RuntimeError("authorized source exceeds context limit")
    with path.open("rb") as source:
        content = source.read(settings.max_source_bytes + 1)
    if len(content) > settings.max_source_bytes:
        raise RuntimeError("authorized source exceeds context limit")
    return {finding.file_path: content.decode("utf-8")}
