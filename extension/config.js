// Dynamically select backend URL based on environment
const BACKEND_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000/analyze/"
    : "https://your-production-api-url.com/analyze/"; // 🔁 Replace with your deployed API URL

export default BACKEND_URL;
