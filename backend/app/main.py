# import os
# import requests
# from fastapi import FastAPI, Request
# from fastapi.middleware.cors import CORSMiddleware
# from pathlib import Path
# import os
# from dotenv import load_dotenv

# # load .env located at backend/.env
# env_path = Path(__file__).resolve().parent.parent / ".env"
# load_dotenv(dotenv_path=env_path)

# CLAIMBUSTER_API_KEY = os.getenv("CLAIMBUSTER_API_KEY")
# # ... other config values ...
# # === Initialize FastAPI App === #
# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # Allow Chrome Extension access
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # === ClaimBuster API Key (Set via Environment Variable) === #
# CLAIMBUSTER_API_KEY = os.getenv("CLAIMBUSTER_API_KEY")

# # === ClaimBuster Misinformation Analysis Endpoint === #
# @app.post("/analyze/")
# async def analyze(request: Request):
#     data = await request.json()
#     text = data.get("text", "")
#     url = data.get("url", "")

#     if not text.strip():
#         return {"error": "No text provided for analysis."}

#     result = {"text": text, "url": url}

#     try:
#         # --- Call ClaimBuster API --- #
#         cb_url = f"https://idir.uta.edu/claimbuster/api/v2/score/text/{text}"
#         headers = {"x-api-key": CLAIMBUSTER_API_KEY}
#         response = requests.get(cb_url, headers=headers)

#         # Parse ClaimBuster response
#         cb_data = response.json()
#         cb_score = cb_data["results"][0]["score"] if "results" in cb_data else None

#         result["claimbuster_score"] = cb_score

#         # --- Interpret the score and classify --- #
#         if cb_score is not None:
#             score = round(cb_score, 2)

#             if score >= 0.75:
#                 final_status = "Highly trustworthy content ✅"
#                 level = "high"
#             elif score >= 0.5:
#                 final_status = "Possibly misleading ⚠️"
#                 level = "medium"
#             else:
#                 final_status = "Potentially false ❌"
#                 level = "low"

#             result.update({
#                 "score": score,
#                 "final_assessment": final_status,
#                 "level": level
#             })
#         else:
#             result.update({
#                 "error": "Could not interpret ClaimBuster score."
#             })

#     except Exception as e:
#         result["error"] = str(e)

#     return result


import os
import requests
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv

# === Load Environment Variables === #
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

CLAIMBUSTER_API_KEY = os.getenv("CLAIMBUSTER_API_KEY")

# === Initialize FastAPI App === #
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow Chrome Extension access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === ClaimBuster Misinformation Analysis Endpoint === #
@app.post("/analyze/")
async def analyze(request: Request):
    data = await request.json()
    text = data.get("text", "")

    if not text.strip():
        return {"error": "No text provided for analysis."}

    try:
        # --- Call ClaimBuster API --- #
        cb_url = f"https://idir.uta.edu/claimbuster/api/v2/score/text/{text}"
        headers = {"x-api-key": CLAIMBUSTER_API_KEY}
        response = requests.get(cb_url, headers=headers)
        cb_data = response.json()

        # --- Extract score --- #
        cb_score = cb_data.get("results", [{}])[0].get("score", None)

        if cb_score is None:
            return {"error": "Could not retrieve ClaimBuster score."}

        score = round(cb_score, 2)

        # --- Interpret score and classify --- #
        if score >= 0.75:
            final_status = "Highly trustworthy content ✅"
        elif score >= 0.5:
            final_status = "Possibly misleading ⚠️"
        else:
            final_status = "Potentially false ❌"

        # --- Return only the rating --- #
        return {"rating": final_status}

    except Exception as e:
        return {"error": str(e)}
