import os
import requests
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
CLAIMBUSTER_API_KEY = os.getenv("CLAIMBUSTER_API_KEY")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze/")
async def analyze(request: Request):
    try:
        data = await request.json()
        text = data.get("text", "")
        url = data.get("url", "")

        if not text.strip():
            return JSONResponse({"error": "No text provided."}, 400)

        cb_url = f"https://idir.uta.edu/claimbuster/api/v2/score/text/{text}"
        headers = {"x-api-key": CLAIMBUSTER_API_KEY}
        response = requests.get(cb_url, headers=headers, timeout=10)

        if response.status_code != 200:
            return JSONResponse({"error": "ClaimBuster API error."}, 500)

        cb_data = response.json()
        results = cb_data.get("results", [])
        if not results or "score" not in results[0]:
            return JSONResponse({"error": "Invalid ClaimBuster response."}, 500)

        score = round(results[0]["score"], 2)
        if score >= 0.75:
            rating = "✅ Highly trustworthy content"
        elif score >= 0.5:
            rating = "⚠️ Possibly misleading"
        else:
            rating = "❌ Potentially false"

        return JSONResponse({"rating": rating, "score": score, "source_url": url})
    except Exception as e:
        return JSONResponse({"error": f"Server error: {str(e)}"}, 500)
