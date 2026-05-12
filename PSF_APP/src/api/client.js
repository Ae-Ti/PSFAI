import axios from 'axios';

// Create a custom axios instance
const apiClient = axios.create({
  // 환경 변수가 있으면 해당 주소를 사용하고, 없으면 상대 경로(/api)를 사용합니다.
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
});

// Request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('psf_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling 401/403
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // You can dispatch a logout event here if needed
      console.error("Auth error:", error.response.status);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
