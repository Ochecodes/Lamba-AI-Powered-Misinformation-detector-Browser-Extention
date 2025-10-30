import os
import requests
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
from dotenv import load_dotenv

# === Load Environment Variables === #
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

CLAIMBUSTER_API_KEY = os.getenv("CLAIMBUSTER_API_KEY")

# === Initialize FastAPI App === #
app = FastAPI(
    title="Fake News Detector Backend",
    description="Backend API that connects to ClaimBuster for misinformation scoring.",
    version="1.1.0"
)

# === Middleware === #
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow Chrome Extension access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Health Check Endpoint === #
@app.get("/")
async def health_check():
    return {"status": "ok", "message": "Backend running successfully"}

# === ClaimBuster Misinformation Analysis Endpoint === #
@app.post("/analyze/")
async def analyze(request: Request):
    """
    Analyze given text using ClaimBuster API and return a simplified rating result.
    """
    try:
        data = await request.json()
        text = data.get("text", "").strip()
        url = data.get("url", "")

        if not text:
            return JSONResponse(
                content={"error": "No text provided for analysis."},
                status_code=400
            )

        # --- Call ClaimBuster API --- #
        cb_url = f"https://idir.uta.edu/claimbuster/api/v2/score/text/{text}"
        headers = {"x-api-key": CLAIMBUSTER_API_KEY}
        response = requests.get(cb_url, headers=headers, timeout=10)

        # --- Validate ClaimBuster response --- #
        if response.status_code != 200:
            return JSONResponse(
                content={"error": f"ClaimBuster API returned {response.status_code}"},
                status_code=response.status_code
            )

        cb_data = response.json()
        results = cb_data.get("results", [])

        if not results or "score" not in results[0]:
            return JSONResponse(
                content={"error": "Invalid ClaimBuster response."},
                status_code=500
            )

        # --- Interpret ClaimBuster score --- #
        cb_score = round(results[0]["score"], 2)
        if cb_score >= 0.75:
            rating = "✅ Highly trustworthy content"
        elif cb_score >= 0.5:
            rating = "⚠️ Possibly misleading"
        else:
            rating = "❌ Potentially false"

        # ✅ Return simplified JSON response
        return JSONResponse(
            content={
                "rating": rating,
                "score": cb_score,
                "source_url": url or "N/A",
            },
            status_code=200
        )

    except Exception as e:
        return JSONResponse(
            content={"error": f"Internal Server Error: {str(e)}"},
            status_code=500
        )
