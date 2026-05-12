import apiClient from './client';

export async function fetchChatbotHistory() {
    const res = await apiClient.get('/chatbot/history');
    return res.data.data;
}

export async function sendChatbotMessage(message) {
    const res = await apiClient.post('/chatbot/message', { message });
    return res.data.data;
}
