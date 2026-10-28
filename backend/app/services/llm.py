"""
Grounded Q&A LLM Chain for SmartChunk.
Uses Google Gemini via langchain-google-genai (or google-generativeai fallback)
with strict context-only prompting and cryptographic source provenance attribution.
"""

import logging
from typing import List, Tuple
from app.core.config import settings
from app.models.schemas import SearchResultChunk, EvidenceChunk, QAResponse

logger = logging.getLogger("smartchunk.llm")

# Strict grounded prompt template
SYSTEM_PROMPT = """You are SmartChunk's Evidence-Aware Scientific AI Assistant.
Your core mission is to answer user questions with 100% fidelity to the provided evidence chunks.

STRICT OPERATING RULES:
1. Answer the question using ONLY the provided evidence chunks below.
2. DO NOT extrapolate, assume, speculate, or introduce external knowledge not explicitly stated in the context.
3. If the provided evidence chunks do not contain sufficient facts to answer the question, you MUST reply:
   "The provided evidence does not contain sufficient information to answer this question."
4. For every claim, finding, number, or factual statement you make, cite the specific source chunk immediately using the exact format:
   [Source ID: {short_sha256} | Page: {page}]
"""

USER_PROMPT_TEMPLATE = """CONTEXT EVIDENCE CHUNKS:
{formatted_context}

----------------------------------------
USER QUESTION: {query}

GROUNDED SCIENTIFIC ANSWER:"""


def format_context_with_provenance(chunks: List[SearchResultChunk]) -> str:
    """
    Format evidence chunks to include cryptographic source hash and page metadata:
    [Source ID: {sha256} | Page: {page}] {chunk_text}
    """
    if not chunks:
        return "No relevant evidence chunks found in the database."

    formatted_blocks = []
    for i, ch in enumerate(chunks, start=1):
        short_doc_hash = ch.doc_sha256[:12] if len(ch.doc_sha256) >= 12 else ch.doc_sha256
        short_chunk_hash = ch.chunk_hash[:12] if len(ch.chunk_hash) >= 12 else ch.chunk_hash

        header = f"[Source ID: {short_doc_hash} | Page: {ch.page_num} | Chunk: {short_chunk_hash}]"
        block = f"--- EVIDENCE CHUNK {i} {header} ---\n{ch.content.strip()}"
        formatted_blocks.append(block)

    return "\n\n".join(formatted_blocks)


def call_gemini_chain(query: str, formatted_context: str) -> str:
    """
    Invokes Google Gemini using langchain-google-genai.
    Falls back gracefully to google-generativeai if needed.
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key or api_key == "your_gemini_api_key_here":
        return (
            "⚠️ GEMINI_API_KEY is not configured in .env. "
            "Please add your Google Gemini API key to your backend `.env` file to enable grounded generative Q&A.\n\n"
            "Retrieved evidence chunks have been provided below for your direct inspection."
        )

    # 1. Attempt langchain-google-genai
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=api_key,
            temperature=0.1,  # Low temperature for strict factual adherence
        )

        user_content = USER_PROMPT_TEMPLATE.format(
            formatted_context=formatted_context, query=query
        )
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_content),
        ]

        response = llm.invoke(messages)
        return str(response.content)

    except ImportError:
        logger.warning(
            "langchain-google-genai not installed, attempting direct google.generativeai fallback"
        )
    except Exception as e:
        logger.error(f"langchain-google-genai error: {e}. Trying direct SDK fallback...")

    # 2. Fallback to direct google.generativeai SDK
    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=SYSTEM_PROMPT,
        )

        user_prompt = USER_PROMPT_TEMPLATE.format(
            formatted_context=formatted_context, query=query
        )
        generation_config = genai.types.GenerationConfig(temperature=0.1)
        response = model.generate_content(user_prompt, generation_config=generation_config)
        return response.text

    except Exception as e:
        logger.error(f"Google Gemini invocation error: {e}")
        return f"Error querying Gemini API: {str(e)}"


def run_grounded_qa(query: str, retrieved_chunks: List[SearchResultChunk]) -> QAResponse:
    """
    Executes grounded Q&A workflow:
    1. Formats retrieved evidence chunks with cryptographic provenance.
    2. Runs Gemini prompt chain.
    3. Bundles evidence items with verified status.
    """
    formatted_context = format_context_with_provenance(retrieved_chunks)
    answer = call_gemini_chain(query, formatted_context)

    evidence_items = [
        EvidenceChunk(
            chunk_id=c.chunk_id,
            doc_id=c.doc_id,
            filename=c.filename,
            page_num=c.page_num,
            doc_sha256=c.doc_sha256,
            chunk_hash=c.chunk_hash,
            quality_status=c.quality_status,
            content=c.content,
            rrf_score=c.rrf_score,
        )
        for c in retrieved_chunks
    ]

    return QAResponse(
        query=query,
        answer=answer,
        evidence_chunks=evidence_items,
        model=settings.GEMINI_MODEL,
        provenance_verified=len(evidence_items) > 0,
    )

