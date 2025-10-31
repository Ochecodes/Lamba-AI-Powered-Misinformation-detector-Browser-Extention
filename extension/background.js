chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeText") {
    fetch("http://localhost:8000/analyze/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message.text, url: message.url || "" }),
    })
      .then(res => res.json())
      .then(data => sendResponse({ result: data }))
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep the channel open for async response
  }
});
