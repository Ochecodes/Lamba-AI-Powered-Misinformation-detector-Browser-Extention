# from fastapi import FastAPI, Request
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import JSONResponse
# from pathlib import Path
# from dotenv import load_dotenv
# import os
# import time
# import logging
# import requests
# from json import JSONDecodeError
# from urllib.parse import quote_plus

# # load .env next to this file: backend/.env
# env_path = Path(__file__).resolve().parent.parent / ".env"
# load_dotenv(dotenv_path=env_path)
# CLAIMBUSTER_API_KEY = os.getenv("CLAIMBUSTER_API_KEY")

# logger = logging.getLogger("backend.main")
# logger.setLevel(logging.DEBUG)
# if not logger.handlers:
#     ch = logging.StreamHandler()
#     ch.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
#     logger.addHandler(ch)

# app = FastAPI()
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Configure upstream URL via env (optional)
# CLAIMBUSTER_BASE = os.getenv("CLAIMBUSTER_BASE_URL", "https://idir.uta.edu/claimbuster/api")
# USE_UPSTREAM = os.getenv("USE_UPSTREAM", "true").lower() in ("1", "true", "yes")

# @app.post("/analyze/")
# async def analyze(request: Request):
#     try:
#         body = await request.body()
#         if body:
#             try:
#                 data = await request.json()
#             except JSONDecodeError:
#                 return JSONResponse({"error": "Invalid JSON in request body."}, status_code=400)
#         else:
#             qp_text = request.query_params.get("text")
#             qp_url = request.query_params.get("url", "")
#             if qp_text:
#                 data = {"text": qp_text, "url": qp_url}
#             else:
#                 return JSONResponse({"error": "Empty request body. Expected JSON: {\"text\":\"...\"} or provide ?text=..."}, status_code=400)

#         if not isinstance(data, dict):
#             return JSONResponse({"error": "Expected JSON object with a 'text' field."}, status_code=400)

#         text = data.get("text", "")
#         url = data.get("url", "")

#         if not text or len(text.strip()) < 20:
#             return JSONResponse({"error": "Insufficient text provided for analysis (min 20 chars)."}, status_code=400)

#         if not USE_UPSTREAM:
#             logger.debug("USE_UPSTREAM disabled — returning local fallback")
#             return JSONResponse({"rating": "UNKNOWN", "score": 0.0, "note": "upstream disabled (local fallback)"}, status_code=200)

#         if not CLAIMBUSTER_API_KEY:
#             logger.error("CLAIMBUSTER_API_KEY not set")
#             return JSONResponse({"error": "Server misconfiguration: CLAIMBUSTER_API_KEY missing."}, status_code=500)

#         headers = {"x-api-key": CLAIMBUSTER_API_KEY}
#         encoded_text = quote_plus(text[:2000])

#         # Try POST /v2/score/text with JSON payload first
#         post_url = f"{CLAIMBUSTER_BASE}/v2/score/text"
#         get_url = f"{CLAIMBUSTER_BASE}/v2/score/text/{encoded_text}"

#         max_retries = 3
#         backoff = 1.0
#         resp = None
#         last_exc = None

#         # Attempt POST then fallback to GET if POST returns 404
#         for attempt in range(1, max_retries + 1):
#             try:
#                 logger.debug("Attempt %d: POST %s", attempt, post_url)
#                 resp = requests.post(post_url, json={"text": text}, headers=headers, timeout=10)
#                 logger.debug("POST status=%s", resp.status_code)
#                 if resp.status_code == 404:
#                     logger.warning("POST returned 404 — will try GET fallback")
#                     resp = None
#                     break
#                 if 500 <= resp.status_code < 600:
#                     logger.warning("POST returned 5xx on attempt %d: %s", attempt, resp.status_code)
#                     time.sleep(backoff)
#                     backoff *= 2
#                     continue
#                 break
#             except requests.RequestException as e:
#                 logger.exception("POST request failed on attempt %d: %s", attempt, e)
#                 last_exc = e
#                 time.sleep(backoff)
#                 backoff *= 2

#         # If POST yielded 404 or no usable response, try GET fallback
#         if resp is None:
#             backoff = 1.0
#             for attempt in range(1, max_retries + 1):
#                 try:
#                     logger.debug("Attempt %d: GET %s", attempt, get_url)
#                     resp = requests.get(get_url, headers=headers, timeout=10)
#                     logger.debug("GET status=%s", resp.status_code)
#                     if 500 <= resp.status_code < 600:
#                         logger.warning("GET returned 5xx on attempt %d: %s", attempt, resp.status_code)
#                         time.sleep(backoff)
#                         backoff *= 2
#                         continue
#                     break
#                 except requests.RequestException as e:
#                     logger.exception("GET request failed on attempt %d: %s", attempt, e)
#                     last_exc = e
#                     time.sleep(backoff)
#                     backoff *= 2

#         # If still no 200, return safe fallback
#         if resp is None or resp.status_code != 200:
#             logger.error("ClaimBuster unavailable after retries: %s", getattr(last_exc, "args", last_exc))
#             status_txt = resp.status_code if resp is not None else "no-response"
#             return JSONResponse({"rating": "UNKNOWN", "score": 0.0, "note": f"ClaimBuster unavailable (upstream {status_txt})"}, status_code=200)

#         # Parse upstream JSON
#         try:
#             cb_data = resp.json()
#         except ValueError:
#             logger.exception("ClaimBuster returned non-JSON")
#             return JSONResponse({"error": "Invalid response from upstream service."}, status_code=502)

#         results = cb_data.get("results", [])
#         if not results or "score" not in results[0]:
#             logger.error("Unexpected ClaimBuster payload: %s", cb_data)
#             return JSONResponse({"error": "Invalid ClaimBuster response."}, status_code=502)

#         cb_score = round(float(results[0]["score"]), 2)
#         if cb_score >= 0.75:
#             rating = "✅ Highly Trustworthy"
#         elif cb_score >= 0.5:
#             rating = "⚠️ Possibly Misleading"
#         else:
#             rating = "❌ Potentially False"

#         return JSONResponse({"rating": rating, "score": cb_score, "source_url": url}, status_code=200)

#     except Exception as e:
#         logger.exception("analyze endpoint unexpected error: %s", e)
#         return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)

import os
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

GOOGLE_API_KEY = os.getenv("GOOGLE_FACTCHECK_API_KEY")
GOOGLE_SEARCH_URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"


class AnalyzeRequest(BaseModel):
    text: str


@app.post("/analyze/")
def analyze(request: AnalyzeRequest):
    text = request.text.strip()

    if not text or len(text) < 20:
        raise HTTPException(status_code=400, detail="Text too short for analysis")

    # -------------------------------
    # 1. Query Google Fact Check API
    # -------------------------------
    try:
        params = {
            "query": text,
            "key": GOOGLE_API_KEY,
            "pageSize": 3
        }

        response = requests.get(GOOGLE_SEARCH_URL, params=params, timeout=10)

<<<<<<< HEAD
        if response.status_code == 200:
            data = response.json()
=======
        cb_url = f"https://idir.uta.edu/claimbuster/api/v2/score/text/{text}"
        headers = {"x-api-key": CLAIMBUSTER_API_KEY}
        response = requests.get(cb_url, headers=headers, timeout=10)

        if response.status_code != 200:
            return JSONResponse(
                {"error": f"Lamba API failed ({response.status_code})"},
                status_code=response.status_code,
            )

        cb_data = response.json()
        results = cb_data.get("results", [])
        if not results or "score" not in results[0]:
            return JSONResponse({"error": "Invalid Lamba response."}, 500)

        cb_score = round(results[0]["score"], 2)

        if cb_score >= 0.75:
            rating = "✅ Highly Trustworthy"
        elif cb_score >= 0.5:
            rating = "⚠️ Possibly Misleading"
>>>>>>> 19a821839cab19e8c9f6cda28d3b8fc80419814c
        else:
            data = None

    except Exception as e:
        print("Google FactCheck API error:", e)
        data = None

    # -------------------------------
    # 2. Parse Google results
    # -------------------------------
    if data and "claims" in data and len(data["claims"]) > 0:
        claim = data["claims"][0]

        claimant = claim.get("claimant", "Unknown")
        claim_text = claim.get("text", "Unknown claim")

        reviews = claim.get("claimReview", [])

        if reviews:
            review = reviews[0]
            rating = review.get("textualRating", "Unknown")
            publisher = review.get("publisher", {}).get("name", "Unknown")

            return {
                "status": "fact-check-found",
                "claim": claim_text,
                "claimant": claimant,
                "rating": rating,
                "publisher": publisher,
                "confidence": 0.95  # high confidence if fact-check exists
            }

    # -------------------------------
    # 3. Fallback heuristic scoring
    # -------------------------------
    suspicion_words = ["shocking", "miracle", "exposed", "you won’t believe", "secret", "leaked"]
    score = 0

    lower_text = text.lower()
    for w in suspicion_words:
        if w in lower_text:
            score += 0.2

    if len(text) < 200:
        score += 0.1  # short sensational content

    if "http" in text:
        score += 0.1  # suspicious links

    score = min(score, 1.0)

    # Classify
    if score < 0.25:
        label = "likely reliable"
    elif score < 0.6:
        label = "uncertain — needs review"
    else:
        label = "potential misinformation"

    return {
        "status": "no-fact-check",
        "confidence": round(1 - score, 2),
        "label": label,
        "heuristic_score": score,
    }
