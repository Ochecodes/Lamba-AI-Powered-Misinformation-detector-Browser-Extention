# Lamba

A full-stack Chrome extension + FastAPI backend that:
- Scans articles in real time
- Detects fake news with a trained ML model
- Analyzes sentiment
- Verifies if the source is trusted

## Browser Extension

### How to Use
1. Go to `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load Unpacked** → Select `extension/` folder
4. Click the extension icon → Click **Analyze**

## Backend (FastAPI + ML Model)

### Setup Locally
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
