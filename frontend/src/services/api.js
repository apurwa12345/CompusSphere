import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 120000,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Clear token only on explicit unauthorized responses.
        // 422 is often a normal validation error and should not force logout.
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            // Force a reload or redirect if needed, but AuthContext handles this usually
        }
        return Promise.reject(error);
    }
);

export default api;
