"""Build the local compliance FAISS index on demand."""
from __future__ import annotations

import os
from pathlib import Path

# Transformers must select the TensorFlow-maintained Keras 2 compatibility
# package before sentence-transformers imports any Hugging Face modules.
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter


def build_index(documents_dir: Path, index_dir: Path) -> None:
    """Create the index used by rag_agent.py; safe to call during API startup."""
    documents_dir = Path(documents_dir).resolve()
    index_dir = Path(index_dir).resolve()
    documents = PyPDFDirectoryLoader(str(documents_dir)).load()
    if not documents:
        raise RuntimeError(f"No PDF documents found in {documents_dir}")
    chunks = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200).split_documents(documents)
    embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")
    FAISS.from_documents(chunks, embeddings).save_local(str(index_dir))


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    build_index(root / "documents", root / "compliance_db")
