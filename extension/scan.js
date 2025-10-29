window.addEventListener("message", (event) => {
  if (!event.data) return;
  const output = document.getElementById("output");
  const { status, data, error } = event.data;

  if (status === "loading") {
    output.textContent = "🔎 Analyzing article...";
    output.style.color = "#333";
  } else if (status === "done" && data) {
    output.textContent = data.final_assessment || "No rating found.";
    output.style.fontSize = "18px";
    output.style.fontWeight = "bold";
    output.style.textAlign = "center";
  } else if (status === "error") {
    output.textContent = error || "⚠️ Unable to analyze this article.";
    output.style.color = "red";
  }
});
