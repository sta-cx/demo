import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// 请求拦截器 - 添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证相关
export const auth = {
  sendCode(phone) {
    return api.post('/auth/send-code', { phone });
  },
  login(phone, code) {
    return api.post('/auth/login', { phone, code });
  }
};

// 问题相关
export const questions = {
  getToday() {
    return api.get('/questions/today');
  },
  submitAnswer(data) {
    return api.post('/questions/answer', data);
  },
  getHistory(params = {}) {
    return api.get('/questions/history', { params });
  }
};

// 情侣相关
export const couple = {
  bind(phone) {
    return api.post('/couple/bind', { phone });
  }
};

export default api;
