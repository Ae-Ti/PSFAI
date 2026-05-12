// src/api/notices.js
import apiClient from './client';

const API_BASE = '/notices';

export async function fetchNotices() {
  const res = await apiClient.get(API_BASE);
  return res.data.data;
}

export async function createNotice(notice) {
  const res = await apiClient.post(API_BASE, notice);
  return res.data.data;
}

export async function updateNotice(id, notice) {
  const res = await apiClient.put(`${API_BASE}/${id}`, notice);
  return res.data.data;
}

export async function deleteNotice(id) {
  const res = await apiClient.delete(`${API_BASE}/${id}`);
  return res.data.data;
}

export async function generateAiDraft(prompt) {
    const res = await apiClient.post(`${API_BASE}/ai-draft`, { prompt });
    return res.data.data;
}
