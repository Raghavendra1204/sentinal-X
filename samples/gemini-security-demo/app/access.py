# Intentionally vulnerable local training sample. All records are fictitious.
"""Deterministic in-memory document data for BOLA authorization lab."""

from typing import Any, Dict

DOCUMENTS: Dict[str, Dict[str, Any]] = {
    "doc_alice_1": {
        "id": "doc_alice_1",
        "owner_id": "alice",
        "title": "Alice Strategy Plan",
        "content": "Confidential corporate strategy notes for Alice.",
        "is_private": True,
    },
    "doc_alice_2": {
        "id": "doc_alice_2",
        "owner_id": "alice",
        "title": "Alice Financial Audit",
        "content": "Personal financial audit report for Alice.",
        "is_private": True,
    },
    "doc_bob_1": {
        "id": "doc_bob_1",
        "owner_id": "bob",
        "title": "Bob Cryptographic Keys",
        "content": "Private signing keys and security tokens for Bob.",
        "is_private": True,
    },
    "doc_bob_2": {
        "id": "doc_bob_2",
        "owner_id": "bob",
        "title": "Bob Performance Review",
        "content": "Managerial feedback and review for Bob.",
        "is_private": True,
    },
    "doc_charlie_1": {
        "id": "doc_charlie_1",
        "owner_id": "charlie",
        "title": "Charlie Payroll Record",
        "content": "Charlie salary and executive compensation.",
        "is_private": True,
    },
}


"""Document access control module with intentional BOLA vulnerability (OWASP API1:2023).

This file is the single target file that AI remediation patches are allowed to modify.
"""

from typing import Any, Dict, Optional


def get_document(requesting_user_id: Optional[str], document_id: str) -> Dict[str, Any]:
    """Retrieve document by ID for the requesting user.

    Args:
        requesting_user_id: ID of the user requesting the document (e.g. 'alice', 'bob').
        document_id: Identifier of the document to retrieve.

    Returns:
        Dictionary containing document metadata and content.

    Raises:
        PermissionError: If requesting_user_id is anonymous or unauthorized.
        LookupError: If document_id does not exist.
    """
    # Explicit anonymous check
    if not requesting_user_id or not str(requesting_user_id).strip():
        raise PermissionError("Anonymous access denied: requesting_user_id required")

    # Nonexistent document check
    if document_id not in DOCUMENTS:
        raise LookupError(f"Document '{document_id}' not found")

    doc = DOCUMENTS[document_id]

    # VULNERABLE IMPLEMENTATION (Broken Object-Level Authorization):
    # Fails to enforce that doc["owner_id"] == requesting_user_id before returning.
    return dict(doc)
