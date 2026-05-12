import apiClient from './client';

export async function updateGpsLocation(gpsData) {
    const res = await apiClient.put('/gps', gpsData);
    return res.data.data;
}

export async function fetchGpsLocations() {
    const res = await apiClient.get('/gps');
    return res.data.data;
}
