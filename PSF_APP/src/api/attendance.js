import apiClient from './client';

export async function fetchMyAttendance() {
    const res = await apiClient.get('/attendance/me');
    return res.data.data;
}

export async function checkIn(qrData) {
    const res = await apiClient.post('/attendance', { qrData });
    return res.data.data;
}

export async function resetAttendance() {
    const res = await apiClient.post('/attendance/reset');
    return res.data;
}

export async function fetchSnapshots() {
    const res = await apiClient.get('/attendance/snapshots');
    return res.data.data;
}

export async function fetchSnapshotDetails(id) {
    const res = await apiClient.get(`/attendance/snapshots/${id}/details`);
    return res.data.data;
}

export function downloadSnapshotCsv(id, resetAt) {
    const token = sessionStorage.getItem('psf_token');
    const url = `/api/attendance/snapshots/${id}/export${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    // Build filename from resetAt timestamp (same format as server)
    let fileName = 'attendance.csv';
    if (resetAt) {
        try {
            const d = new Date(resetAt);
            const pad = (n) => String(n).padStart(2, '0');
            fileName = `attendance_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.csv`;
        } catch (_) { /* use default */ }
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName; // Must be set explicitly for Chrome to respect filename
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.parentNode && a.parentNode.removeChild(a), 500);
}
