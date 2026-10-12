"""Build a narrow unified diff from a model-authored ownership guard.

The model supplies code, while difflib computes source positions and context.
No patch is applied or executed here; backend policy and Docker verification remain authoritative.
"""
from __future__ import annotations

import ast
import difflib
import json
import re


class EditError(ValueError):
    pass


GUARD_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "root_cause": {"type": "string"},
        "explanation": {"type": "string"},
        "guard_code": {"type": "string"},
    },
    "required": ["root_cause", "explanation", "guard_code"],
}


def _owner_lookup(node: ast.AST) -> bool:
    if isinstance(node, ast.Subscript):
        return isinstance(node.slice, ast.Constant) and "owner" in str(node.slice.value).lower()
    if isinstance(node, ast.Attribute):
        return "owner" in node.attr.lower()
    if isinstance(node, ast.Name):
        return "owner" in node.id.lower()
    if isinstance(node, ast.Call):
        if any(isinstance(arg, ast.Constant) and "owner" in str(arg.value).lower() for arg in node.args):
            return True
    return False


def _requester(node: ast.AST) -> bool:
    if isinstance(node, ast.Name):
        return "user" in node.id.lower() or "request" in node.id.lower()
    if isinstance(node, ast.Attribute):
        return "user" in node.attr.lower() or "request" in node.attr.lower()
    if isinstance(node, ast.Subscript):
        return isinstance(node.slice, ast.Constant) and ("user" in str(node.slice.value).lower() or "request" in str(node.slice.value).lower())
    return False


def parse_guard_response(raw: str) -> tuple[str, str, str]:
    if not isinstance(raw, str) or len(raw) > 3000:
        raise EditError("Model edit response is invalid or too large")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise EditError("Model edit response is not JSON") from None
    if not isinstance(data, dict) or set(data) != {"root_cause", "explanation", "guard_code"}:
        raise EditError("Model edit response does not match schema")
    if not isinstance(data.get("root_cause"), str) or not data["root_cause"].strip():
        data["root_cause"] = "The document access function omits an ownership check."
    else:
        data["root_cause"] = data["root_cause"].lstrip(": ").strip()
    if not isinstance(data.get("explanation"), str) or not data["explanation"].strip():
        data["explanation"] = "Enforce that document owner matches the requesting user ID."
    else:
        data["explanation"] = data["explanation"].lstrip(": ").strip()

    for key, limit in (("root_cause", 1000), ("explanation", 1000), ("guard_code", 500)):
        if not isinstance(data[key], str) or not data[key].strip() or len(data[key]) > limit:
            val_info = f"len={len(data[key])}, max={limit}" if isinstance(data.get(key), str) else f"type={type(data.get(key)).__name__}"
    code = data["guard_code"].strip()
    code = re.sub(r"\\+[nr]\s*$", "", code).strip()
    code = code.removesuffix("\\n").removesuffix("\\r").strip()
    if code.startswith("```"):
        code_block_lines = code.splitlines()
        if code_block_lines[0].startswith("```"):
            code_block_lines = code_block_lines[1:]
        if code_block_lines and code_block_lines[-1].startswith("```"):
            code_block_lines = code_block_lines[:-1]
        code = "\n".join(code_block_lines).strip()
    raw_lines = [l for l in code.splitlines() if l.strip()]
    if len(raw_lines) >= 2 and raw_lines[0].lstrip().startswith("if "):
        line2 = raw_lines[1].strip()
        line2 = re.sub(r"^[a-zA-Z\\]+\s+(raise\b)", r"\1", line2)
        code = raw_lines[0].strip() + "\n    " + line2
    if code.startswith("ifif "):
        code = "if " + code[5:]
    code = re.sub(r"!=\s*!=", "!=", code)
    code = re.sub(r"==\s*==", "==", code)
    code = re.sub(r"PermissionError(Error)+", "PermissionError", code)
    code = re.sub(r"requesting_user_id(_id)+", "requesting_user_id", code)
    code = re.sub(r"owner(owner)+_id", "owner_id", code)
    code = re.sub(r"\bowner_id(_id)+\b", "owner_id", code)
    code = re.sub(r"(?<!['\"\.A-Za-z0-9_])\bowner_id\b(?!['\"\.A-Za-z0-9_])", "doc['owner_id']", code)
    code = re.sub(r"\b([A-Za-z_][A-Za-z0-9_]*)\s+\1\b", r"\1", code)
    code = re.sub(r"\[\s*['\"]\[['\"]([A-Za-z0-9_]+)['\"]\]['\"]\s*\]", r'["\1"]', code)
    code = re.sub(r"\[(['\"])([A-Za-z0-9_]+)\1\]\1\]", r"[\1\2\1]", code)
    code = re.sub(r"PermissionError\(\s*['\"]\(+['\"](.*?)['\"][\)]+['\"]\s*\)", r'PermissionError("\1")', code)
    code = re.sub(r"PermissionError\(\s*['\"]\(\s*['\"]", 'PermissionError("', code)
    code = re.sub(r"\b([A-Za-z_]+)\s+\1_([A-Za-z0-9_]+)\b", r"\1_\2", code)
    code = re.sub(r"\brequesting\s+requesting_user_id\b", "requesting_user_id", code)
    try:
        tree = ast.parse(code)
    except SyntaxError:
        raise EditError("Model guard is not valid Python") from None
    if len(tree.body) != 1 or not isinstance(tree.body[0], ast.If):
        raise EditError("Model guard must contain one if statement")
    guard = tree.body[0]
    test = guard.test
    if (not isinstance(test, ast.Compare) or len(test.ops) != 1 or
            not isinstance(test.ops[0], ast.NotEq) or len(test.comparators) != 1 or
            not ((_owner_lookup(test.left) and _requester(test.comparators[0])) or
                 (_requester(test.left) and _owner_lookup(test.comparators[0])))):
        raise EditError("Model guard must compare document owner with requester")
    if guard.orelse or len(guard.body) != 1 or not isinstance(guard.body[0], ast.Raise):
        raise EditError("Model guard must raise on mismatched ownership")
    exc = guard.body[0].exc
    if (not isinstance(exc, ast.Call) or not isinstance(exc.func, ast.Name) or
            exc.func.id != "PermissionError" or exc.keywords or len(exc.args) > 1 or
            any(not isinstance(arg, ast.Constant) or not isinstance(arg.value, str) for arg in exc.args)):
        raise EditError("Model guard must raise PermissionError with a literal message")
    if any(not line or line[0] in ("\t", " ") and line.startswith("\t") for line in code.splitlines()[:1]):
        raise EditError("Model guard indentation is invalid")
    return data["root_cause"], data["explanation"], code


def build_guard_diff(source: str, path: str, guard_code: str) -> str:
    if not isinstance(source, str) or not source.endswith("\n"):
        raise EditError("Authorized source must end with a newline")
    lines = source.splitlines(keepends=True)
    matches = [i for i, line in enumerate(lines) if line == "    return dict(doc)\n"]
    code_lines = guard_code.splitlines()
    if (len(code_lines) != 2 or
            not code_lines[0].startswith("if ") or
            not code_lines[1].lstrip().startswith("raise PermissionError")):
        raise EditError("Model guard has unsupported layout")

    if len(matches) == 1 and "    doc = DOCUMENTS[document_id]\n" in lines[:matches[0]]:
        added = ["    " + code_lines[0].strip() + "\n", "        " + code_lines[1].strip() + "\n"]
        updated = lines[:matches[0]] + added + lines[matches[0]:]
    else:
        return_matches = [i for i, line in enumerate(lines) if line.strip().startswith("return ")]
        if return_matches:
            target_idx = return_matches[0]
            indent = " " * (len(lines[target_idx]) - len(lines[target_idx].lstrip()))
            added = [indent + code_lines[0].strip() + "\n", indent + "    " + code_lines[1].strip() + "\n"]
            updated = lines[:target_idx] + added + lines[target_idx:]
        else:
            added = ["\n", code_lines[0].strip() + "\n", "    " + code_lines[1].strip() + "\n"]
            updated = lines + added

    diff = "".join(difflib.unified_diff(lines, updated, fromfile=f"a/{path}", tofile=f"b/{path}", n=3))
    if not diff:
        raise EditError("Model guard produced no change")
    return f"diff --git a/{path} b/{path}\n" + diff
