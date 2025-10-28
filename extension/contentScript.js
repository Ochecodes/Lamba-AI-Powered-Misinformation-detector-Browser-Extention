// === contentScript.js ===

// Create a scan icon beside news headlines or article titles
function createScanIcon(text) {
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icon.png");
  icon.style.width = "20px";
  icon.style.height = "20px";
  icon.style.cursor = "pointer";
  icon.style.marginLeft = "8px";
  icon.style.verticalAlign = "middle";
  icon.title = "Scan for misinformation";

  icon.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Create the iframe popup
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("scan.html");
    iframe.loading = "lazy";
    iframe.style.position = "fixed";
    iframe.style.bottom = "20px";
    iframe.style.right = "20px";
    iframe.style.width = "320px";
    iframe.style.height = "180px";
    iframe.style.border = "1px solid #ccc";
    iframe.style.borderRadius = "10px";
    iframe.style.boxShadow = "0 2px 10px rgba(0,0,0,0.25)";
    iframe.style.zIndex = "999999";
    iframe.style.background = "#fff";
    iframe.style.transition = "opacity 0.25s ease";
    iframe.style.opacity = "0";

    document.body.appendChild(iframe);

    // Fade-in animation
    setTimeout(() => (iframe.style.opacity = "1"), 50);

    // === Pre-fetch backend result in parallel ===
    let backendData = null;
    const backendURL = "http://127.0.0.1:8000/analyze/";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(backendURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, url: window.location.href }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        backendData = await response.json();
      } else {
        backendData = { final_assessment: "⚠️ Unable to assess this article." };
        console.warn("Backend response not OK:", response.status);
      }
    } catch (error) {
      backendData = { final_assessment: "⚠️ Unable to connect to backend." };
      console.error("Backend fetch failed:", error);
    }

    // Send data to iframe after it's loaded
    iframe.onload = () => {
      iframe.contentWindow.postMessage(
        { type: "scan", text, backendData },
        "*"
      );
    };

    // Add close (×) button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.style.position = "fixed";
    closeBtn.style.bottom = "190px";
    closeBtn.style.right = "25px";
    closeBtn.style.background = "#fff";
    closeBtn.style.border = "1px solid #ccc";
    closeBtn.style.borderRadius = "50%";
    closeBtn.style.width = "24px";
    closeBtn.style.height = "24px";
    closeBtn.style.fontSize = "16px";
    closeBtn.style.lineHeight = "20px";
    closeBtn.style.textAlign = "center";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.zIndex = "1000000";
    closeBtn.addEventListener("click", () => {
      iframe.remove();
      closeBtn.remove();
    });

    document.body.appendChild(closeBtn);
  });

  return icon;
}

// === Detect article vs homepage ===
function isLikelyArticlePage() {
  const metaOgType = document.querySelector('meta[property="og:type"]');
  const pathname = window.location.pathname;
  const articleTag = document.querySelector("article");
  return (
    (metaOgType && metaOgType.content === "article") ||
    pathname.length > 40 ||
    articleTag !== null
  );
}

// === Extract full article text ===
function extractFullArticleText() {
  const article = document.querySelector("article");
  if (article) return article.innerText.trim();

  const main = document.querySelector("main");
  if (main) return main.innerText.trim();

  const body = document.body.innerText.trim();
  return body.length > 500 ? body : null;
}

// === Extract potential news headlines on homepages ===
function extractHeadlines() {
  const headlineSelectors = "h1, h2, h3, .headline, .news-title, .story-title";
  const headlines = document.querySelectorAll(headlineSelectors);
  const scanned = new Set();

  headlines.forEach((el) => {
    const text = el.innerText.trim();

    // Filter out navigation, ads, or too-short headings
    if (
      !text ||
      text.length < 10 ||
      scanned.has(text) ||
      /(login|subscribe|advert|menu|read more)/i.test(text)
    )
      return;

    // Only attach one icon per unique headline
    if (!el.querySelector("img.fake-news-icon")) {
      const icon = createScanIcon(text);
      icon.classList.add("fake-news-icon");
      el.appendChild(icon);
      scanned.add(text);
    }
  });
}

// === Add icon beside the main article headline ===
function addIconToArticleHeadline() {
  const headlineEl =
    document.querySelector("article h1") ||
    document.querySelector("main h1") ||
    document.querySelector("h1");

  if (headlineEl && !headlineEl.querySelector("img.fake-news-icon")) {
    const fullText = extractFullArticleText();
    if (!fullText) return;

    const icon = createScanIcon(fullText);
    icon.classList.add("fake-news-icon");
    headlineEl.appendChild(icon);
  }
}

// === MAIN EXECUTION ===
if (isLikelyArticlePage()) {
  addIconToArticleHeadline();
} else {
  extractHeadlines();
}
