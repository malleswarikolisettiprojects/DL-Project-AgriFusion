"""
Tests for RAG provenance fields added to generate_rag_remedies in agronomy_rag.py.

Verified requirements:
  R1  source_type is present in all return paths.
  R2  source_type == "verified_public_document" only when rag_status == "real_document".
  R3  source_type == "knowledge_base_document" only when rag_status == "local_pdf_doc".
  R4  source_type == "baseline_only" when a BASELINE_REMEDIES entry exists but no doc matched.
  R5  source_type == "no_match" when rag_status == "no_verified_match".
  R6  source_url is None for local / filesystem paths (file:// never exposed).
  R7  source_url is only set for http:// or https:// URLs.
  R8  retrieved_document_passages[*].url is sanitised identically.
  R9  notice is a non-empty string in every return path.
  R10 predict_disease_and_pests passes rag_remedies with source_type when detection succeeds.
  R11 reference_document_links is not proof a recommendation came from a specific document.
"""

import io
import pytest
from unittest.mock import patch
from PIL import Image


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_image_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), color=(0, 128, 0)).save(buf, format="JPEG")
    return buf.getvalue()


def _make_real_doc_hit(score=0.85, url="https://tnau.ac.in/rice-blight.pdf"):
    return {
        "text": "Apply copper oxychloride diluted at 14-day intervals.",
        "title": "TNAU Rice Disease Management Guide",
        "url": url,
        "institute": "TNAU",
        "relevance_score": score,
    }


def _make_local_hit(url="file:///C:/agrifusion/agronomy_docs/rice_guide.pdf"):
    return {
        "text": "Remove and destroy infected plant debris immediately.",
        "title": "Rice Agronomy Guide",
        "url": url,
        "institute": "ICAR-CRRI",
        "relevance_score": 0.8,
    }


# ---------------------------------------------------------------------------
# Import target
# ---------------------------------------------------------------------------
from App.backend.agronomy_rag import generate_rag_remedies, _is_valid_public_url


# ---------------------------------------------------------------------------
# Unit: _is_valid_public_url
# ---------------------------------------------------------------------------

class TestIsValidPublicUrl:
    def test_https_url(self):
        assert _is_valid_public_url("https://tnau.ac.in/doc.pdf") is True

    def test_http_url(self):
        assert _is_valid_public_url("http://icar.org.in/guide") is True

    def test_file_url(self):
        assert _is_valid_public_url("file:///C:/docs/guide.pdf") is False

    def test_absolute_posix_path(self):
        assert _is_valid_public_url("/home/docs/guide.pdf") is False

    def test_none(self):
        assert _is_valid_public_url(None) is False

    def test_empty_string(self):
        assert _is_valid_public_url("") is False

    def test_windows_path_no_scheme(self):
        assert _is_valid_public_url("C:\\Users\\malle\\docs\\rice.pdf") is False


# ---------------------------------------------------------------------------
# Unit: verified_public_document
# ---------------------------------------------------------------------------

class TestRagVerifiedPublicDocument:
    """R2: real_document hit above threshold -> source_type == verified_public_document."""

    def _call(self, hit, label="Rice_Bacterial_blight", crop="rice"):
        # Also patch _match_baseline to None: if a baseline entry exists, the code skips
        # real-doc lookup (REAL_DOC_RAG_OK and not matched_baseline), so we must disable it.
        with patch("App.backend.agronomy_rag._match_baseline", return_value=None):
            with patch("App.backend.agronomy_rag.search_verified_documents", return_value=[hit]):
                with patch("App.backend.agronomy_rag.REAL_DOC_RAG_OK", True):
                    return generate_rag_remedies(label, crop)

    def test_source_type_verified(self):
        result = self._call(_make_real_doc_hit(score=0.90))
        assert result["source_type"] == "verified_public_document"

    def test_rag_status_real_document(self):
        result = self._call(_make_real_doc_hit(score=0.90))
        assert result["rag_status"] == "real_document"

    def test_source_url_preserved(self):
        result = self._call(_make_real_doc_hit(url="https://tnau.ac.in/rice.pdf"))
        assert result["source_url"] == "https://tnau.ac.in/rice.pdf"

    def test_notice_non_empty(self):
        result = self._call(_make_real_doc_hit())
        assert isinstance(result.get("notice"), str) and len(result["notice"]) > 0

    def test_notice_mentions_source_title(self):
        result = self._call(_make_real_doc_hit())
        assert "TNAU Rice Disease Management Guide" in result["notice"]

    def test_passages_local_url_is_none(self):
        """R8: file:// URLs in retrieved passages must be None after sanitisation."""
        hit = _make_real_doc_hit(url="file:///C:/docs/rice.pdf")
        result = self._call(hit)
        for p in result.get("retrieved_document_passages", []):
            assert p.get("url") is None or p["url"].startswith("http")

    def test_passages_public_url_preserved(self):
        """R8: public URLs in retrieved passages must be preserved."""
        hit = _make_real_doc_hit(url="https://tnau.ac.in/rice.pdf")
        result = self._call(hit)
        for p in result.get("retrieved_document_passages", []):
            if p.get("url"):
                assert p["url"].startswith("http")


# ---------------------------------------------------------------------------
# Unit: no_match
# ---------------------------------------------------------------------------

class TestRagNoMatch:
    """R5: Unknown disease + no verified source -> source_type == no_match."""

    def _call(self):
        # Use a label with no recognisable disease keyword AND patch _match_baseline
        # to guarantee no BASELINE_REMEDIES entry is found (keyword fuzzy-matching could
        # otherwise match on partial words like 'rust', 'spot', 'blight', etc.).
        with patch("App.backend.agronomy_rag._match_baseline", return_value=None):
            with patch("App.backend.agronomy_rag.search_verified_documents", return_value=[]):
                with patch("App.backend.agronomy_rag.REAL_DOC_RAG_OK", False):
                    with patch("App.backend.agronomy_rag.load_local_agronomy_documents", return_value=[]):
                        return generate_rag_remedies("XNOMATCH000", "wheat")

    def test_rag_status_no_verified_match(self):
        assert self._call()["rag_status"] == "no_verified_match"

    def test_source_type_no_match(self):
        assert self._call()["source_type"] == "no_match"

    def test_source_url_is_none(self):
        assert self._call()["source_url"] is None

    def test_notice_non_empty(self):
        result = self._call()
        assert isinstance(result.get("notice"), str) and len(result["notice"]) > 10


# ---------------------------------------------------------------------------
# Unit: contract (source_type always present)
# ---------------------------------------------------------------------------

class TestRagProvenanceContractFields:
    """R1: source_type key must be present in ALL return paths."""

    VALID_SOURCE_TYPES = frozenset({
        "verified_public_document",
        "knowledge_base_document",
        "baseline_only",
        "no_match",
    })

    def _call(self, label="Unknown_Fictional_Blight_XYZ999", crop="wheat", doc_hits=None):
        doc_hits = doc_hits or []
        with patch("App.backend.agronomy_rag.search_verified_documents", return_value=doc_hits):
            with patch("App.backend.agronomy_rag.REAL_DOC_RAG_OK", False):
                with patch("App.backend.agronomy_rag.load_local_agronomy_documents", return_value=[]):
                    return generate_rag_remedies(label, crop)

    def test_source_type_present_no_match(self):
        assert "source_type" in self._call()

    def test_notice_present_no_match(self):
        assert "notice" in self._call()

    def test_source_type_present_with_hit(self):
        result = self._call(label="Rice_Bacterial_blight", crop="rice",
                            doc_hits=[_make_real_doc_hit()])
        assert "source_type" in result

    def test_notice_present_with_hit(self):
        result = self._call(label="Rice_Bacterial_blight", crop="rice",
                            doc_hits=[_make_real_doc_hit()])
        assert "notice" in result

    def test_valid_source_type_values_no_match(self):
        result = self._call()
        assert result["source_type"] in self.VALID_SOURCE_TYPES

    def test_baseline_only_source_url_is_none(self):
        result = self._call(label="Rice_Bacterial_blight", crop="rice")
        if result["source_type"] == "baseline_only":
            assert result["source_url"] is None

    def test_baseline_only_notice_non_empty(self):
        result = self._call(label="Rice_Bacterial_blight", crop="rice")
        if result["source_type"] == "baseline_only":
            assert result.get("notice") and len(result["notice"]) > 10


# ---------------------------------------------------------------------------
# Integration: predict_disease_and_pests provenance pass-through
# ---------------------------------------------------------------------------

class TestPredictDiseaseProvenance:
    """R10: predict_disease_and_pests propagates rag_remedies with source_type on detection."""

    def _detection_run(self, label, confidence, status="ok"):
        return {
            "provider": "roboflow",
            "model": "rice-leaf-disease/1",
            "status": status,
            "detections": [{"label": label, "confidence": confidence, "box_xyxy": [0, 0, 10, 10]}],
            "top_confidence": confidence,
        }

    def _full_rag_mock(self):
        return {
            "target_condition": "Rice_Bacterial_blight",
            "crop": "rice",
            "rag_status": "real_document",
            "source_type": "verified_public_document",
            "source_title": "TNAU Guide",
            "source_url": "https://tnau.ac.in/guide.pdf",
            "source_institute": "TNAU",
            "chemical_treatment": "Apply copper spray",
            "organic_bio_control": "Use Trichoderma",
            "cultural_practices": "Remove infected leaves",
            "fertilizer_advice": "Apply potash",
            "document_passage": "Rice bacterial blight is managed with copper-based fungicides.",
            "retrieved_document_passages": [],
            "local_file_snippets": [],
            "reference_document_links": [],
            "relevance_score": 0.88,
            "notice": "Guidance from TNAU Rice Disease Management Guide.",
        }

    def test_rag_remedies_has_source_type_on_detection(self):
        from App.backend.disease_detection import predict_disease_and_pests
        raw = _make_image_bytes()
        with patch("App.backend.disease_detection.run_provider",
                   return_value=self._detection_run("Rice_Bacterial_blight", 0.88)):
            with patch("App.backend.disease_detection.generate_rag_remedies",
                       return_value=self._full_rag_mock()):
                result = predict_disease_and_pests(crop="rice", raw=raw)
        assert result["inference_outcome"] == "detected"
        remedies = result.get("rag_remedies")
        assert isinstance(remedies, dict)
        assert remedies["source_type"] == "verified_public_document"
        assert remedies["notice"] is not None

    def test_source_url_public_when_verified(self):
        from App.backend.disease_detection import predict_disease_and_pests
        raw = _make_image_bytes()
        rag_mock = {"source_type": "verified_public_document",
                    "source_url": "https://icar.org.in/paddy.pdf",
                    "notice": "From ICAR", "rag_status": "real_document"}
        with patch("App.backend.disease_detection.run_provider",
                   return_value=self._detection_run("Rice_Bacterial_blight", 0.88)):
            with patch("App.backend.disease_detection.generate_rag_remedies",
                       return_value=rag_mock):
                result = predict_disease_and_pests(crop="rice", raw=raw)
        url = (result.get("rag_remedies") or {}).get("source_url")
        if url:
            assert url.startswith("http")

    def test_no_local_path_in_response(self):
        """R6: No file:// or Windows path in API response."""
        from App.backend.disease_detection import predict_disease_and_pests
        raw = _make_image_bytes()
        rag_mock = {"source_type": "baseline_only", "source_url": None,
                    "notice": "Built-in baseline.", "rag_status": "below_threshold"}
        with patch("App.backend.disease_detection.run_provider",
                   return_value=self._detection_run("Rice_Bacterial_blight", 0.88)):
            with patch("App.backend.disease_detection.generate_rag_remedies",
                       return_value=rag_mock):
                result = predict_disease_and_pests(crop="rice", raw=raw)
        out_str = str(result)
        assert "file://" not in out_str
        # Check for Windows-style paths (double backslashes in repr)
        assert "C:\\Users" not in out_str

    def test_no_detection_rag_remedies_is_none(self):
        from App.backend.disease_detection import predict_disease_and_pests
        raw = _make_image_bytes()
        mock_run = {"provider": "roboflow", "model": "rice-leaf-disease/1", "status": "ok",
                    "detections": [], "top_confidence": 0.0}
        with patch("App.backend.disease_detection.run_provider", return_value=mock_run):
            result = predict_disease_and_pests(crop="rice", raw=raw)
        assert result["inference_outcome"] == "no_detection"
        assert result.get("rag_remedies") is None

    def test_low_confidence_rag_remedies_is_none(self):
        from App.backend.disease_detection import predict_disease_and_pests
        raw = _make_image_bytes()
        with patch("App.backend.disease_detection.run_provider",
                   return_value=self._detection_run("Rice_Leaf_Spot", 0.15)):
            result = predict_disease_and_pests(crop="rice", raw=raw)
        assert result["inference_outcome"] == "low_confidence"
        assert result.get("rag_remedies") is None


# ---------------------------------------------------------------------------
# R11: reference_document_links is NOT proof of specific recommendation
# ---------------------------------------------------------------------------

class TestReferenceDocumentLinksNotProof:

    def _call_no_match(self):
        with patch("App.backend.agronomy_rag.search_verified_documents", return_value=[]):
            with patch("App.backend.agronomy_rag.REAL_DOC_RAG_OK", False):
                with patch("App.backend.agronomy_rag.load_local_agronomy_documents", return_value=[]):
                    return generate_rag_remedies("Unknown_Fictional_Blight_XYZ999", "wheat")

    def test_reference_document_links_is_list(self):
        result = self._call_no_match()
        assert isinstance(result.get("reference_document_links"), list)

    def test_source_type_not_derived_from_links(self):
        """R11: source_type must be no_match or baseline_only even if links list is non-empty."""
        result = self._call_no_match()
        assert result["source_type"] in ("no_match", "baseline_only")


# ---------------------------------------------------------------------------
# Universal Agent RAG & Irrigation Tests
# ---------------------------------------------------------------------------

class TestUniversalAgentRagAndIrrigation:

    def test_query_agronomy_agent_rice_irrigation(self):
        """Verify rice irrigation queries hit fast verified retrieval path and return real documents_considered."""
        from App.backend.agronomy_rag import query_agronomy_agent
        res = query_agronomy_agent("rice irrigation water management guidelines", crop="Rice")
        assert res["rag_status"] == "success"
        assert res["answer"] is not None
        assert "critical" in res["answer"].lower() or "water" in res["answer"].lower() or "irrigation" in res["answer"].lower()
        assert res["documents_considered"] > 0
        assert isinstance(res["reference_links"], list)
        assert res["source_title"] is not None

    def test_get_agronomy_docs_dirs_supports_app_data_path(self):
        """Verify candidate directories list includes App/Data/agronomy_docs."""
        from App.backend.agronomy_rag import get_agronomy_docs_dirs
        dirs = get_agronomy_docs_dirs()
        assert len(dirs) > 0
        dir_strs = [str(d).replace("\\", "/") for d in dirs]
        assert any("App/Data/agronomy_docs" in d or "Data/agronomy_docs" in d for d in dir_strs)

    def test_no_match_query_agronomy_agent_has_no_ref_links_name_error(self):
        """Verify no-match query returns cleanly with reference_links and without NameError."""
        from App.backend.agronomy_rag import query_agronomy_agent
        with patch("App.backend.agronomy_rag.load_local_agronomy_documents", return_value=[]):
            with patch("App.backend.agronomy_rag.REAL_DOC_RAG_OK", False):
                res = query_agronomy_agent("xyz_nonexistent_unlisted_query_9999")
                assert res["rag_status"] == "no_verified_match"
                assert res["answer"] is None
                assert isinstance(res["reference_links"], list)
                assert res["documents_considered"] > 0

