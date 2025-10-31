// === contentScript.js ===

// Helper: check if page looks like a news article
function isArticlePage() {
  const ogType = document.querySelector('meta[property="og:type"]');
  if (ogType && ogType.content === "article") return true;
  const url = window.location.href;
  return /(\/news\/|\/article\/|\/story\/)/i.test(url);
}

// Helper: avoid scanning same page repeatedly
if (window.__fakeNewsScanned) return;
window.__fakeNewsScanned = true;

const SCAN_ICON = chrome.runtime.getURL("icons/icon.png");

// Helper: create scan icon beside headlines
function addScanIcons() {
  const headlines = document.querySelectorAll("h1, h2, h3, article h1, article h2, article h3");
  headlines.forEach((h) => {
    if (h.dataset.scanAttached) return;
    h.dataset.scanAttached = true;

    const icon = document.createElement("img");
    icon.src = SCAN_ICON;
    icon.alt = "Scan";
    icon.style.width = "20px";
    icon.style.height = "20px";
    icon.style.marginLeft = "8px";
    icon.style.cursor = "pointer";
    icon.style.verticalAlign = "middle";
    icon.style.opacity = "0.85";
    icon.title = "Scan this headline";

    // On click → show iframe popup (not redirect)
    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      const text = h.innerText.trim();
      showScanPopup(text);
    });

    h.appendChild(icon);
  });
}

// Helper: show floating analysis popup
function showScanPopup(text) {
  const oldPopup = document.getElementById("fake-news-popup");
  if (oldPopup) oldPopup.remove();

  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("scan.html");
  iframe.id = "fake-news-popup";
  iframe.style.position = "fixed";
  iframe.style.bottom = "20px";
  iframe.style.right = "20px";
  iframe.style.width = "360px";
  iframe.style.height = "260px";
  iframe.style.border = "none";
  iframe.style.zIndex = "999999";
  iframe.style.borderRadius = "10px";
  iframe.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
  iframe.style.transition = "opacity 0.3s ease";
  iframe.style.opacity = "1";

  document.body.appendChild(iframe);

  // Send analysis request to iframe
  setTimeout(() => {
    iframe.contentWindow.postMessage({ status: "loading" }, "*");

    fetch("http://localhost:8000/analyze/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, url: window.location.href }),
    })
      .then((res) => res.json())
      .then((data) => {
        iframe.contentWindow.postMessage({ status: "done", data }, "*");
      })
      .catch(() => {
        iframe.contentWindow.postMessage({ status: "error", error: "⚠️ Unable to analyze." }, "*");
      });
  }, 500);

  // Auto-close after 1 minute (60000ms)
  let timeout = setTimeout(() => iframe.remove(), 60000);

  // Pause close timer on hover
  iframe.addEventListener("mouseenter", () => clearTimeout(timeout));
  iframe.addEventListener("mouseleave", () => {
    timeout = setTimeout(() => iframe.remove(), 60000);
  });
}

// === MAIN LOGIC ===
if (isArticlePage()) {
  // Auto-scan article pages
  const mainContent =
    document.querySelector("article")?.innerText ||
    document.body.innerText.slice(0, 5000);

  showScanPopup(mainContent);
  addScanIcons(); // Also allow manual re-scan on headline
} else {
  // Homepage → show icons only
  addScanIcons();
}
