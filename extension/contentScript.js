function createScanIcon(text) {
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icon.png");
  icon.classList.add("fake-news-icon");
  icon.style.width = "20px";
  icon.style.height = "20px";
  icon.style.cursor = "pointer";
  icon.style.marginLeft = "8px";
  icon.style.verticalAlign = "middle";
  icon.title = "Scan for Fake News";

  icon.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Remove existing iframes
    const existing = document.getElementById("fake-news-iframe");
    if (existing) existing.remove();

    const iframe = document.createElement("iframe");
    iframe.src =
      chrome.runtime.getURL("scan.html") + "?text=" + encodeURIComponent(text);
    iframe.id = "fake-news-iframe";
    iframe.style.position = "fixed";
    iframe.style.bottom = "20px";
    iframe.style.right = "20px";
    iframe.style.width = "350px";
    iframe.style.height = "400px";
    iframe.style.border = "1px solid #ccc";
    iframe.style.borderRadius = "8px";
    iframe.style.zIndex = "999999";
    iframe.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    iframe.style.background = "#fff";

    document.body.appendChild(iframe);
  });

  return icon;
}

function isLikelyArticlePage() {
  const ogType = document.querySelector('meta[property="og:type"]');
  const pathname = window.location.pathname;
  return (
    (ogType && ogType.content === "article") ||
    pathname.length > 40 ||
    document.querySelector("article") !== null
  );
}

function extractFullArticleText() {
  const article = document.querySelector("article");
  if (article) return article.innerText.trim();

  const main = document.querySelector("main");
  return main ? main.innerText.trim() : document.body.innerText.trim();
}

function extractHeadlines() {
  const headlineSelectors = "h1, h2, h3, .headline, .article-title";
  const headlines = document.querySelectorAll(headlineSelectors);
  const scanned = new Set();

  headlines.forEach((el) => {
    const text = el.innerText.trim();

    if (!text || text.length < 10 || scanned.has(text)) return;

    if (!el.querySelector("img.fake-news-icon")) {
      const icon = createScanIcon(text);
      el.appendChild(icon);
      scanned.add(text);
    }
  });
}

function addIconToArticleHeadline() {
  const headlineEl =
    document.querySelector("article h1") ||
    document.querySelector("main h1") ||
    document.querySelector("h1");

  if (headlineEl && !headlineEl.querySelector("img.fake-news-icon")) {
    const fullText = extractFullArticleText();
    const icon = createScanIcon(fullText);
    headlineEl.appendChild(icon);
  }
}

// Entry point
if (isLikelyArticlePage()) {
  addIconToArticleHeadline();
} else {
  extractHeadlines();
}
