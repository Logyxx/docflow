from fastapi import APIRouter
from pydantic import BaseModel
from ml.rag import query_corpus

router = APIRouter()

VALID_TYPES = {"contract", "report", "invoice", "policy"}


class QueryRequest(BaseModel):
    question: str
    filter_type: str | None = None


@router.post("/query")
def query_documents(req: QueryRequest):
    if not req.question.strip():
        return {"answer": "Please provide a question."}

    filter_type = req.filter_type
    if filter_type and filter_type not in VALID_TYPES:
        filter_type = None

    result = query_corpus(req.question, filter_type)
    return {"answer": result["answer"], "sources": result.get("sources", []), "filter_applied": filter_type}
