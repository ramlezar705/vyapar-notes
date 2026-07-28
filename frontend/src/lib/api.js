import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const fetchMonths = () => api.get("/months").then((r) => r.data.months);
export const fetchEntries = (month) => api.get(`/entries`, { params: { month } }).then((r) => r.data.entries);
export const fetchSummary = (month) => api.get(`/summary`, { params: { month } }).then((r) => r.data);
export const patchEntry = (id, payload) => api.patch(`/entries/${id}`, payload).then((r) => r.data);
export const fetchItemRates = () => api.get(`/item-rates`).then((r) => r.data.rates || {});
export const deleteEntry = (id) => api.delete(`/entries/${id}`).then((r) => r.data);
export const createEntry = (payload) => api.post(`/entries`, payload).then((r) => r.data);
export const bulkRate = (payload) => api.post(`/entries/bulk-rate`, payload).then((r) => r.data);
export const bulkRatesApply = (payload) => api.post(`/entries/rates/bulk-apply`, payload).then((r) => r.data);
export const uploadPdf = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post(`/upload-pdf`, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 30000 }).then((r) => r.data);
};
export const uploadStatus = (jobId) => api.get(`/upload-status/${jobId}`).then((r) => r.data);
export const deleteMonth = (month) => api.delete(`/month/${month}`).then((r) => r.data);

export const formatINR = (n) => {
  const num = Number(n || 0);
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

export const formatNumber = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const monthLabel = (m) => {
  if (!m) return "";
  const [y, mo] = m.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(mo, 10) - 1]} ${y}`;
};
