from transformers import pipeline
import tldextract

sentiment_pipeline = pipeline("sentiment-analysis")

def analyze_sentiment(text):
    try:
        result = sentiment_pipeline(text[:512])[0]
        return {
            'label': result['label'],
            'score': round(result['score'], 2)
        }
    except Exception as e:
        return {'label': 'ERROR', 'score': 0.0, 'error': str(e)}

def verify_source(url):
    trusted_domains = ["bbc", "cnn", "reuters", "nytimes", "npr", "aljazeera"]
    extracted = tldextract.extract(url)
    domain = extracted.domain.lower()
    return domain in trusted_domains
