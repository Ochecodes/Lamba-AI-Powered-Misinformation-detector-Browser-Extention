// window.addEventListener("DOMContentLoaded", () => {
//   const params = new URLSearchParams(window.location.search);
//   const scannedText = params.get("text") || "";

//   const input = document.getElementById("textInput");
//   const button = document.getElementById("scanBtn");
//   const output = document.getElementById("output");
//   const closeBtn = document.getElementById("closeBtn");
//   const loader = document.getElementById("loader");

//   input.value = scannedText;

//   // Close button logic
//   closeBtn.addEventListener("click", () => {
//     const iframe = window.frameElement;
//     if (iframe && iframe.parentNode) {
//       iframe.parentNode.removeChild(iframe);
//     }
//   });

//   const performScan = async () => {
//     const text = input.value;
//     const url = window.location.href;

//     output.textContent = "";
//     loader.style.display = "block";

//     try {
//       const response = await fetch("http://127.0.0.1:8000/analyze/", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ text, url })
//       });

//       const result = await response.json();
//       loader.style.display = "none";
//       output.textContent = JSON.stringify(result, null, 2);
//     } catch (err) {
//       loader.style.display = "none";
//       output.textContent = "❌ Error: " + err.message;
//     }
//   };

//   button.addEventListener("click", performScan);

//   // Auto-trigger scan if text is passed in
//   if (scannedText) {
//     performScan();
//   }
// });

// window.addEventListener("message", async (event) => {
//   const data = event.data;
//   if (!data || data.type !== "scan") return;

//   const statusEl = document.getElementById("status");
//   const loadingEl = document.getElementById("loading");

//   loadingEl.style.display = "block";
//   statusEl.style.display = "none";

//   try {
//     let { backendData, text } = data;

//     // If backend data not provided (fallback)
//     if (!backendData) {
//       const response = await fetch("http://localhost:8000/analyze", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ text }),
//       });
//       backendData = await response.json();
//     }

//     // Get rating info
//     const result = backendData.final_assessment || "Unable to assess.";
//     const level = backendData.level || "low";

//     // Style based on result
//     statusEl.className = level;
//     statusEl.textContent = result;

//     loadingEl.style.display = "none";
//     statusEl.style.display = "block";
//   } catch (err) {
//     loadingEl.textContent = "Error loading analysis.";
//     console.error("Scan error:", err);
//   }
// });

// window.addEventListener("DOMContentLoaded", async () => {
//   const params = new URLSearchParams(window.location.search);
//   const scannedText = params.get("text") || "";
//   const output = document.getElementById("output");
//   const scanBtn = document.getElementById("scanBtn");
//   const inputField = document.getElementById("textInput");

//   // Keep animations and design intact — just update backend logic
//   if (inputField) inputField.value = scannedText;
//   if (!scannedText) {
//     output.textContent = "⚠️ No article text found.";
//     return;
//   }

//   async function analyzeText() {
//     output.textContent = "⏳ Analyzing article...";
//     try {
//       const response = await fetch("http://127.0.0.1:8000/analyze/", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ text: scannedText, url: window.location.href }),
//       });

//       if (!response.ok) throw new Error("Backend error");

//       const result = await response.json();

//       // Display only the rating (final_assessment)
//       if (result.final_assessment) {
//         output.innerHTML = `<span class="rating-text">${result.final_assessment}</span>`;
//       } else {
//         output.innerHTML = `<span class="error-text">⚠️ Could not determine credibility.</span>`;
//       }
//     } catch (err) {
//       console.error("Backend connection failed:", err);
//       output.innerHTML = `<span class="error-text">❌ Unable to connect to backend.</span>`;
//     }
//   }

//   // Automatically analyze if text was passed from contentScript
//   await analyzeText();

//   // Also trigger analyze when the scan button is clicked
//   if (scanBtn) {
//     scanBtn.addEventListener("click", analyzeText);
//   }
// });

window.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const scannedText = params.get("text") || "";
  const output = document.getElementById("output");
  const scanBtn = document.getElementById("scanBtn");
  const inputField = document.getElementById("textInput");

  // Keep your frontend design — this just improves performance
  if (inputField) inputField.value = scannedText;

  // Add a subtle shimmer/animation while waiting (optional)
  function showLoading() {
    output.innerHTML = `<div class="loading">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        <p>Analyzing article...</p>
      </div>`;
  }

  // Reusable backend request logic
  async function fetchRating(text) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // ⏱️ auto-cancel after 8s

      const response = await fetch("http://127.0.0.1:8000/analyze/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, url: window.location.href }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) throw new Error("Backend error");

      const result = await response.json();
      return result;
    } catch (err) {
      console.warn("Backend request failed:", err.message);
      return { error: "⚠️ Unable to reach backend service." };
    }
  }

  // Main analyze function
  async function analyzeText() {
    if (!scannedText) {
      output.textContent = "⚠️ No article text found.";
      return;
    }

    showLoading();

    // 🔹 Preload the backend call as soon as possible (non-blocking)
    const backendPromise = fetchRating(scannedText);

    // 🔹 Meanwhile, allow UI animations to render first
    await new Promise((r) => setTimeout(r, 300));

    const result = await backendPromise;

    if (result.error) {
      output.innerHTML = `<p class="error-text">${result.error}</p>`;
      return;
    }

    // 🔹 Display only the final rating (styled text)
    if (result.final_assessment) {
      output.innerHTML = `<div class="rating-container">
          <p class="rating-text">${result.final_assessment}</p>
        </div>`;
    } else {
      output.innerHTML = `<p class="error-text">⚠️ Unable to determine credibility.</p>`;
    }
  }

  // Auto-run when contentScript passes article text
  if (scannedText) analyzeText();

  // Also allow manual re-scan
  if (scanBtn) scanBtn.addEventListener("click", analyzeText);
});
