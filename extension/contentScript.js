// === contentScript.js ===
// Injects scan icon beside news headlines or full article text
// Communicates with background.js and scan.js
// Handles iframe popup behavior and smart article detection

console.log("[FND] Content script loaded ✅");

const ICON_URL = chrome.runtime.getURL("icon.png");
const SCAN_IFRAME_URL = chrome.runtime.getURL("scan.html");
let activeIframe = null;
let iframeTimeout = null;
let pageTextCache = null;

// 🧠 Smartly detect if the current page is an article
function isArticlePage() {
  const meta = document.querySelector('meta[property="og:type"]');
  if (meta && meta.content.toLowerCase().includes("article")) return true;

  // Additional fallbacks: if page has long text and a single <h1>
  const h1Tags = document.querySelectorAll("h1");
  const articleTags = document.querySelectorAll("article");
  const wordCount = document.body.innerText.split(/\s+/).length;
  return (
    (h1Tags.length === 1 && wordCount > 200) ||
    articleTags.length > 0
  );
}

// 📰 Find valid news headlines (exclude nav, footer, sidebar, etc.)
function getHeadlineElements() {
  const candidates = Array.from(document.querySelectorAll("h1, h2, h3"));
  return candidates.filter(el => {
    const text = el.innerText.trim();
    if (!text || text.length < 5) return false;
    if (el.closest("header, footer, nav, aside")) return false;
    return true;
  });
}

// 🪄 Injects scan icon beside headlines
function injectScanIcons() {
  const headlines = getHeadlineElements();
  headlines.forEach(headline => {
    if (headline.dataset.fndAttached) return;

    const icon = document.createElement("img");
    icon.src = ICON_URL;
    icon.alt = "Scan news";
    icon.title = "Scan this news article";
    icon.style.cssText = `
      width: 18px;
      height: 18px;
      margin-left: 6px;
      cursor: pointer;
      vertical-align: middle;
      transition: transform 0.2s ease;
      z-index: 99999;
    `;
    icon.addEventListener("mouseenter", () => icon.style.transform = "scale(1.2)");
    icon.addEventListener("mouseleave", () => icon.style.transform = "scale(1)");

    icon.addEventListener("click", async (e) => {
      e.stopPropagation();
      console.log("[FND] Icon clicked. Extracting and analyzing...");

      const text = extractFullArticle() || headline.innerText;
      showScanPopup(headline, text);
    });

    headline.appendChild(icon);
    headline.dataset.fndAttached = true;
  });
}

// 🧾 Extract article text (for article pages)
function extractFullArticle() {
  if (pageTextCache) return pageTextCache;

  let article = document.querySelector("article");
  if (article) {
    pageTextCache = article.innerText.trim();
    return pageTextCache;
  }

  const paragraphs = Array.from(document.querySelectorAll("p"))
    .map(p => p.innerText.trim())
    .filter(t => t.length > 50)
    .join(" ");

  pageTextCache = paragraphs;
  return pageTextCache;
}

// 💬 Show the popup iframe beside the clicked headline
function showScanPopup(targetElement, text) {
  closeExistingIframe();

  activeIframe = document.createElement("iframe");
  activeIframe.src = SCAN_IFRAME_URL;
  activeIframe.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 280px;
    height: 160px;
    border: none;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    z-index: 999999;
    background: white;
    animation: fadeIn 0.25s ease-in-out;
  `;

  document.body.appendChild(activeIframe);

  // Add a drag handle for repositioning
  makeIframeDraggable(activeIframe);

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "×";
  closeBtn.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000000;
    background: #333;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
  `;
  closeBtn.addEventListener("click", closeExistingIframe);
  document.body.appendChild(closeBtn);
  activeIframe.closeBtn = closeBtn;

  // Start analysis
  activeIframe.onload = () => {
    activeIframe.contentWindow.postMessage({ status: "loading" }, "*");

    chrome.runtime.sendMessage(
      { action: "analyzeText", text, url: location.href },
      (response) => {
        if (response?.success) {
          activeIframe.contentWindow.postMessage({ status: "done", data: response.data }, "*");
        } else {
          activeIframe.contentWindow.postMessage({
            status: "error",
            error: response?.error || "⚠️ Unable to analyze this article."
          }, "*");
        }
      }
    );
  };

  // Auto-close after 10s (pause if hovered)
  let hover = false;
  activeIframe.addEventListener("mouseenter", () => hover = true);
  activeIframe.addEventListener("mouseleave", () => hover = false);

  iframeTimeout = setInterval(() => {
    if (!hover) closeExistingIframe();
  }, 10000);
}

// 🧲 Allow dragging of iframe
function makeIframeDraggable(iframe) {
  let offsetX = 0, offsetY = 0, isDragging = false;

  iframe.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - iframe.offsetLeft;
    offsetY = e.clientY - iframe.offsetTop;
    iframe.style.transition = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      iframe.style.left = `${e.clientX - offsetX}px`;
      iframe.style.top = `${e.clientY - offsetY}px`;
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    iframe.style.transition = "all 0.2s ease";
  });
}

// ❌ Close iframe and cleanup
function closeExistingIframe() {
  if (activeIframe) {
    if (activeIframe.closeBtn) activeIframe.closeBtn.remove();
    activeIframe.remove();
    activeIframe = null;
  }
  if (iframeTimeout) clearInterval(iframeTimeout);
}

// 🚀 Run smart detection on load
if (isArticlePage()) {
  console.log("[FND] Article page detected — auto-analyzing...");
  const text = extractFullArticle();
  if (text) showScanPopup(document.body, text);
} else {
  console.log("[FND] Homepage or news listing detected — injecting icons...");
  injectScanIcons();
}
