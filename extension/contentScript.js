// contentScript.js (verbose, prefetch + postMessage)
function createScanIcon(text) {
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icon.png");
  icon.style.width = "20px";
  icon.style.height = "20px";
  icon.style.cursor = "pointer";
  icon.style.marginLeft = "8px";
  icon.style.verticalAlign = "middle";
  icon.title = "Scan for misinformation";

  icon.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("[FND] Icon clicked. Preparing iframe and backend prefetch...");

    // Create iframe with text in query param (so scan.js always has access)
    const encoded = encodeURIComponent(text);
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("scan.html") + "?text=" + encoded;
    iframe.loading = "lazy";
    Object.assign(iframe.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "360px",
      height: "320px",
      border: "1px solid #ccc",
      borderRadius: "10px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      zIndex: "999999",
      background: "#fff",
      opacity: "0",
      transition: "opacity 0.18s ease"
    });
    document.body.appendChild(iframe);
    setTimeout(()=> iframe.style.opacity = "1", 40);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    Object.assign(closeBtn.style, {
      position: "fixed",
      bottom: (20 + 320 + 8) + "px",
      right: "24px",
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      border: "1px solid #ccc",
      background: "#fff",
      fontSize: "18px",
      cursor: "pointer",
      zIndex: "1000000"
    });
    closeBtn.addEventListener("click", () => { iframe.remove(); closeBtn.remove(); });
    document.body.appendChild(closeBtn);

    // Prefetch backend result in parallel (best-effort)
    let backendData = null;
    try {
      console.log("[FND] Prefetching backend...");
      const controller = new AbortController();
      const timeoutId = setTimeout(()=> controller.abort(), 8000);
      const resp = await fetch("http://127.0.0.1:8000/analyze/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (resp.ok) {
        backendData = await resp.json();
        console.log("[FND] Prefetch backendData:", backendData);
      } else {
        console.warn("[FND] Prefetch response not ok:", resp.status);
      }
    } catch (err) {
      console.warn("[FND] Prefetch failed:", err && err.message ? err.message : err);
    }

    // When iframe is ready, post backendData (if available)
    iframe.addEventListener("load", () => {
      try {
        console.log("[FND] iframe loaded — posting backendData to iframe (may be null)...");
        iframe.contentWindow.postMessage({ type: "claimbuster_prefetch", backendData }, "*");
      } catch (err) {
        console.warn("[FND] postMessage failed:", err);
      }
    });
  });

  return icon;
}

// helpers to detect page type and attach icons (keep your existing detection logic)
function isLikelyArticlePage() {
  const meta = document.querySelector('meta[property="og:type"]');
  const article = document.querySelector("article");
  return (meta && meta.content === "article") || article !== null || window.location.pathname.length > 40;
}

function extractFullArticleText() {
  const article = document.querySelector("article");
  if (article) return article.innerText.trim();
  const main = document.querySelector("main");
  if (main) return main.innerText.trim();
  const body = document.body.innerText.trim();
  return body.length > 200 ? body : null;
}

function addIconToArticleHeadline() {
  const headlineEl = document.querySelector("article h1") || document.querySelector("main h1") || document.querySelector("h1");
  if (!headlineEl) return;
  const text = extractFullArticleText();
  if (!text) return;
  if (!headlineEl.querySelector("img.fake-news-icon")) {
    const icon = createScanIcon(text);
    icon.classList.add("fake-news-icon");
    headlineEl.appendChild(icon);
  }
}

function extractHeadlines() {
  const sel = "h1, h2, h3, .headline, .news-title, .story-title";
  const nodes = document.querySelectorAll(sel);
  const seen = new Set();
  nodes.forEach(el => {
    const text = el.innerText.trim();
    if (!text || text.length < 10 || seen.has(text)) return;
    if (!el.querySelector("img.fake-news-icon")) {
      const icon = createScanIcon(text);
      icon.classList.add("fake-news-icon");
      el.appendChild(icon);
      seen.add(text);
    }
  });
}

// main
if (isLikelyArticlePage()) addIconToArticleHeadline();
else extractHeadlines();
