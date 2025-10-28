// === contentScript.js ===

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

    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("scan.html");
    iframe.loading = "lazy";
    Object.assign(iframe.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "320px",
      height: "180px",
      border: "1px solid #ccc",
      borderRadius: "10px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
      zIndex: "999999",
      background: "#fff",
      transition: "opacity 0.25s ease",
      opacity: "0"
    });
    document.body.appendChild(iframe);
    setTimeout(() => (iframe.style.opacity = "1"), 50);

    // Add close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    Object.assign(closeBtn.style, {
      position: "fixed",
      bottom: "190px",
      right: "25px",
      background: "#fff",
      border: "1px solid #ccc",
      borderRadius: "50%",
      width: "24px",
      height: "24px",
      fontSize: "16px",
      lineHeight: "20px",
      textAlign: "center",
      cursor: "pointer",
      zIndex: "1000000"
    });
    closeBtn.addEventListener("click", () => {
      iframe.remove();
      closeBtn.remove();
    });
    document.body.appendChild(closeBtn);

    // Send initial "analyzing" state to iframe
    iframe.onload = () => {
      iframe.contentWindow.postMessage(
        { type: "scan", backendData: { final_assessment: "⏳ Analyzing article..." } },
        "*"
      );
    };

    // Perform backend request (with timeout)
    const backendURL = "http://127.0.0.1:8000/analyze/";
    let backendData = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000); // 7s timeout

      const response = await fetch(backendURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, url: window.location.href }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      backendData = response.ok
        ? await response.json()
        : { final_assessment: "⚠️ Unable to analyze article." };
    } catch (err) {
      backendData = { final_assessment: "❌ Connection timed out." };
      console.error("Backend fetch error:", err);
    }

    // Always update iframe (even if timeout)
    setTimeout(() => {
      iframe.contentWindow.postMessage({ type: "scan", backendData }, "*");
    }, 500);
  });

  return icon;
}

function isLikelyArticlePage() {
  const meta = document.querySelector('meta[property="og:type"]');
  const article = document.querySelector("article");
  return (
    (meta && meta.content === "article") ||
    window.location.pathname.length > 40 ||
    article !== null
  );
}

function extractFullArticleText() {
  const article = document.querySelector("article");
  if (article) return article.innerText.trim();
  const main = document.querySelector("main");
  if (main) return main.innerText.trim();
  const body = document.body.innerText.trim();
  return body.length > 500 ? body : null;
}

function extractHeadlines() {
  const selectors = "h1, h2, h3, .headline, .news-title, .story-title";
  const headlines = document.querySelectorAll(selectors);
  const scanned = new Set();

  headlines.forEach((el) => {
    const text = el.innerText.trim();
    if (
      !text ||
      text.length < 10 ||
      scanned.has(text) ||
      /(login|subscribe|advert|menu|read more)/i.test(text)
    )
      return;
    if (!el.querySelector("img.fake-news-icon")) {
      const icon = createScanIcon(text);
      icon.classList.add("fake-news-icon");
      el.appendChild(icon);
      scanned.add(text);
    }
  });
}

function addIconToArticleHeadline() {
  const h1 =
    document.querySelector("article h1") ||
    document.querySelector("main h1") ||
    document.querySelector("h1");
  if (h1 && !h1.querySelector("img.fake-news-icon")) {
    const text = extractFullArticleText();
    if (text) {
      const icon = createScanIcon(text);
      icon.classList.add("fake-news-icon");
      h1.appendChild(icon);
    }
  }
}

if (isLikelyArticlePage()) addIconToArticleHeadline();
else extractHeadlines();
