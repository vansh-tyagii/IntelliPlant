"""RAG Bridge - wraps the frozen Compliance RAG without modifying it.

rag_agent.py is never edited or duplicated logic-wise. This module loads
the original file straight off disk with importlib and reuses its
module-level `qa_chain` and `retriever` objects directly. The only thing
this bridge adds is: (1) turning the CLI script into a callable function,
and (2) prefixing the question with a compact summary of the current
Fusion Agent output, so the compound risk becomes RAG context instead of
the RAG running in isolation.
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from typing import Any, Mapping, Optional

from core.config import RAG_AGENT_PATH, COMPLIANCE_DB_DIR, BACKEND_ROOT
from core.logger import get_logger

LOGGER = get_logger("rag.bridge")

_module = None
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")


def _ensure_index() -> Path:
    """Build the FAISS index once when a fresh deployment has none."""
    index_dir = COMPLIANCE_DB_DIR.resolve()
    if (index_dir / "index.faiss").is_file() and (index_dir / "index.pkl").is_file():
        return index_dir
    from rag.legacy.build_db import build_index
    LOGGER.info("Compliance FAISS index missing; building it at %s", index_dir)
    build_index(BACKEND_ROOT / "documents", index_dir)
    return index_dir


def _load_frozen_rag_module():
    global _module
    if _module is not None:
        return _module

    path = Path(RAG_AGENT_PATH)
    if not path.is_file():
        raise FileNotFoundError(
            f"Frozen RAG agent not found at {path}. Set ETAI_RAG_AGENT_PATH to "
            "your real rag_agent.py."
        )
    index_dir = _ensure_index()

    previous_cwd = Path.cwd()
    # The frozen module uses a relative compliance_db path. Load it from the
    # index parent so its existing code resolves the freshly built index.
    os.chdir(index_dir.parent)
    spec = importlib.util.spec_from_file_location("frozen_rag_agent", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load module spec for {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    try:
        spec.loader.exec_module(module)  # runs rag_agent.py's own module-level setup, unmodified
    finally:
        os.chdir(previous_cwd)
    _module = module
    LOGGER.info("Loaded frozen Compliance RAG from %s", path)
    return module


def _build_context_prefix(fusion_context: Optional[Mapping[str, Any]]) -> str:
    """Turn a Fusion Agent result into a short natural-language context
    string the RAG's own prompt template can use, without touching the
    template itself.
    """
    if not fusion_context:
        return ""

    features = (fusion_context.get("raw") or {}).get("features_used", {})
    facts: list[str] = []
    if features:
        facts.append(
            f"Gas/sensor anomaly score = {features.get('sensor_anomaly_score')} "
            f"({features.get('swat_status')})"
        )
        facts.append(
            f"Machine failure risk = {features.get('failure_type')} "
            f"(confidence {features.get('ai41_confidence')})"
        )
        facts.append(
            f"Permit conflict score = {features.get('permit_conflict_score')} "
            f"(type {features.get('permit_type')})"
        )
        facts.append(
            f"PPE risk score = {features.get('ppe_risk_score')} "
            f"(helmet missing: {bool(features.get('helmet_missing'))})"
        )
        facts.append(
            f"Shift context score = {features.get('shift_context_score')} "
            f"(supervisor present: {bool(features.get('supervisor_present'))})"
        )
    compound_risk = fusion_context.get("compound_risk")
    if compound_risk is not None:
        facts.append(f"Compound risk score = {compound_risk}/100 ({fusion_context.get('status', '').upper()})")

    if not facts:
        return ""
    return "Current plant condition: " + "; ".join(facts) + ". "


def query_compliance(question: str, fusion_context: Optional[Mapping[str, Any]] = None) -> dict[str, Any]:
    """Ask the frozen Compliance RAG a question, with fusion output injected
    as retrieval + prompt context. Returns a structured dict instead of
    printing to stdout like the original CLI script does.
    """
    context_prefix = _build_context_prefix(fusion_context)
    composed_question = f"{context_prefix}{question}".strip()

    try:
        module = _load_frozen_rag_module()
        answer = module.qa_chain.invoke(composed_question)
        docs = module.retriever.invoke(composed_question)
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("Compliance RAG query failed")
        return {"answer": None, "sources": [], "context_used": context_prefix, "error": str(exc)}

    sources = sorted({Path(doc.metadata.get("source", "unknown")).name for doc in docs})
    return {
        "answer": answer,
        "sources": sources,
        "context_used": context_prefix,
        "raw_question": composed_question,
    }
