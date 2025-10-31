// === CONFIG ===
const CACHE_KEY = "fakeNewsDetectorCache";
const SCAN_ICON = chrome.runtime.getURL("icon.png");

// === Utilities ===
async function isArticlePage() {
  const meta = document.querySelector('meta[property="og:type"]');
  if (meta && meta.content.toLowerCase() === "article") return true;
  return (
    window.location.pathname.includes("/news/") ||
    window.location.pathname.includes("/article/")
  );
}

function getCachedResult(url) {
  const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  return cache[url];
}

function setCachedResult(url, result) {
  const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  cache[url] = result;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

// === Popup Logic ===
function showPopup(text, rating, score) {
  const popup = document.createElement("div");
  popup.className = "fake-news-popup";
  popup.innerHTML = `
    <div class="popup-header" style="cursor:move;font-weight:bold;">Fake News Detector</div>
    <div class="popup-body">Analyzing: <i>${text.slice(0, 100)}...</i></div>
    <div class="popup-result">${rating} (Score: ${score})</div>
    <button class="popup-close">×</button>
  `;
  Object.assign(popup.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    background: "#fff",
    color: "#000",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
    padding: "15px",
    width: "280px",
    fontFamily: "Arial, sans-serif",
    zIndex: 999999,
  });
  document.body.appendChild(popup);

  // Draggable logic
  const header = popup.querySelector(".popup-header");
  let offsetX, offsetY, isDown = false;
  header.addEventListener("mousedown", e => {
    isDown = true;
    offsetX = e.clientX - popup.offsetLeft;
    offsetY = e.clientY - popup.offsetTop;
  });
  document.addEventListener("mouseup", () => isDown = false);
  document.addEventListener("mousemove", e => {
    if (!isDown) return;
    popup.style.left = `${e.clientX - offsetX}px`;
    popup.style.top = `${e.clientY - offsetY}px`;
    popup.style.bottom = "auto";
    popup.style.right = "auto";
  });

  // Auto-close after 10s (pause on hover)
  let timer = setTimeout(() => popup.remove(), 10000);
  popup.addEventListener("mouseenter", () => clearTimeout(timer));
  popup.addEventListener("mouseleave", () => timer = setTimeout(() => popup.remove(), 10000));

  popup.querySelector(".popup-close").addEventListener("click", () => popup.remove());
}

// === Scan Function ===
function scanText(text) {
  chrome.runtime.sendMessage(
    { action: "analyzeText", text, url: window.location.href },
    (response) => {
      if (response?.result?.rating) {
        const { rating, score } = response.result;
        setCachedResult(window.location.href, response.result);
        showPopup(text, rating, score);
      } else {
        showPopup(text, "Error analyzing content", "N/A");
      }
    }
  );
}

// === Homepage Headlines Logic ===
function injectScanIcons() {
  const headlines = document.querySelectorAll("h1, h2, h3, article h2, a[href*='/news/']");
  headlines.forEach((el) => {
    if (el.dataset.scanAdded) return;
    el.dataset.scanAdded = true;

    const icon = document.createElement("img");
    icon.src = SCAN_ICON;
    icon.alt = "Scan";
    icon.title = "Scan this headline";
    Object.assign(icon.style, {
      width: "18px",
      height: "18px",
      marginLeft: "6px",
      cursor: "pointer",
      verticalAlign: "middle",
    });

    icon.addEventListener("click", () => scanText(el.innerText || el.textContent || ""));
    el.appendChild(icon);
  });
}

// === Main Logic ===
(async () => {
  const currentUrl = window.location.href;
  const cached = getCachedResult(currentUrl);
  const articlePage = await isArticlePage();

  if (articlePage) {
    if (!cached) {
      const text = document.querySelector("article")?.innerText || document.body.innerText.slice(0, 1000);
      scanText(text);
    } else {
      showPopup("Cached result", cached.rating, cached.score);
    }
  } else {
    injectScanIcons();
  }
})();
