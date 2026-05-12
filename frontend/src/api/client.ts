import axios from "axios";

const apiBase =
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export const api = axios.create({
  baseURL: apiBase
});

export function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

