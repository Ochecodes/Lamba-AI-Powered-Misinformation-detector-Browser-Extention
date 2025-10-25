# from fastapi import FastAPI, Request
# from fastapi.middleware.cors import CORSMiddleware
# from .model import predict_fake_news
# from .utils import analyze_sentiment, verify_source
# from .news_fetcher import fetch_headlines
# import json
# import os

# app = FastAPI()

# # CORS setup
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# HISTORY_FILE = "scan_history.json"

# @app.post("/analyze/")
# async def analyze(request: Request):
#     data = await request.json()
#     text = data.get("text", "")
#     url = data.get("url", "")

#     fake_result = predict_fake_news(text)
#     sentiment = analyze_sentiment(text)
#     source_status = verify_source(url)

#     history_item = {
#         "text": text[:100],
#         "result": {
#             "is_fake": fake_result,
#             "sentiment": sentiment,
#             "source_verified": source_status
#         },
#         "timestamp": request.headers.get("X-Client-Time") or "unknown"
#     }

#     history = []
#     if os.path.exists(HISTORY_FILE):
#         with open(HISTORY_FILE, 'r') as f:
#             history = json.load(f)
#     history.insert(0, history_item)
#     with open(HISTORY_FILE, 'w') as f:
#         json.dump(history, f)

#     return history_item["result"]

# @app.get("/history")
# def get_history():
#     if os.path.exists(HISTORY_FILE):
#         with open(HISTORY_FILE, 'r') as f:
#             return json.load(f)
#     return []

# @app.get("/fetch-and-scan")
# def fetch_and_scan():
#     articles = fetch_headlines()
#     scanned = []
#     for article in articles:
#         text = article.get("title", "") + ". " + article.get("description", "")
#         url = article.get("url", "")
#         scanned.append({
#             "title": article.get("title"),
#             "result": {
#                 "is_fake": predict_fake_news(text),
#                 "sentiment": analyze_sentiment(text),
#                 "source_verified": verify_source(url)
#             },
#             "url": url
#         })
#     return scanned


import os
import requests
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

# === Initialize FastAPI App === #
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow Chrome Extension access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === ClaimBuster API Key (Set via Environment Variable) === #
CLAIMBUSTER_API_KEY = os.getenv("
                                CLAIMBUSTER_API_KEY")

# === ClaimBuster Misinformation Analysis Endpoint === #
@app.post("/analyze/")
async def analyze(request: Request):
    data = await request.json()
    text = data.get("text", "")
    url = data.get("url", "")

    if not text.strip():
        return {"error": "No text provided for analysis."}

    result = {"text": text, "url": url}

    try:
        # --- Call ClaimBuster API --- #
        cb_url = f"https://idir.uta.edu/claimbuster/api/v2/score/text/{text}"
        headers = {"x-api-key": CLAIMBUSTER_API_KEY}
        response = requests.get(cb_url, headers=headers)

        # Parse ClaimBuster response
        cb_data = response.json()
        cb_score = cb_data["results"][0]["score"] if "results" in cb_data else None

        result["claimbuster_score"] = cb_score

        # --- Interpret the score and classify --- #
        if cb_score is not None:
            score = round(cb_score, 2)

            if score >= 0.75:
                final_status = "Highly trustworthy content ✅"
                level = "high"
            elif score >= 0.5:
                final_status = "Possibly misleading ⚠️"
                level = "medium"
            else:
                final_status = "Potentially false ❌"
                level = "low"

            result.update({
                "score": score,
                "final_assessment": final_status,
                "level": level
            })
        else:
            result.update({
                "error": "Could not interpret ClaimBuster score."
            })

    except Exception as e:
        result["error"] = str(e)

    return result
