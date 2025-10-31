// === background.js ===
// Manages backend communication, popup interactions,
// smart article detection, and caching.

const BACKEND_URL = "http://localhost:8000/analyze/"; // Update when deploying

// 🗂️ Simple in-memory cache to avoid rescanning same pages
const cache = new Map();

// 🧠 Detect if a URL is likely a news article or homepage
function isLikelyNewsPage(url) {
  const newsDomains = [
    "bbc.com",
    "cnn.com",
    "reuters.com",
    "aljazeera.com",
    "nytimes.com",
    "guardian.ng",
    "vanguardngr.com",
    "punchng.com",
    "channels.tv",
    "saharareporters.com"
  ];

  const isNewsSite = newsDomains.some(domain => url.includes(domain));
  const isArticle = /\/\d{4}\/\d{2}\/\d{2}\//.test(url) || url.split("/").length > 4;

  return isNewsSite && isArticle;
}

// 🧩 Fetch metadata from tab to verify if it’s an article
async function isPageArticle(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const metaTag = document.querySelector('meta[property="og:type"]');
        return metaTag ? metaTag.content : null;
      }
    });
    return result && result.toLowerCase().includes("article");
  } catch {
    return false;
  }
}

// 🚀 Perform backend analysis
async function analyzeText(text, url) {
  // Return cached result if available
  if (cache.has(url)) {
    console.log("⚡ Cached result used for:", url);
    return cache.get(url);
  }

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Time": new Date().toISOString()
      },
      body: JSON.stringify({ text, url })
    });

    if (!response.ok) throw new Error(`Backend error ${response.status}`);
    const data = await response.json();

    // Save to cache for session reuse
    cache.set(url, data);
    return data;
  } catch (err) {
    console.error("❌ Backend analysis failed:", err);
    throw err;
  }
}

// 🛰️ Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case "analyzeText": {
        try {
          const data = await analyzeText(message.text, message.url);
          sendResponse({ success: true, data });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
      }

      case "autoDetectPage": {
        const { tab } = sender;
        if (!tab || !tab.id || !tab.url) return;

        const isNewsCandidate = isLikelyNewsPage(tab.url);
        const isArticlePage = await isPageArticle(tab.id);

        if (isNewsCandidate || isArticlePage) {
          chrome.tabs.sendMessage(tab.id, {
            action: "autoAnalyzePage",
            url: tab.url
          });
        }
        break;
      }

      default:
        break;
    }
  })();

  return true; // Keep the message channel open for async responses
});

// 🌐 Monitor tab changes for auto-analysis
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    chrome.tabs.sendMessage(tabId, {
      action: "autoDetectPage",
      url: tab.url
    });
  }
});
