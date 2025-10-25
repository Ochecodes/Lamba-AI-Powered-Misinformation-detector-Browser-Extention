# """Utility helpers for sentiment analysis and source verification.

# This module lazily loads the Hugging Face `transformers` pipeline to avoid
# blocking at import time (downloading a model or initializing backends can
# take a long time or fail when offline). It also handles missing optional
# dependencies gracefully so the FastAPI app can start and return
# informative responses.
# """

# sentiment_pipeline = None
# _transformers_available = False
# _tldextract_available = False

# try:
#     # Try importing transformers and tldextract, but don't initialize heavy
#     # objects at import time.
#     from transformers import pipeline  # type: ignore
#     _transformers_available = True
# except Exception:
#     pipeline = None  # type: ignore
#     _transformers_available = False

# try:
#     import tldextract  # type: ignore
#     _tldextract_available = True
# except Exception:
#     tldextract = None  # type: ignore
#     _tldextract_available = False


# def _get_sentiment_pipeline():
#     """Return a cached sentiment pipeline or initialize it on first use.

#     Returns None if transformers is not available or initialization failed.
#     """
#     global sentiment_pipeline
#     if sentiment_pipeline is not None:
#         return sentiment_pipeline

#     if not _transformers_available:
#         return None

#     try:
#         sentiment_pipeline = pipeline("sentiment-analysis")  # may download models
#         return sentiment_pipeline
#     except Exception:
#         # Failed to initialize (offline, missing backend like torch/tf, etc.)
#         sentiment_pipeline = None
#         return None


# def analyze_sentiment(text: str):
#     """Analyze sentiment for the provided text.

#     If the transformers pipeline isn't available or fails to initialize,
#     return a harmless placeholder result instead of raising.
#     """
#     try:
#         p = _get_sentiment_pipeline()
#         if p is None:
#             return {'label': 'UNKNOWN', 'score': 0.0, 'note': 'transformers pipeline unavailable'}

#         result = p(text[:512])[0]
#         return {
#             'label': result.get('label', 'UNKNOWN'),
#             'score': round(float(result.get('score', 0.0)), 2)
#         }
#     except Exception as e:
#         return {'label': 'ERROR', 'score': 0.0, 'error': str(e)}


# def verify_source(url: str):
#     """Verify whether a URL's domain is in a trusted list.

#     If `tldextract` is not available or parsing fails, return False instead of
#     raising so the API endpoint stays responsive.
#     """
#     try:
#         trusted_domains = ["bbc", "cnn", "reuters", "nytimes", "npr", "aljazeera"]
#         if not url or not _tldextract_available:
#             return False

#         extracted = tldextract.extract(url)
#         domain = (extracted.domain or "").lower()
#         return domain in trusted_domains
#     except Exception:
#         return False
# ...existing code...
"""Utility helpers for sentiment analysis and source verification.

This module lazily loads the Hugging Face `transformers` pipeline to avoid
blocking at import time (downloading a model or initializing backends can
take a long time or fail when offline). It also handles missing optional
dependencies gracefully so the FastAPI app can start and return
informative responses.
"""
from typing import Optional, Dict, Any
import logging
import threading
from urllib.parse import urlparse

# graceful defaults for optional imports
pipeline = None  # transformers.pipeline factory (if available)
tldextract = None

sentiment_pipeline = None  # cached pipeline instance
_transformers_available = False
_tldextract_available = False

# small logger for debugging in server logs
logger = logging.getLogger("backend.utils")

try:
    # Try importing transformers.pipeline factory only
    from transformers import pipeline as _pipeline  # type: ignore
    pipeline = _pipeline
    _transformers_available = True
except Exception as e:
    pipeline = None  # type: ignore
    _transformers_available = False
    logger.debug("transformers not available at import: %s", e)

try:
    import tldextract as _tldextract  # type: ignore
    tldextract = _tldextract
    _tldextract_available = True
except Exception as e:
    tldextract = None  # type: ignore
    _tldextract_available = False
    logger.debug("tldextract not available at import: %s", e)


# protect initialization so concurrent requests don't race
_init_lock = threading.Lock()
_init_started = False


def _get_sentiment_pipeline():
    """Return a cached sentiment pipeline or initialize it on first use.

    Returns None if transformers is not available or initialization failed.
    Initialization is guarded to avoid races.
    """
    global sentiment_pipeline, _init_started
    if sentiment_pipeline is not None:
        return sentiment_pipeline

    if not _transformers_available or pipeline is None:
        return None

    # Ensure only one thread initializes the heavy pipeline
    with _init_lock:
        if sentiment_pipeline is not None:
            return sentiment_pipeline

        try:
            # Attempt to initialize the transformers pipeline.
            # This may download a model on first use and can take time.
            sentiment_pipeline = pipeline("sentiment-analysis")
            _init_started = True
            logger.info("Sentiment pipeline initialized successfully.")
            return sentiment_pipeline
        except Exception as e:
            # Initialization failed (offline, missing backend like torch/tf, etc.)
            sentiment_pipeline = None
            logger.exception("Failed to initialize sentiment pipeline: %s", e)
            return None


def analyze_sentiment(text: str) -> Dict[str, Any]:
    """Analyze sentiment for the provided text.

    If the transformers pipeline isn't available or fails to initialize,
    return a harmless placeholder result instead of raising.
    """
    try:
        if not text:
            return {"label": "UNKNOWN", "score": 0.0, "note": "no text provided"}

        p = _get_sentiment_pipeline()
        if p is None:
            # pipeline unavailable, return informative placeholder
            return {
                "label": "UNKNOWN",
                "score": 0.0,
                "note": "transformers pipeline unavailable or still initializing",
            }

        # pipeline may accept a list or a single string; ensure we pass a string
        result = p(text[:512])
        # pipeline returns a list for a single input
        if isinstance(result, list) and result:
            r = result[0]
        else:
            r = result

        label = r.get("label") if isinstance(r, dict) else getattr(r, "label", "UNKNOWN")
        score = r.get("score") if isinstance(r, dict) else getattr(r, "score", 0.0)

        return {"label": label or "UNKNOWN", "score": round(float(score or 0.0), 2)}
    except Exception as e:
        logger.exception("analyze_sentiment error: %s", e)
        return {"label": "ERROR", "score": 0.0, "error": str(e)}


def _domain_from_url_fallback(url: str) -> str:
    """Fallback domain extractor using urllib if tldextract is unavailable."""
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").split(".")
        # return second-level domain if possible
        if len(hostname) >= 2:
            return hostname[-2].lower()
        return (hostname[0] or "").lower()
    except Exception:
        return ""


def verify_source(url: str) -> bool:
    """Verify whether a URL's domain is in a trusted list.

    If `tldextract` is not available or parsing fails, use a simple fallback
    and return False instead of raising so the API endpoint stays responsive.
    """
    try:
        trusted_domains = {"bbc", "cnn", "reuters", "nytimes", "npr", "aljazeera"}
        if not url:
            return False

        if _tldextract_available and tldextract is not None:
            try:
                extracted = tldextract.extract(url)
                domain = (extracted.domain or "").lower()
            except Exception as e:
                logger.debug("tldextract.extract failed, falling back: %s", e)
                domain = _domain_from_url_fallback(url)
        else:
            domain = _domain_from_url_fallback(url)

        return domain in trusted_domains
    except Exception as e:
        logger.exception("verify_source error: %s", e)
        return False
# ...existing code...