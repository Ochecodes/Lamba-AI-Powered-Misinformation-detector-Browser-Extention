// popup.js
document.getElementById("scanBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Extract page text via content script
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: () => document.body.innerText,
    },
    async (results) => {
      const text = results[0]?.result || "";
      if (!text || text.length < 20) {
        alert("No readable text found on this page.");
        return;
      }

      // 🔹 Send message to background.js instead of direct fetch
      chrome.runtime.sendMessage(
        { action: "analyzeText", text, url: tab.url },
        (data) => {
          if (!data) return;

          if (data.error) {
            document.getElementById("fakeNewsCard").innerHTML = `
              <h4>Realtime News Verification</h4>
              <span class='negative'>⚠️ ${data.error}</span>
            `;
            return;
          }

          document.getElementById("fakeNewsCard").innerHTML = `
            <h4>Realtime News Verification</h4>
            ${data.rating.includes("false") ? 
              "<span class='negative'>⚠️ Likely Fake</span>" : 
              "<span class='positive'>✅ Seems Legit</span>"}
          `;

          const sentimentClass =
            data.sentiment?.label === "POSITIVE" ? "positive" :
            data.sentiment?.label === "NEGATIVE" ? "negative" : "neutral";

          document.getElementById("sentimentCard").innerHTML = `
            <h4>📊 Sentiment</h4>
            <span class="${sentimentClass}">${data.sentiment?.label || "NEUTRAL"}</span><br>
            Score: ${data.sentiment?.score?.toFixed(2) || "0.00"}
          `;

          document.getElementById("sourceCard").innerHTML = `
            <h4>🔎 Source Verification</h4>
            ${data.source_verified ? "<span class='positive'>✅ Verified</span>" : "<span class='negative'>❌ Not Verified</span>"}
          `;
        }
      );
    }
  );
});

// Theme toggle
document.getElementById("toggleTheme").addEventListener("click", () => {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme");
  html.setAttribute("data-theme", current === "dark" ? "light" : "dark");
});
