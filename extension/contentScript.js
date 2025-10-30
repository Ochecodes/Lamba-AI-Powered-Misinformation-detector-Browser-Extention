console.log("[FND] Content script loaded.");

// === BACKEND CONFIG === //
const BACKEND_URL = "http://localhost:8000/analyze/";

// === Listen for messages from popup or icon click === //
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "analyzeContent") {
    console.log("[FND] Icon clicked. Extracting and analyzing...");

    try {
      // 1️⃣ Extract text depending on page type
      let textContent = "";
      const url = window.location.href;

      // Determine if this is an article page or homepage
      const articleTags = document.querySelectorAll("article, .article-body, .post-content, .entry-content");
      if (articleTags.length > 0) {
        textContent = Array.from(articleTags)
          .map(el => el.innerText)
          .join(" ")
          .trim();
      } else {
        // fallback: try headlines on homepage
        const headlineTags = document.querySelectorAll("h1, h2, h3");
        textContent = Array.from(headlineTags)
          .map(el => el.innerText)
          .join(" ")
          .trim();
      }

      if (!textContent) {
        console.warn("[FND] No readable content found on this page.");
        showIframe("⚠️ No content found to analyze.", true);
        return;
      }

      // 2️⃣ Inject iframe popup if not present
      let iframe = document.getElementById("fnd-iframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "fnd-iframe";
        iframe.src = chrome.runtime.getURL("scan.html");
        iframe.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 350px;
          height: 220px;
          z-index: 999999;
          border: none;
          border-radius: 8px;
          box-shadow: 0 0 12px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(iframe);
      }

      // 3️⃣ Inform iframe that analysis is starting
      iframe.contentWindow.postMessage({ status: "loading" }, "*");

      // 4️⃣ Fetch analysis from backend
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textContent, url }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      console.log("[FND] Backend response:", data);

      // 5️⃣ Send result to iframe for display
      iframe.contentWindow.postMessage({ status: "done", data }, "*");
      sendResponse({ success: true, data });

    } catch (err) {
      console.error("[FND] Backend fetch error:", err);
      showIframe("❌ Failed to reach backend. Please try again.", true);
      sendResponse({ success: false, error: err.message });
    }
  }
});

// === Helper: Display message in iframe === //
function showIframe(message, isError = false) {
  let iframe = document.getElementById("fnd-iframe");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "fnd-iframe";
    iframe.src = chrome.runtime.getURL("scan.html");
    iframe.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 350px;
      height: 220px;
      z-index: 999999;
      border: none;
      border-radius: 8px;
      box-shadow: 0 0 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(iframe);
  }

  // Delay message post until iframe is ready
  setTimeout(() => {
    iframe.contentWindow.postMessage(
      { status: "error", error: message },
      "*"
    );
  }, 1000);
}
