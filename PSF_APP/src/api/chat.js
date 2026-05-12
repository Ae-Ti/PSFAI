import apiClient from './client';

export async function fetchRooms() {
    const res = await apiClient.get('/chat/rooms');
    return res.data.data;
}

export async function fetchMessages(roomId) {
    const res = await apiClient.get(`/chat/rooms/${roomId}/messages`);
    return res.data.data;
}

export async function sendMessage(roomId, content) {
    const res = await apiClient.post(`/chat/rooms/${roomId}/messages`, { content });
    return res.data.data;
}
