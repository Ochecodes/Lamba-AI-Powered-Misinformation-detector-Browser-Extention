"""Utility helpers for sentiment analysis and source verification.

This module lazily loads the Hugging Face `transformers` pipeline to avoid
blocking at import time (downloading a model or initializing backends can
take a long time or fail when offline). It also handles missing optional
dependencies gracefully so the FastAPI app can start and return
informative responses.
"""

sentiment_pipeline = None
_transformers_available = False
_tldextract_available = False

try:
    # Try importing transformers and tldextract, but don't initialize heavy
    # objects at import time.
    from transformers import pipeline  # type: ignore
    _transformers_available = True
except Exception:
    pipeline = None  # type: ignore
    _transformers_available = False

try:
    import tldextract  # type: ignore
    _tldextract_available = True
except Exception:
    tldextract = None  # type: ignore
    _tldextract_available = False


def _get_sentiment_pipeline():
    """Return a cached sentiment pipeline or initialize it on first use.

    Returns None if transformers is not available or initialization failed.
    """
    global sentiment_pipeline
    if sentiment_pipeline is not None:
        return sentiment_pipeline

    if not _transformers_available:
        return None

    try:
        sentiment_pipeline = pipeline("sentiment-analysis")  # may download models
        return sentiment_pipeline
    except Exception:
        # Failed to initialize (offline, missing backend like torch/tf, etc.)
        sentiment_pipeline = None
        return None


def analyze_sentiment(text: str):
    """Analyze sentiment for the provided text.

    If the transformers pipeline isn't available or fails to initialize,
    return a harmless placeholder result instead of raising.
    """
    try:
        p = _get_sentiment_pipeline()
        if p is None:
            return {'label': 'UNKNOWN', 'score': 0.0, 'note': 'transformers pipeline unavailable'}

        result = p(text[:512])[0]
        return {
            'label': result.get('label', 'UNKNOWN'),
            'score': round(float(result.get('score', 0.0)), 2)
        }
    except Exception as e:
        return {'label': 'ERROR', 'score': 0.0, 'error': str(e)}


def verify_source(url: str):
    """Verify whether a URL's domain is in a trusted list.

    If `tldextract` is not available or parsing fails, return False instead of
    raising so the API endpoint stays responsive.
    """
    try:
        trusted_domains = ["bbc", "cnn", "reuters", "nytimes", "npr", "aljazeera"]
        if not url or not _tldextract_available:
            return False

        extracted = tldextract.extract(url)
        domain = (extracted.domain or "").lower()
        return domain in trusted_domains
    except Exception:
        return False
