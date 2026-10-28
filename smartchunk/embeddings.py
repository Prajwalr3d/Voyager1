"""Replaceable embedding adapters. Default adapters never download models implicitly."""
from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


class ModelUnavailable(RuntimeError):
    pass


class EmbeddingAdapter(Protocol):
    model_id: str
    config_id: str
    dimension: int
    def embed(self, texts: list[str]) -> list[list[float]]: ...


@dataclass
class SentenceTransformerAdapter:
    model_id: str = "sentence-transformers/all-MiniLM-L6-v2"
    local_files_only: bool = True
    _model: object | None = None
    dimension: int = 0

    @property
    def config_id(self) -> str:
        return f"local_files_only={self.local_files_only}"

    def _load(self) -> object:
        if self._model is not None: return self._model
        try:
            model_path = self.model_id
            # Resolve a hub identifier from the local cache before importing the
            # heavyweight model stack.  Besides making failure deterministic,
            # this preserves the no-implicit-download contract.
            if self.local_files_only and not Path(model_path).is_dir():
                from huggingface_hub import snapshot_download
                model_path = snapshot_download(repo_id=model_path, local_files_only=True)
            from sentence_transformers import SentenceTransformer
            self._model=SentenceTransformer(model_path, local_files_only=self.local_files_only)
            self.dimension=int(self._model.get_sentence_embedding_dimension())
            return self._model
        except Exception as exc:
            raise ModelUnavailable(f"Embedding model unavailable locally: {self.model_id}") from exc

    def embed(self, texts: list[str]) -> list[list[float]]:
        model=self._load(); vectors=model.encode(texts,normalize_embeddings=True,show_progress_bar=False)
        return [[float(value) for value in vector] for vector in vectors]


@dataclass
class HashEmbeddingAdapter:
    """Small deterministic test/development adapter; not represented as semantic understanding."""
    model_id: str = "smartchunk-hash-v1"
    dimension: int = 64

    @property
    def config_id(self) -> str: return f"dimension={self.dimension}"

    def embed(self, texts: list[str]) -> list[list[float]]:
        values=[]
        for text in texts:
            vector=[0.0]*self.dimension
            for word in re.findall(r"\w+",text.lower()):
                vector[int(hashlib.sha256(word.encode()).hexdigest(),16)%self.dimension]+=1.0
            norm=math.sqrt(sum(v*v for v in vector)) or 1.0
            values.append([v/norm for v in vector])
        return values


def default_adapter() -> SentenceTransformerAdapter:
    return SentenceTransformerAdapter()
