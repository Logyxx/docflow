"""
RAG layer: in-memory chunk store + Groq generation.
No external embedding API needed — chunks are stored as plain text
and retrieved by simple keyword overlap. Reliable on Render free tier.
"""
import os
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter

corpus_store: dict[str, dict] = {}  # doc_id → {doc_type, chunks: list[str]}

SPLITTER = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)

RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a document intelligence assistant. Answer the question using ONLY the document excerpts below.
If the answer is not in the excerpts, say "I couldn't find that in the indexed documents."
Be concise and cite which document type the information comes from.

Document excerpts:
{context}"""),
    ("human", "{question}"),
])


def _score_chunk(chunk: str, question: str) -> int:
    q_words = set(question.lower().split())
    return sum(1 for w in q_words if w in chunk.lower())


def index_document(doc_id: str, doc_type: str, text: str) -> int:
    docs = SPLITTER.create_documents([text])
    chunks = [d.page_content for d in docs]
    corpus_store[doc_id] = {"doc_type": doc_type, "chunks": chunks}
    return len(chunks)


def remove_document(doc_id: str):
    corpus_store.pop(doc_id, None)


def query_corpus(question: str, filter_type: str | None = None) -> dict:
    if not corpus_store:
        return {"answer": "No documents have been indexed yet. Upload some documents first.", "sources": []}

    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        return {"answer": "GROQ_API_KEY is not set.", "sources": []}

    targets = {
        doc_id: entry
        for doc_id, entry in corpus_store.items()
        if filter_type is None or entry["doc_type"] == filter_type
    }

    if not targets:
        return {"answer": f"No {filter_type} documents indexed. Upload some first.", "sources": []}

    all_chunks = []
    for entry in targets.values():
        doc_type = entry["doc_type"]
        scored = sorted(entry["chunks"], key=lambda c: _score_chunk(c, question), reverse=True)
        for chunk in scored[:3]:
            all_chunks.append((doc_type, chunk, _score_chunk(chunk, question)))

    all_chunks.sort(key=lambda x: x[2], reverse=True)
    top_chunks = all_chunks[:8]

    if not top_chunks:
        return {"answer": "Could not retrieve relevant content.", "sources": []}

    context = "\n\n---\n\n".join(f"[{dt.upper()}]\n{chunk}" for dt, chunk, _ in top_chunks)
    sources = list(dict.fromkeys(dt for dt, _, _ in top_chunks))

    llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0.1, max_tokens=512)
    chain = RAG_PROMPT | llm | StrOutputParser()
    answer = chain.invoke({"question": question, "context": context})

    return {"answer": answer, "sources": sources}
