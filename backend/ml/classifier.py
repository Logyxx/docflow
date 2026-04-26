"""
Document classifier using HF Inference API (zero-shot with bart-large-mnli).
Swap CLASSIFIER_MODEL to 'lakshmenroy/docflow-classifier' once fine-tuned on Colab.
"""
import os
import requests

CLASSIFIER_MODEL = "lakshmenroy/docflow-classifier"
HF_API_URL = f"https://api-inference.huggingface.co/models/{CLASSIFIER_MODEL}"

SUMMARIES = {
    "contract": "Legal agreement document — contains obligations, terms, and parties.",
    "report":   "Analytical or informational document — summarises findings or data.",
    "invoice":  "Billing document — itemised charges or payment request.",
    "policy":   "Rules or guidelines document — defines procedures or compliance requirements.",
}


def classify_document(text: str) -> dict:
    """
    Returns {"type": str, "confidence": float, "summary": str}
    Falls back to keyword heuristic if HF API is unavailable.
    """
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        return _heuristic_classify(text)

    try:
        response = requests.post(
            HF_API_URL,
            headers={"Authorization": f"Bearer {hf_token}"},
            json={"inputs": text[:512]},
            timeout=30,
        )
        if response.status_code != 200:
            return _heuristic_classify(text)

        result = response.json()
        # Sequence classifier returns [[{label, score}, ...]]
        scores = sorted(result[0], key=lambda x: x["score"], reverse=True)
        doc_type = scores[0]["label"]
        confidence = round(scores[0]["score"], 4)
        return {
            "type": doc_type,
            "confidence": confidence,
            "summary": SUMMARIES[doc_type],
        }
    except Exception:
        return _heuristic_classify(text)


def _heuristic_classify(text: str) -> dict:
    """Keyword fallback when HF API is unavailable."""
    text_lower = text.lower()
    scores = {
        "contract":  sum(text_lower.count(k) for k in ["agreement", "party", "clause", "hereby", "obligations", "terms and conditions", "signed"]),
        "report":    sum(text_lower.count(k) for k in ["summary", "findings", "analysis", "conclusion", "methodology", "results", "figure"]),
        "invoice":   sum(text_lower.count(k) for k in ["invoice", "amount due", "payment", "bill to", "total", "vat", "quantity"]),
        "policy":    sum(text_lower.count(k) for k in ["policy", "procedure", "compliance", "shall", "must", "prohibited", "guideline"]),
    }
    doc_type = max(scores, key=scores.get)
    top = scores[doc_type]
    total = sum(scores.values()) or 1
    return {
        "type": doc_type,
        "confidence": round(min(top / total, 0.95), 4) if top > 0 else 0.5,
        "summary": SUMMARIES[doc_type],
    }
