"""
AgriFusion - Real Document RAG Fetcher
Fetches, caches and chunks actual documents from verified government/institute sources.
Sources: TNAU Agritech Portal, ICAR, FAO, NIPHM
Documents are cached as .txt files in Data/agronomy_docs/ and refreshed every 30 days.
"""

import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

# --- Runtime imports (graceful fallback if not installed) ---
try:
    import requests
    REQUESTS_OK = True
except ImportError:
    REQUESTS_OK = False

try:
    from bs4 import BeautifulSoup
    BS4_OK = True
except ImportError:
    BS4_OK = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    SKLEARN_OK = True
except ImportError:
    SKLEARN_OK = False

BASE_DIR = Path(__file__).resolve().parents[2]
DOCS_DIR = BASE_DIR / "Data" / "agronomy_docs"
DOCS_DIR.mkdir(parents=True, exist_ok=True)

CACHE_META_FILE = DOCS_DIR / "_cache_meta.json"
CACHE_MAX_AGE_DAYS = 30

# ============================================================
# VERIFIED GOVERNMENT / INSTITUTE DOCUMENT SOURCES
# ============================================================
VERIFIED_SOURCES: List[Dict] = [
    {
        "id": "tnau_paddy",
        "title": "TNAU Agritech - Paddy Disease & Pest Management",
        "url": "https://agritech.tnau.ac.in/crop_protection/crop_prot_cropDisease_cereals_paddy.html",
        "tags": ["rice", "paddy", "blast", "blight", "sheath blight", "bacterial leaf blight", "brown planthopper", "stem borer"],
        "institute": "Tamil Nadu Agricultural University (TNAU)",
    },
    {
        "id": "tnau_maize",
        "title": "TNAU Agritech - Maize Disease & Pest Management",
        "url": "https://agritech.tnau.ac.in/crop_protection/crop_prot_cropDisease_cereals_maize.html",
        "tags": ["maize", "corn", "northern leaf blight", "stem borer", "downy mildew", "fall armyworm"],
        "institute": "Tamil Nadu Agricultural University (TNAU)",
    },
    {
        "id": "tnau_cotton",
        "title": "TNAU Agritech - Cotton Disease & Pest Management",
        "url": "https://agritech.tnau.ac.in/crop_protection/crop_prot_cropDisease_fibre_cotton.html",
        "tags": ["cotton", "bollworm", "helicoverpa", "wilt", "leaf curl", "mealybug", "whitefly"],
        "institute": "Tamil Nadu Agricultural University (TNAU)",
    },
    {
        "id": "tnau_banana",
        "title": "TNAU Agritech - Banana Disease & Pest Management",
        "url": "https://agritech.tnau.ac.in/crop_protection/crop_prot_cropDisease_fruits_banana.html",
        "tags": ["banana", "sigatoka", "panama wilt", "bunchy top", "weevil", "nematode"],
        "institute": "Tamil Nadu Agricultural University (TNAU)",
    },
    {
        "id": "tnau_tomato",
        "title": "TNAU Agritech - Tomato Disease & Pest Management",
        "url": "https://agritech.tnau.ac.in/crop_protection/crop_prot_cropDisease_vegetables_tomato.html",
        "tags": ["tomato", "early blight", "late blight", "mosaic", "leaf curl", "whitefly", "aphid"],
        "institute": "Tamil Nadu Agricultural University (TNAU)",
    },
    {
        "id": "tnau_chilli",
        "title": "TNAU Agritech - Chilli / Pepper Disease & Pest Management",
        "url": "https://agritech.tnau.ac.in/crop_protection/crop_prot_cropDisease_vegetables_chilly.html",
        "tags": ["chilli", "pepper", "anthracnose", "die back", "thrips", "mite", "mosaic"],
        "institute": "Tamil Nadu Agricultural University (TNAU)",
    },
    {
        "id": "tnau_groundnut",
        "title": "TNAU Agritech - Groundnut Disease & Pest Management",
        "url": "https://agritech.tnau.ac.in/crop_protection/crop_prot_cropDisease_oilseeds_groundnut.html",
        "tags": ["groundnut", "peanut", "tikka disease", "leaf spot", "rust", "aphid", "stem borer"],
        "institute": "Tamil Nadu Agricultural University (TNAU)",
    },
    {
        "id": "tnau_ipm_general",
        "title": "TNAU Agritech - Integrated Pest Management Overview",
        "url": "https://agritech.tnau.ac.in/crop_protection/crop_prot.html",
        "tags": ["ipm", "pesticide", "bio-control", "pheromone trap", "neem", "trichoderma", "biological control"],
        "institute": "Tamil Nadu Agricultural University (TNAU)",
    },
    {
        "id": "tnau_nutrient",
        "title": "TNAU Agritech - Nutrient Deficiency Symptoms & Management",
        "url": "https://agritech.tnau.ac.in/crop_production/crop_manure_ferti_nutri_defic.html",
        "tags": ["nutrient deficiency", "nitrogen", "phosphorus", "potassium", "zinc", "iron", "boron", "magnesium"],
        "institute": "Tamil Nadu Agricultural University (TNAU)",
    },
    {
        "id": "niphm_pesticide",
        "title": "NIPHM - National Institute of Plant Health Management",
        "url": "https://niphm.gov.in/",
        "tags": ["pesticide", "bio-pesticide", "ipm", "plant health", "approved chemical"],
        "institute": "NIPHM, Ministry of Agriculture & Farmers Welfare, India",
    },
    {
        "id": "icar_home",
        "title": "ICAR - Indian Council of Agricultural Research",
        "url": "https://icar.org.in/",
        "tags": ["icar", "crop research", "fertilizer", "soil health", "variety", "technology"],
        "institute": "Indian Council of Agricultural Research (ICAR)",
    },
    {
        "id": "fao_ipm",
        "title": "FAO - International Pest & Pesticide Management",
        "url": "https://www.fao.org/pest-and-pesticide-management/en/",
        "tags": ["fao", "international", "integrated pest management", "pesticide", "sustainable", "bio-control"],
        "institute": "Food and Agriculture Organization (FAO), United Nations",
    },
]


# ============================================================
# CACHE MANAGEMENT
# ============================================================

def _load_cache_meta() -> Dict:
    if CACHE_META_FILE.exists():
        try:
            return json.loads(CACHE_META_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_cache_meta(meta: Dict):
    CACHE_META_FILE.write_text(json.dumps(meta, indent=2), encoding="utf-8")


def _is_cache_fresh(doc_id: str) -> bool:
    cache_file = DOCS_DIR / f"{doc_id}.txt"
    if not cache_file.exists() or cache_file.stat().st_size < 200:
        return False
    meta = _load_cache_meta()
    if doc_id not in meta:
        return True
    fetched_at = meta[doc_id].get("fetched_at", "")
    try:
        dt = datetime.fromisoformat(fetched_at)
        age_days = (datetime.now(timezone.utc) - dt.replace(tzinfo=timezone.utc)).days
        return age_days < CACHE_MAX_AGE_DAYS
    except Exception:
        return True


def _cache_doc(doc_id: str, text: str):
    cache_file = DOCS_DIR / f"{doc_id}.txt"
    cache_file.write_text(text, encoding="utf-8")
    meta = _load_cache_meta()
    meta[doc_id] = {"fetched_at": datetime.now(timezone.utc).isoformat()}
    _save_cache_meta(meta)


def _load_cached_doc(doc_id: str) -> Optional[str]:
    cache_file = DOCS_DIR / f"{doc_id}.txt"
    if cache_file.exists():
        try:
            return cache_file.read_text(encoding="utf-8")
        except Exception:
            pass
    return None


# ============================================================
# DOCUMENT FETCHER
# ============================================================

def _fetch_url_text(url: str, timeout: int = 2) -> Optional[str]:
    """Fetch a URL and extract clean readable text using BeautifulSoup."""
    if not REQUESTS_OK or not BS4_OK:
        return None
    try:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except Exception:
        pass
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        }
        resp = requests.get(url, headers=headers, timeout=timeout, verify=False)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        # Remove nav, header, footer, scripts, styles
        for tag in soup(["nav", "header", "footer", "script", "style", "noscript", "aside"]):
            tag.decompose()
        # Get main content
        main = soup.find("main") or soup.find("article") or soup.find("div", class_=re.compile(r"content|main|body", re.I))
        text_source = main if main else soup.body if soup.body else soup
        text = text_source.get_text(separator="\n", strip=True)
        # Clean up excessive whitespace
        lines = [ln.strip() for ln in text.splitlines() if len(ln.strip()) > 20]
        return "\n".join(lines)
    except Exception as e:
        print(f"[RAG Fetcher] Could not fetch {url}: {e}")
        return None


def fetch_and_cache_document(source: Dict) -> Optional[str]:
    """Return cached doc text, fetching from URL if cache is stale."""
    doc_id = source["id"]
    if _is_cache_fresh(doc_id):
        return _load_cached_doc(doc_id)
    print(f"[RAG Fetcher] Fetching: {source['title']} ...")
    text = _fetch_url_text(source["url"])
    if text and len(text) > 200:
        _cache_doc(doc_id, text)
        return text
    # If fetch fails but we have a stale cache, use it
    stale = _load_cached_doc(doc_id)
    if stale:
        print(f"[RAG Fetcher] Using stale cache for {doc_id}")
        return stale
    return None


from concurrent.futures import ThreadPoolExecutor, as_completed

def load_all_verified_documents(max_sources: int = 12) -> List[Dict]:
    """
    Load text from all verified government/institute sources.
    Includes both preconfigured static sources and dynamic canonical sources registered by admins.
    Returns list of {id, title, url, institute, text, tags}.
    Fetches in parallel threads for high performance.
    """
    sources_to_fetch = list(VERIFIED_SOURCES)

    # Dynamically pull active, verified canonical sources registered by admins from frontend UI
    try:
        from App.backend.database.sources_db import fetch_knowledge_sources_list
        reg_data = fetch_knowledge_sources_list(page=1, page_size=50)
        reg_items = reg_data.get("items", [])
        for item in reg_items:
            v_stat = item.get("verification_status")
            if item.get("is_active") and v_stat in ("verified", "verified_with_caveats"):
                url = item.get("official_url")
                if url and (url.startswith("http://") or url.startswith("https://")):
                    sources_to_fetch.append({
                        "id": f"dyn_{item.get('id')}",
                        "title": item.get("title") or "Canonical Knowledge Source",
                        "url": url,
                        "tags": [item.get("crop") or "crop", item.get("subject") or "agronomy", item.get("organization") or "official"],
                        "institute": item.get("organization") or "Agricultural Authority",
                    })
    except Exception as e:
        print(f"[RAG Fetcher] Could not pull dynamic registry sources: {e}")

    sources_to_fetch = sources_to_fetch[:max_sources]
    loaded = []

    def _worker(src):
        text = fetch_and_cache_document(src)
        if text:
            return {
                "id": src["id"],
                "title": src["title"],
                "url": src["url"],
                "institute": src["institute"],
                "tags": src["tags"],
                "text": text,
            }
        return None

    try:
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(_worker, s) for s in sources_to_fetch]
            for future in as_completed(futures):
                res = future.result()
                if res:
                    loaded.append(res)
    except Exception as e:
        print(f"[RAG Fetcher] Parallel fetch error: {e}")
        # Fallback sequential
        for source in sources_to_fetch:
            text = fetch_and_cache_document(source)
            if text:
                loaded.append({
                    "id": source["id"],
                    "title": source["title"],
                    "url": source["url"],
                    "institute": source["institute"],
                    "tags": source["tags"],
                    "text": text,
                })

    return loaded


# ============================================================
# DOCUMENT CHUNKER
# ============================================================

def chunk_document(doc: Dict, chunk_size: int = 250, overlap: int = 50) -> List[Dict]:
    """Split document text into overlapping word-level chunks."""
    words = doc["text"].split()
    chunks = []
    step = chunk_size - overlap
    for i in range(0, len(words), step):
        chunk_words = words[i : i + chunk_size]
        chunk_text = " ".join(chunk_words)
        if len(chunk_text) > 80:
            chunks.append({
                "doc_id": doc["id"],
                "title": doc["title"],
                "url": doc["url"],
                "institute": doc["institute"],
                "text": chunk_text,
            })
    return chunks


# ============================================================
# TF-IDF SEARCH
# ============================================================

def tfidf_search(
    query: str,
    chunks: List[Dict],
    top_k: int = 3,
    min_score: float = 0.05,
) -> List[Dict]:
    """
    Return top_k most relevant chunks for the query using TF-IDF cosine similarity.
    Falls back to keyword matching if sklearn is not installed.
    """
    if not chunks:
        return []

    if SKLEARN_OK:
        try:
            texts = [c["text"] for c in chunks]
            vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", max_features=5000)
            tfidf_matrix = vectorizer.fit_transform(texts + [query])
            doc_matrix = tfidf_matrix[:-1]
            query_vec = tfidf_matrix[-1]
            scores = cosine_similarity(query_vec, doc_matrix).flatten()
            top_indices = np.argsort(scores)[::-1][:top_k]
            results = []
            for idx in top_indices:
                if scores[idx] >= min_score:
                    results.append({**chunks[idx], "relevance_score": float(scores[idx])})
            return results
        except Exception:
            pass

    # Fallback: simple keyword count matching
    query_words = set(query.lower().split())
    scored = []
    for chunk in chunks:
        chunk_lower = chunk["text"].lower()
        score = sum(1 for w in query_words if w in chunk_lower)
        if score > 0:
            scored.append({**chunk, "relevance_score": score})
    scored.sort(key=lambda x: x["relevance_score"], reverse=True)
    return scored[:top_k]


# ============================================================
# PUBLIC API
# ============================================================

def search_verified_documents(
    disease_label: str,
    crop: str = "",
    top_k: int = 3,
) -> List[Dict]:
    """
    Main entry point: search all verified government documents for
    the most relevant passages about a detected disease/pest/nutrient deficiency.
    Returns list of {text, title, url, institute, relevance_score}.
    """
    query = f"{disease_label} {crop} management treatment control remedy pesticide".strip()

    docs = load_all_verified_documents(max_sources=len(VERIFIED_SOURCES))
    all_chunks: List[Dict] = []
    for doc in docs:
        all_chunks.extend(chunk_document(doc))

    return tfidf_search(query, all_chunks, top_k=top_k)


def get_source_metadata() -> List[Dict]:
    """Return metadata for all verified sources (for displaying reference links in UI)."""
    return [
        {
            "title": s["title"],
            "url": s["url"],
            "institute": s["institute"],
            "tags": s["tags"],
        }
        for s in VERIFIED_SOURCES
    ]
