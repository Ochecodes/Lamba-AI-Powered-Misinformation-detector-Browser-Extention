// scan.js (robust: accept prefetch, else fetch backend, show rating only)
// keep UI structure in scan.html unchanged

(function(){
  const output = document.getElementById("output");
  const params = new URLSearchParams(window.location.search);
  const passedText = params.get("text") || "";

  // Show immediate short feedback
  function showLoading() {
    if (!output) return;
    output.textContent = "⏳ Analyzing article...";
  }

  function showResult(ratingText) {
    if (!output) return;
    output.textContent = ratingText;
  }

  function showError(msg) {
    if (!output) return;
    output.textContent = msg;
  }

  // Try to use backendData sent by content script (prefetch). The content script posts message type "claimbuster_prefetch"
  let prefetchHandled = false;
  window.addEventListener("message", async (event) => {
    try {
      const data = event.data;
      if (!data) return;
      if (data.type === "claimbuster_prefetch") {
        // backendData may be null if prefetch failed
        prefetchHandled = true;
        const backendData = data.backendData;
        if (backendData && (backendData.final_assessment || backendData.rating || backendData.result)) {
          // Accept multiple field names to be resilient
          const rating = backendData.final_assessment || backendData.rating || backendData.result;
          showResult(rating);
        } else {
          // If prefetch returned nothing useful, fallback to local fetch
          console.log("[scan.js] prefetch returned no final_assessment — calling backend directly...");
          await callBackendAndShow(passedText);
        }
      }
    } catch (err) {
      console.error("[scan.js] message handler error:", err);
    }
  }, false);

  // If no prefetch message arrives in a short time, fetch directly
  async function callBackendAndShow(textToSend) {
    if (!textToSend || textToSend.trim().length === 0) {
      showError("⚠️ No text provided for analysis.");
      return;
    }

    showLoading();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(()=> controller.abort(), 8000);
      const resp = await fetch("http://127.0.0.1:8000/analyze/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        showError("❌ Backend error: " + resp.status);
        return;
      }

      const json = await resp.json();
      if (json.final_assessment) {
        showResult(json.final_assessment);
      } else if (json.rating) {
        showResult(json.rating);
      } else {
        showError("⚠️ Unable to determine credibility.");
      }
    } catch (err) {
      if (err.name === "AbortError") showError("⏱️ Analysis timed out.");
      else showError("🚫 Error contacting backend.");
      console.error("[scan.js] callBackendAndShow error:", err);
    }
  }

  // Kickoff: wait briefly for prefetch message, else fetch
  (async function init(){
    showLoading();
    // give contentScript a short window (600ms) to post the prefetch payload
    await new Promise(r => setTimeout(r, 600));
    if (!prefetchHandled) {
      // if contentScript didn't prefetch or post, call backend directly
      await callBackendAndShow(passedText);
    }
  })();
})();
