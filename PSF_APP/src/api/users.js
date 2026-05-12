import apiClient from './client';

export async function fetchAllUsers() {
    const res = await apiClient.get('/users');
    return res.data.data;
}

export async function createUser(userData) {
    const res = await apiClient.post('/users', userData);
    return res.data;
}

export async function updateUser(id, userData) {
    const res = await apiClient.put(`/users/${id}`, userData);
    return res.data;
}

export async function deleteUser(id) {
    const res = await apiClient.delete(`/users/${id}`);
    return res.data;
}

export async function fetchContacts(keyword = '') {
    const res = await apiClient.get('/users/contacts', {
        params: { keyword }
    });
    return res.data.data;
}

export async function updateProfile(profileData) {
    const res = await apiClient.put('/users/me', profileData);
    return res.data.data;
}

export async function fetchProfile() {
    const res = await apiClient.get('/users/me');
    return res.data.data;
}
