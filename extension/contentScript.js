function createScanIcon(articleText) {
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icon.png");
  icon.className = "fake-news-icon";
  icon.style.cssText = `
    width: 20px;
    height: 20px;
    cursor: pointer;
    margin-left: 6px;
    vertical-align: middle;
  `;

  icon.addEventListener("click", async () => {
    console.log("[FND] Icon clicked. Extracting and analyzing...");

    // 1. Show iframe immediately
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("scan.html");
    iframe.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 280px;
      height: 180px;
      border: none;
      z-index: 999999;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      background: white;
      transition: opacity 0.3s ease;
      opacity: 0;
    `;
    document.body.appendChild(iframe);
    setTimeout(() => (iframe.style.opacity = "1"), 50);

    // 2. Send "loading" message
    iframe.onload = () => {
      iframe.contentWindow.postMessage({ status: "loading" }, "*");
    };

    // 3. Fetch from backend
    try {
      console.log("[FND] Sending article text to backend...");
      const response = await fetch("http://127.0.0.1:8000/analyze/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: articleText, url: window.location.href }),
      });

      const data = await response.json();
      console.log("[FND] Backend response:", data);

      // 4. Send result to iframe
      iframe.contentWindow.postMessage({ status: "done", data }, "*");
    } catch (err) {
      console.error("[FND] Backend fetch error:", err);
      iframe.contentWindow.postMessage({
        status: "error",
        error: "Failed to reach backend. Please try again.",
      }, "*");
    }

    // 5. Add close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.style.cssText = `
      position: fixed;
      bottom: 180px;
      right: 25px;
      background: #222;
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      cursor: pointer;
      font-size: 18px;
      z-index: 1000000;
    `;
    closeBtn.onclick = () => {
      iframe.remove();
      closeBtn.remove();
    };
    document.body.appendChild(closeBtn);
  });

  return icon;
}

function extractArticleText() {
  const article = document.querySelector("article") || document.querySelector("main");
  return article ? article.innerText.trim() : document.body.innerText.trim();
}

// Insert icon beside main headline
const headline = document.querySelector("h1");
if (headline && !headline.querySelector(".fake-news-icon")) {
  const text = extractArticleText();
  const icon = createScanIcon(text);
  headline.appendChild(icon);
}
