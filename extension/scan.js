// ===============================
// Fake News Detector - scan.js
// ===============================

console.log("[FND] Scan popup active ✅");

const loader = document.getElementById("loader");
const resultBox = document.getElementById("result");
const closeBtn = document.getElementById("closeBtn");
const header = document.getElementById("popupHeader");

let fadeTimer;
let paused = false;

// --- Close popup instantly ---
closeBtn.addEventListener("click", () => {
  window.parent.document.getElementById("fnd-popup").remove();
});

// --- Hover behavior: pause fade ---
document.body.addEventListener("mouseenter", () => { paused = true; });
document.body.addEventListener("mouseleave", () => { paused = false; });

// --- Fade-out after 10s if not hovered ---
function autoClosePopup() {
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    if (!paused) {
      const popup = window.parent.document.getElementById("fnd-popup");
      if (popup) {
        popup.style.opacity = "0";
        setTimeout(() => popup.remove(), 500);
      }
    } else {
      autoClosePopup(); // recheck every few seconds
    }
  }, 10000);
}

// --- Make popup draggable ---
let offsetX, offsetY, isDragging = false;

header.addEventListener("mousedown", (e) => {
  isDragging = true;
  offsetX = e.clientX;
  offsetY = e.clientY;
});

window.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const popup = window.parent.document.getElementById("fnd-popup");
    const rect = popup.getBoundingClientRect();
    popup.style.top = rect.top + (e.clientY - offsetY) + "px";
    popup.style.left = rect.left + (e.clientX - offsetX) + "px";
    popup.style.bottom = "auto";
    popup.style.right = "auto";
    offsetX = e.clientX;
    offsetY = e.clientY;
  }
});

window.addEventListener("mouseup", () => (isDragging = false));

// --- Listen for messages from contentScript ---
window.addEventListener("message", (event) => {
  const { status, data, error } = event.data;

  if (status === "loading") {
    loader.style.display = "block";
    resultBox.innerHTML = "<p>Analyzing… Please wait.</p>";
  } else if (status === "done" && data) {
    loader.style.display = "none";
    resultBox.innerHTML = `
      <h3>${data.rating}</h3>
      <p><strong>Score:</strong> ${data.score}</p>
      <p><a href="${data.source_url}" target="_blank">View Source</a></p>
    `;
    autoClosePopup();
  } else if (status === "error") {
    loader.style.display = "none";
    resultBox.innerHTML = `<p style="color:red;">❌ ${error}</p>`;
    autoClosePopup();
  }
});
