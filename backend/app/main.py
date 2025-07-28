from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .model import predict_fake_news
from .utils import analyze_sentiment, verify_source
from .news_fetcher import fetch_headlines
import json
import os

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HISTORY_FILE = "scan_history.json"

@app.post("/analyze/")
async def analyze(request: Request):
    data = await request.json()
    text = data.get("text", "")
    url = data.get("url", "")

    fake_result = predict_fake_news(text)
    sentiment = analyze_sentiment(text)
    source_status = verify_source(url)

    history_item = {
        "text": text[:100],
        "result": {
            "is_fake": fake_result,
            "sentiment": sentiment,
            "source_verified": source_status
        },
        "timestamp": request.headers.get("X-Client-Time") or "unknown"
    }

    history = []
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r') as f:
            history = json.load(f)
    history.insert(0, history_item)
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f)

    return history_item["result"]

@app.get("/history")
def get_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r') as f:
            return json.load(f)
    return []

@app.get("/fetch-and-scan")
def fetch_and_scan():
    articles = fetch_headlines()
    scanned = []
    for article in articles:
        text = article.get("title", "") + ". " + article.get("description", "")
        url = article.get("url", "")
        scanned.append({
            "title": article.get("title"),
            "result": {
                "is_fake": predict_fake_news(text),
                "sentiment": analyze_sentiment(text),
                "source_verified": verify_source(url)
            },
            "url": url
        })
    return scanned
