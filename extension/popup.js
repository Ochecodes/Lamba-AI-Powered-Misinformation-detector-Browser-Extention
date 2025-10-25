document.getElementById("scanBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: () => document.body.innerText,
    },
    async (results) => {
      const text = results[0].result;
      const response = await fetch("http://127.0.0.1:8000/analyze/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Time": new Date().toISOString()
        },
        body: JSON.stringify({ text: text, url: tab.url }),
      });

      const data = await response.json();

      document.getElementById("fakeNewsCard").innerHTML = `
        <h4>Lamba: Realtime News Verification</h4>
        ${data.is_fake ? "<span class='negative'>⚠️ Likely Fake</span>" : "<span class='positive'>✅ Seems Legit</span>"}
      `;

      const sentimentClass =
        data.sentiment.label === "POSITIVE" ? "positive" :
        data.sentiment.label === "NEGATIVE" ? "negative" : "neutral";

      document.getElementById("sentimentCard").innerHTML = `
        <h4>📊 Sentiment</h4>
        <span class="${sentimentClass}">${data.sentiment.label}</span><br>
        Score: ${data.sentiment.score.toFixed(2)}
      `;

      document.getElementById("sourceCard").innerHTML = `
        <h4>🔎 Source Verification</h4>
        ${data.source_verified ? "<span class='positive'>✅ Verified</span>" : "<span class='negative'>❌ Not Verified</span>"}
      `;
    }
  );
});

// Theme toggle
document.getElementById("toggleTheme").addEventListener("click", () => {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme");
  html.setAttribute("data-theme", current === "light" ? "dark" : "light");
});
