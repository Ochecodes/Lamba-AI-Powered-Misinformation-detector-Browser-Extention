// background.js
// Handles backend communication, message routing, and caching between popup and content scripts.

const API_BASE_URL = "http://localhost:8000"; // switch to your deployed backend later
const cache = new Map(); // simple in-memory cache

// 🔹 Listen for messages from popup or contentScript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeText") {
    const { text, url } = message;

    if (!text || text.trim().length < 10) {
      sendResponse({ error: "No sufficient text provided for analysis." });
      return true;
    }

    const cacheKey = `${url}-${text.slice(0, 100)}`;
    if (cache.has(cacheKey)) {
      console.log("[FND] Returning cached result for:", url);
      sendResponse(cache.get(cacheKey));
      return true;
    }

    console.log("[FND] Fetching analysis from backend for:", url);

    // 🔹 Call the backend asynchronously
    fetch(`${API_BASE_URL}/analyze/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Time": new Date().toISOString()
      },
      body: JSON.stringify({ text, url })
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Backend returned an error");
        const data = await response.json();
        cache.set(cacheKey, data); // store in cache
        sendResponse(data);
      })
      .catch((err) => {
        console.error("[FND] Backend fetch failed:", err);
        sendResponse({ error: "Failed to reach backend. Please try again." });
      });

    return true; // keep message channel open for async response
  }

  // Optional: allow clearing cache manually if needed
  if (message.action === "clearCache") {
    cache.clear();
    sendResponse({ status: "Cache cleared" });
  }

  return true;
});

// Optional debugging
chrome.runtime.onInstalled.addListener(() => {
  console.log("[FND] Background service worker initialized.");
});
