<template>
  <div class="login-container">
    <div class="login-card">
      <h1>每日问答</h1>
      <p class="subtitle">情侣专属的每日互动</p>

      <div v-if="!step2">
        <div class="input-group">
          <input
            v-model="phone"
            type="tel"
            placeholder="请输入手机号"
            maxlength="11"
          />
        </div>
        <button @click="sendCode" :disabled="loading">
          {{ loading ? '发送中...' : '获取验证码' }}
        </button>
      </div>

      <div v-else>
        <div class="input-group">
          <input
            v-model="code"
            type="text"
            placeholder="请输入验证码"
            maxlength="6"
          />
        </div>
        <button @click="login" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { auth } from '../api';

const router = useRouter();
const phone = ref('');
const code = ref('');
const step2 = ref(false);
const loading = ref(false);
const error = ref('');

const sendCode = async () => {
  if (!/^1\d{10}$/.test(phone.value)) {
    error.value = '请输入正确的手机号';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    await auth.sendCode(phone.value);
    step2.value = true;
  } catch (e) {
    error.value = e.response?.data?.error || '发送失败';
  } finally {
    loading.value = false;
  }
};

const login = async () => {
  if (code.value.length !== 6) {
    error.value = '验证码必须是6位数字';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const res = await auth.login(phone.value, code.value);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    router.push('/');
  } catch (e) {
    error.value = e.response?.data?.error || '登录失败';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  text-align: center;
  width: 320px;
}

h1 {
  margin: 0;
  color: #333;
  font-size: 24px;
}

.subtitle {
  color: #666;
  margin: 8px 0 32px;
  font-size: 14px;
}

.input-group {
  margin-bottom: 16px;
}

input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  box-sizing: border-box;
}

input:focus {
  border-color: #667eea;
}

button {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: opacity 0.2s;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #e74c3c;
  font-size: 14px;
  margin-top: 16px;
}
</style>
