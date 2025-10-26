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
window.addEventListener("DOMContentLoaded", async () => {
  const output = document.getElementById("output");
  const params = new URLSearchParams(window.location.search);
  const scannedText = params.get("text") || "";

  // Lightweight safety check
  if (!scannedText.trim()) {
    output.innerHTML = `<p class="error">No content found for analysis.</p>`;
    return;
  }

  // Limit text length for faster ClaimBuster response
  const truncatedText = scannedText.slice(0, 1200);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // timeout after 7s

    const response = await fetch("http://127.0.0.1:8000/analyze/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: truncatedText }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    if (result.rating) {
      output.innerHTML = `<div class="result">${result.rating}</div>`;
    } else {
      output.innerHTML = `<p class="error">⚠️ ${result.error || "Unable to analyze content."}</p>`;
    }
  } catch (error) {
    output.innerHTML = `<p class="error">🚫 ${error.name === "AbortError"
      ? "Request timed out. Try again."
      : error.message}</p>`;
  }
});
// Theme toggle
document.getElementById("toggleTheme").addEventListener("click", () => {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme");
  html.setAttribute("data-theme", current === "dark" ? "light" : "dark");
});
