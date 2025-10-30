// scan.js
window.addEventListener("message", (event) => {
  if (!event.data) return;

  const output = document.getElementById("output");
  const { status, data, error, text, url } = event.data;

  if (status === "loading") {
    output.textContent = "🔎 Analyzing article...";
    output.style.color = "#333";
    return;
  }

  // 🔹 When contentScript sends extracted text, trigger backend analysis through background.js
  if (status === "start" && text) {
    chrome.runtime.sendMessage(
      { action: "analyzeText", text, url },
      (response) => {
        if (!response) return;
        if (response.error) {
          output.textContent = `⚠️ ${response.error}`;
          output.style.color = "red";
          return;
        }

        output.textContent = response.rating || "No rating found.";
        output.style.fontSize = "18px";
        output.style.fontWeight = "bold";
        output.style.textAlign = "center";
      }
    );
  }

  if (status === "error") {
    output.textContent = error || "⚠️ Unable to analyze this article.";
    output.style.color = "red";
  }
});
