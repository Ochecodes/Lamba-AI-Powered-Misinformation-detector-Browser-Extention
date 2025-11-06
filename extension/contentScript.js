// === contentScript.js (fixed behavior + styled popup retained) ===
console.log("[FND] Content script (behavior fixes + styled UI) loaded ✅");

const CACHE_KEY = "fakeNewsDetectorCache";
const ICON_SRC = chrome.runtime.getURL("icon.png");

// --- Helpers: cache ---
function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
}
function getCachedResult(url) {
  const cache = getCache();
  return cache[url];
}
function setCachedResult(url, result) {
  const cache = getCache();
  cache[url] = result;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

// --- Helpers: article detection ---
function isArticlePage() {
  const meta = document.querySelector('meta[property="og:type"]');
  if (meta && meta.content.toLowerCase().includes("article")) return true;

  const articleEl = document.querySelector("article");
  if (articleEl) return true;

  const h1 = document.querySelectorAll("h1");
  const wc = document.body.innerText.split(/\s+/).length;
  if (h1.length === 1 && wc > 250) return true;

  const path = window.location.pathname;
  if (/\/\d{4}\/\d{2}\/\d{2}\//.test(path) || /(\/news\/|\/article\/|\/story\/)/.test(path)) return true;

  return false;
}

// --- Select headline elements ---
function getHeadlineElements() {
  const candidates = Array.from(document.querySelectorAll("h1, h2, h3, a[href*='/news/'], article h2"));
  return candidates.filter(el => {
    const txt = (el.innerText || el.textContent || "").trim();
    if (!txt || txt.length < 10) return false;
    if (el.closest("header, footer, nav, aside")) return false;
    return true;
  });
}

// --- Map backend rating to simplified label ---
function mapRatingToLabel(backendRating) {
  if (!backendRating || typeof backendRating !== "string") return null;
  const r = backendRating.toLowerCase();
  if (r.includes("highly") || r.includes("trust")) return { label: "Verified", emoji: "✅", color: "#0b8a3e" };
  if (r.includes("possibly") || r.includes("mislead") || r.includes("misleading")) return { label: "Misleading", emoji: "⚠️", color: "#d97706" };
  if (r.includes("potentially") || r.includes("false") || r.includes("unverified")) return { label: "Unverified", emoji: "❌", color: "#c53030" };
  return { label: backendRating, emoji: "", color: "#444" };
}

// --- Create styled popup (UI unchanged, timeout now 1min) ---
function createStyledPopup() {
  const existing = document.getElementById("fnd-styled-popup");
  if (existing) existing.remove();

  const wrapper = document.createElement("div");
  wrapper.id = "fnd-styled-popup";
  Object.assign(wrapper.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "320px",
    maxWidth: "calc(100vw - 40px)",
    background: "#ffffff",
    borderRadius: "10px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
    zIndex: 2147483647,
    fontFamily: "Inter, 'Segoe UI', Arial, sans-serif",
    color: "#111",
    overflow: "hidden",
    transition: "opacity 0.3s ease"
  });

  const header = document.createElement("div");
  header.textContent = "Fake News Detector";
  Object.assign(header.style, {
    background: "#0f62fe",
    color: "#fff",
    padding: "10px 12px",
    fontWeight: "600",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "move"
  });
  wrapper.appendChild(header);

  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "✕";
  Object.assign(closeBtn.style, {
    background: "transparent",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    lineHeight: "1",
    padding: "4px"
  });
  closeBtn.addEventListener("click", () => wrapper.remove());
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  Object.assign(body.style, { padding: "16px", textAlign: "center" });

  const loader = document.createElement("div");
  loader.id = "fnd-loader";
  Object.assign(loader.style, {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px"
  });

  const spinner = document.createElement("div");
  Object.assign(spinner.style, {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "4px solid #e6eefc",
    borderTop: "4px solid #0f62fe",
    animation: "fnd-spin 1s linear infinite"
  });

  const analyzingText = document.createElement("div");
  analyzingText.textContent = "Analyzing…";
  Object.assign(analyzingText.style, { fontSize: "15px", color: "#333", fontWeight: "600" });

  loader.appendChild(spinner);
  loader.appendChild(analyzingText);

  const resultArea = document.createElement("div");
  resultArea.id = "fnd-result-area";
  Object.assign(resultArea.style, { marginTop: "12px", minHeight: "36px" });

  body.appendChild(loader);
  body.appendChild(resultArea);
  wrapper.appendChild(body);

  const styleTag = document.createElement("style");
  styleTag.textContent = `@keyframes fnd-spin { to { transform: rotate(360deg); } }`;
  wrapper.appendChild(styleTag);

  let autoCloseTimer = null;
  function scheduleAutoClose() {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => {
      wrapper.style.opacity = "0";
      setTimeout(() => wrapper.remove(), 400);
    }, 60000); // 1 min
  }

  wrapper.addEventListener("mouseenter", () => clearTimeout(autoCloseTimer));
  wrapper.addEventListener("mouseleave", scheduleAutoClose);

  // Make draggable
  let isDragging = false, startX=0, startY=0, origLeft=0, origTop=0;
  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = wrapper.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;
    wrapper.style.position = "fixed";
    wrapper.style.right = "auto";
    wrapper.style.bottom = "auto";
    wrapper.style.left = `${origLeft}px`;
    wrapper.style.top = `${origTop}px`;
    wrapper.style.transition = "none";
    document.body.style.userSelect = "none";
  });
  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    wrapper.style.left = `${origLeft + dx}px`;
    wrapper.style.top = `${origTop + dy}px`;
  });
  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      wrapper.style.transition = "opacity 0.3s ease";
      document.body.style.userSelect = "";
      scheduleAutoClose();
    }
  });

  document.body.appendChild(wrapper);

  return {
    setLoading: (isLoading) => {
      loader.style.display = isLoading ? "flex" : "none";
    },
    showResult: ({ label, emoji, color, score }) => {
      loader.style.display = "none";
      resultArea.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <div style="font-size:28px; font-weight:700; color:${color};">${emoji} ${label}</div>
          ${score !== undefined && score !== null ? `<div style="font-size:13px;color:#666">Confidence: ${score}</div>` : ""}
        </div>`;
    },
    showError: (msg) => {
      loader.style.display = "none";
      resultArea.innerHTML = `<div style="color:#b91c1c;font-weight:600">${msg}</div>`;
    },
    scheduleAutoClose
  };
}

// --- Scan with styled popup ---
function scanTextWithPopup(text) {
  const popup = createStyledPopup();
  popup.scheduleAutoClose();
  chrome.runtime.sendMessage({ action: "analyzeText", text, url: window.location.href }, (resp) => {
    if (!resp || resp.error) {
      popup.showError("Failed to analyze content. Try again.");
      return;
    }
    const data = resp.result || resp;
    if (data.error) {
      popup.showError(data.error);
      return;
    }
    const mapped = mapRatingToLabel(data.rating);
    if (!mapped) {
      popup.showError("Could not interpret result.");
      return;
    }
    popup.showResult({ label: mapped.label, emoji: mapped.emoji, color: mapped.color, score: data.score });
    setCachedResult(window.location.href, { rating: mapped.label, score: data.score });
    popup.scheduleAutoClose();
  });
}

// --- Inject icons beside headlines ---
function injectIconsForHeadlines() {
  const els = getHeadlineElements();
  els.forEach(el => {
    if (el.dataset.fndAttached) return;
    el.dataset.fndAttached = "1";

    const icon = document.createElement("img");
    icon.src = ICON_SRC;
    icon.alt = "Scan";
    icon.title = "Scan this headline";
    Object.assign(icon.style, {
      width: "18px",
      height: "18px",
      marginLeft: "8px",
      cursor: "pointer",
      verticalAlign: "middle"
    });

    icon.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = el.innerText.trim();
      if (text.length < 8) return;
      scanTextWithPopup(text);
    });

    el.appendChild(icon);
  });
}

// === Main logic ===
(async function main() {
  const url = window.location.href;
  const cached = getCachedResult(url);

  if (isArticlePage()) {
    injectIconsForHeadlines(); // show icon beside main headline too

    if (cached) {
      const p = createStyledPopup();
      const emoji = cached.rating === "Verified" ? "✅" :
                    cached.rating === "Misleading" ? "⚠️" : "❌";
      const color = cached.rating === "Verified" ? "#0b8a3e" :
                    cached.rating === "Misleading" ? "#d97706" : "#c53030";
      p.showResult({ label: cached.rating, emoji, color, score: cached.score });
      p.scheduleAutoClose();
    } else {
      const article = document.querySelector("article");
      let text = article ? article.innerText.trim() : document.body.innerText.trim();
      text = text.slice(0, 20000);
      scanTextWithPopup(text);
    }
  } else {
    injectIconsForHeadlines();
    const observer = new MutationObserver(() => injectIconsForHeadlines());
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
