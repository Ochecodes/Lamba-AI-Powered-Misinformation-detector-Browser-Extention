// // === Simple utility for logging ===
const log = (...args) => console.log("[FakeNewsDetector]", ...args);

// === Global popup iframe (created once and reused) ===
let scanIframe = null;

// === Create and attach lightweight popup ===
// function getOrCreatePopup() {
//   if (scanIframe) return scanIframe;

//   scanIframe = document.createElement("iframe");
//   scanIframe.id = "fake-news-popup";
//   scanIframe.src = chrome.runtime.getURL("scan.html");
//   Object.assign(scanIframe.style, {
//     position: "fixed",
//     top: "20px",
//     right: "20px",
//     width: "360px",
//     height: "280px",
//     border: "1px solid #ccc",
//     borderRadius: "10px",
//     boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
//     background: "#fff",
//     zIndex: "999999",
//     display: "none",
//   });

//   // === Add close button ===
//   const closeBtn = document.createElement("button");
//   closeBtn.textContent = "×";
//   Object.assign(closeBtn.style, {
//     position: "fixed",
//     top: "24px",
//     right: "30px",
//     fontSize: "22px",
//     background: "none",
//     border: "none",
//     color: "#333",
//     cursor: "pointer",
//     zIndex: "1000000",
//     display: "none",
//   });
//   closeBtn.addEventListener("click", () => {
//     scanIframe.style.display = "none";
//     closeBtn.style.display = "none";
//   });

//   document.body.appendChild(scanIframe);
//   document.body.appendChild(closeBtn);

//   scanIframe.closeBtn = closeBtn;
//   return scanIframe;
// }

function createScanIcon(text, isArticlePage) {
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icon.png");
  icon.style.width = "20px";
  icon.style.height = "20px";
  icon.style.cursor = "pointer";
  icon.style.marginLeft = "8px";
  icon.title = "Scan with Fake News Detector";

  icon.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Create iframe container
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("scan.html");
    iframe.style.position = "fixed";
    iframe.style.bottom = "20px";
    iframe.style.right = "20px";
    iframe.style.width = "320px";
    iframe.style.height = "200px";
    iframe.style.zIndex = "999999";
    iframe.style.border = "1px solid #ccc";
    iframe.style.borderRadius = "10px";
    iframe.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    iframe.style.background = "#fff";
    iframe.style.transition = "opacity 0.3s ease";
    iframe.style.opacity = "0";
    iframe.loading = "lazy";

    document.body.appendChild(iframe);

    // Fade in after small delay
    setTimeout(() => (iframe.style.opacity = "1"), 100);

    // Fetch backend data in parallel
    let backendData = null;
    try {
      const response = await fetch("http://127.0.0.1:8000/analyze/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, url: window.location.href }),
      });

      if (response.ok) backendData = await response.json();
      else console.error("Backend error:", response.status);
    } catch (err) {
      console.error("Fetch failed:", err);
    }

    // Wait for iframe to be ready before posting
    iframe.onload = () => {
      iframe.contentWindow.postMessage(
        { type: "scan", text, backendData },
        "*"
      );
    };

    // Add a close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "4px";
    closeBtn.style.right = "10px";
    closeBtn.style.background = "transparent";
    closeBtn.style.border = "none";
    closeBtn.style.fontSize = "20px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.zIndex = "1000000";
    closeBtn.addEventListener("click", () => iframe.remove());

    iframe.addEventListener("load", () => {
      iframe.contentDocument?.body?.appendChild(closeBtn);
    });
  });

  return icon;
}

// === Lightweight popup launcher ===
function openScanPopup(text, backendData = null) {
  const iframe = getOrCreatePopup();
  iframe.style.display = "block";
  iframe.closeBtn.style.display = "block";

  // Send text + pre-fetched backend result to iframe
  iframe.onload = () => {
    iframe.contentWindow.postMessage(
      { type: "scan", text, backendData },
      "*"
    );
  };

  // If already loaded, send message directly
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage(
      { type: "scan", text, backendData },
      "*"
    );
  }
}

// === Fetch and extract article text from a URL ===
async function fetchFullArticle(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const articleEl =
      doc.querySelector("article") ||
      doc.querySelector("main") ||
      doc.querySelector(".post-content") ||
      doc.querySelector(".entry-content") ||
      doc.querySelector("#content");

    return articleEl
      ? articleEl.innerText.trim().slice(0, 8000)
      : doc.body.innerText.trim().slice(0, 8000);
  } catch (err) {
    log("Error fetching article:", err);
    return null;
  }
}

// === Pre-fetch backend result in parallel ===
async function fetchBackendAnalysis(text) {
  try {
    const response = await fetch("http://localhost:8000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return await response.json();
  } catch (err) {
    log("Backend error:", err);
    return { error: "Unable to fetch analysis" };
  }
}

// === Create scan icon beside headlines or article title ===
function createScanIcon(targetEl, headlineText, articleUrl = null) {
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icon.png");
  Object.assign(icon.style, {
    width: "18px",
    height: "18px",
    cursor: "pointer",
    marginLeft: "6px",
    verticalAlign: "middle",
  });
  icon.title = "Scan this news";

  icon.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    let textPromise;
    if (articleUrl) textPromise = fetchFullArticle(articleUrl);
    else textPromise = Promise.resolve(headlineText);

    // === Prefetch both article text and backend result in parallel ===
    const [articleText, backendData] = await Promise.all([
      textPromise,
      textPromise.then((t) => fetchBackendAnalysis(t || headlineText)),
    ]);

    const textToUse = articleText || headlineText;
    openScanPopup(textToUse, backendData);
  });

  return icon;
}

// === Detect article pages ===
function isLikelyArticlePage() {
  const metaType = document.querySelector('meta[property="og:type"]');
  const url = window.location.href;
  return (
    (metaType && metaType.content === "article") ||
    document.querySelector("article") ||
    url.match(/\/\d{4}\/\d{2}\//)
  );
}

// === Extract all text from article ===
function extractFullArticleText() {
  const article =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.body;
  return article.innerText.trim().slice(0, 8000);
}

// === Scan icon for article headline ===
function addIconToArticleHeadline() {
  const headlineEl =
    document.querySelector("article h1") ||
    document.querySelector("main h1") ||
    document.querySelector("h1");
  if (!headlineEl) return;

  const text = extractFullArticleText();
  if (!headlineEl.querySelector("img.fake-news-icon")) {
    const icon = createScanIcon(headlineEl, text);
    icon.classList.add("fake-news-icon");
    headlineEl.appendChild(icon);
  }
}

// === Scan icons beside headlines on homepage ===
function extractHeadlines() {
  const selectors = "h1, h2, h3, .headline, .news-title, .post-title";
  const headlines = document.querySelectorAll(selectors);
  const seen = new Set();

  for (const el of headlines) {
    const text = el.innerText.trim();
    if (!text || text.length < 10 || seen.has(text)) continue;

    let link = el.closest("a") ? el.closest("a").href : null;
    if (!link) {
      const childLink = el.querySelector("a");
      if (childLink) link = childLink.href;
    }

    if (!el.querySelector("img.fake-news-icon")) {
      const icon = createScanIcon(el, text, link);
      icon.classList.add("fake-news-icon");
      el.appendChild(icon);
      seen.add(text);
    }
  }
}

// === Initialize based on page type ===
if (isLikelyArticlePage()) {
  addIconToArticleHeadline();
} else {
  extractHeadlines();
}
