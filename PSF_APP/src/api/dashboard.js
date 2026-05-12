import apiClient from './client';

export async function fetchDashboardStats() {
    const res = await apiClient.get('/dashboard/stats');
    return res.data.data;
}

export async function fetchDashboardNotes() {
    const res = await apiClient.get('/dashboard/notes');
    return res.data.data;
}

export async function fetchDashboardAttendees() {
    const res = await apiClient.get('/dashboard/attendees');
    return res.data.data;
}

export async function createDashboardNote(content) {
    const res = await apiClient.post('/dashboard/notes', { content });
    return res.data.data;
}

export async function updateDashboardNote(id, content) {
    const res = await apiClient.put(`/dashboard/notes/${id}`, { content });
    return res.data.data;
}

export async function deleteDashboardNote(id) {
    const res = await apiClient.delete(`/dashboard/notes/${id}`);
    return res.data;
}
