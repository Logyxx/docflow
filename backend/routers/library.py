from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from db.database import get_db, Document

router = APIRouter()

VALID_TYPES = {"contract", "report", "invoice", "policy"}


@router.get("/documents")
def list_documents(
    doc_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(Document)
    if doc_type and doc_type in VALID_TYPES:
        q = q.filter(Document.doc_type == doc_type)
    docs = q.order_by(Document.uploaded_at.desc()).all()

    return [
        {
            "id": d.id,
            "filename": d.filename,
            "type": d.doc_type,
            "confidence": d.confidence,
            "summary": d.summary,
            "uploaded_at": d.uploaded_at.isoformat(),
            "size_bytes": d.size_bytes,
        }
        for d in docs
    ]


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        return {"detail": "Not found"}
    db.delete(doc)
    db.commit()

    from ml.rag import remove_document
    remove_document(doc_id)

    return {"deleted": doc_id}
