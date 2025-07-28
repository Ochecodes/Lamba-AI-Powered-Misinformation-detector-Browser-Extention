import requests
import os

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "demo_key")
NEWS_API_URL = "https://newsapi.org/v2/top-headlines"

def fetch_headlines(country="us", category="general", limit=5):
    response = requests.get(NEWS_API_URL, params={
        "apiKey": NEWS_API_KEY,
        "country": country,
        "category": category,
        "pageSize": limit
    })
    if response.status_code == 200:
        return response.json().get("articles", [])
    else:
        return []
