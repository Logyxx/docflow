"""
RAG layer: per-document FAISS indexes + Groq generation.
corpus_index maps doc_id → (vectorstore, doc_type)
"""
import os
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter

EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
_embeddings = None
corpus_index: dict[str, tuple] = {}

SPLITTER = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)

RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a document intelligence assistant. Answer the question using ONLY the document excerpts below.
If the answer is not in the excerpts, say "I couldn't find that in the indexed documents."
Be concise and cite which document type the information comes from.

Document excerpts:
{context}"""),
    ("human", "{question}"),
])


def _get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name=EMBED_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


def index_document(doc_id: str, doc_type: str, text: str) -> int:
    """Chunk, embed, and store document in corpus_index. Returns chunk count."""
    chunks = SPLITTER.create_documents([text])
    if not chunks:
        return 0
    vectorstore = FAISS.from_documents(chunks, _get_embeddings())
    corpus_index[doc_id] = (vectorstore, doc_type)
    return len(chunks)


def remove_document(doc_id: str):
    corpus_index.pop(doc_id, None)


def query_corpus(question: str, filter_type: str | None = None) -> str:
    """Search relevant documents and generate a grounded answer via Groq."""
    if not corpus_index:
        return "No documents have been indexed yet. Upload some documents first."

    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        return "GROQ_API_KEY is not set — cannot generate answer."

    # Select which indexes to search
    targets = {
        doc_id: (vs, dt)
        for doc_id, (vs, dt) in corpus_index.items()
        if filter_type is None or dt == filter_type
    }

    if not targets:
        return f"No {filter_type} documents indexed. Upload some first."

    # Retrieve top chunks from each matching document
    all_chunks = []
    for doc_id, (vs, doc_type) in targets.items():
        try:
            results = vs.similarity_search(question, k=3)
            for r in results:
                all_chunks.append(f"[{doc_type.upper()}]\n{r.page_content}")
        except Exception:
            continue

    if not all_chunks:
        return "Could not retrieve relevant content."

    context = "\n\n---\n\n".join(all_chunks[:8])

    llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0.1, max_tokens=512)
    chain = RAG_PROMPT | llm | StrOutputParser()
    return chain.invoke({"question": question, "context": context})
