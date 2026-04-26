import uuid
import tempfile
import os
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from pypdf import PdfReader
from db.database import get_db, Document
from ml.classifier import classify_document
from ml import rag

router = APIRouter()


def _extract_text(file_path: str, filename: str) -> str:
    if filename.lower().endswith(".pdf"):
        reader = PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    else:
        with open(file_path, encoding="utf-8", errors="ignore") as f:
            return f.read()


@router.post("/upload")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = file.filename.lower().rsplit(".", 1)[-1]
    if ext not in ("pdf", "txt"):
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")

    contents = await file.read()
    size_bytes = len(contents)

    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        text = _extract_text(tmp_path, file.filename)
    finally:
        os.unlink(tmp_path)

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from this file.")

    result = classify_document(text)

    doc_id = str(uuid.uuid4())
    chunk_count = rag.index_document(doc_id, result["type"], text)

    doc = Document(
        id=doc_id,
        filename=file.filename,
        doc_type=result["type"],
        confidence=result["confidence"],
        summary=result["summary"],
        size_bytes=size_bytes,
    )
    db.add(doc)
    db.commit()

    return {
        "id": doc_id,
        "filename": file.filename,
        "doc_type": result["type"],
        "confidence": result["confidence"],
        "summary": result["summary"],
        "chunks_indexed": chunk_count,
        "size_bytes": size_bytes,
    }
