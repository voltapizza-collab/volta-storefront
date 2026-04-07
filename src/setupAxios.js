import axios from "axios";

const baseURL =
  process.env.REACT_APP_API_URL?.trim() || "http://localhost:8080";

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
