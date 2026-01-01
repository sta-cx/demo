<template>
  <div class="home-container">
    <header>
      <h1>每日问答</h1>
      <span class="date">{{ today }}</span>
    </header>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="loadData">重试</button>
    </div>

    <div v-else-if="!hasCouple" class="empty">
      <p>还没有绑定情侣</p>
      <div class="bind-form">
        <input v-model="partnerPhone" placeholder="请输入伴侣手机号" />
        <button @click="bindPartner">绑定</button>
      </div>
    </div>

    <div v-else-if="!question" class="empty">
      <p>今天的问题还没有准备好</p>
    </div>

    <div v-else class="question-card">
      <div class="question-text">{{ question.question_text }}</div>

      <div class="status">
        <span v-if="userAnswered" class="answered">已回答</span>
        <span v-else class="pending">待回答</span>
      </div>

      <div v-if="userAnswered && partner_answer" class="partner-answer">
        <p class="label">伴侣的回答：</p>
        <p class="answer-text">{{ partner_answer.answer_text }}</p>
      </div>

      <div v-if="!userAnswered" class="action">
        <button @click="$router.push('/answer')">去回答</button>
      </div>
    </div>

    <nav class="bottom-nav">
      <router-link to="/" class="nav-item active">今日</router-link>
      <router-link to="/history" class="nav-item">历史</router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { questions, couple as coupleApi } from '../api';

const loading = ref(true);
const error = ref('');
const data = ref(null);
const partnerPhone = ref('');

const today = computed(() => {
  const now = new Date();
  return `${now.getMonth() + 1}月${now.getDate()}日`;
});

const question = computed(() => data.value?.question);
const userAnswered = computed(() => data.value?.user_answered);
const partner_answer = computed(() => data.value?.partner_answer);
const hasCouple = computed(() => true); // 简化处理

const loadData = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await questions.getToday();
    data.value = res.data;
  } catch (e) {
    error.value = e.response?.data?.error || '加载失败';
    if (e.response?.data?.code === 'COUPLE_NOT_FOUND') {
      data.value = null;
    }
  } finally {
    loading.value = false;
  }
};

const bindPartner = async () => {
  if (!/^1\d{10}$/.test(partnerPhone.value)) {
    alert('请输入正确的手机号');
    return;
  }
  try {
    await coupleApi.bind(partnerPhone.value);
    alert('绑定成功');
    loadData();
  } catch (e) {
    alert(e.response?.data?.error || '绑定失败');
  }
};

onMounted(loadData);
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20px;
  padding-bottom: 80px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

h1 {
  margin: 0;
  font-size: 20px;
}

.date {
  color: #666;
  font-size: 14px;
}

.loading, .error, .empty {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.question-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.question-text {
  font-size: 18px;
  color: #333;
  line-height: 1.6;
  margin-bottom: 16px;
  word-wrap: break-word;
  word-break: break-word;
}

.status {
  margin-bottom: 16px;
}

.answered {
  color: #27ae60;
  font-size: 14px;
}

.pending {
  color: #e74c3c;
  font-size: 14px;
}

.partner-answer {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
}

.label {
  font-size: 12px;
  color: #666;
  margin: 0 0 8px;
}

.answer-text {
  margin: 0;
  color: #333;
}

.action {
  margin-top: 20px;
}

.action button {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.bind-form {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.bind-form input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.bind-form button {
  padding: 10px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  display: flex;
  border-top: 1px solid #eee;
}

.nav-item {
  flex: 1;
  text-align: center;
  padding: 12px;
  color: #999;
  text-decoration: none;
  font-size: 14px;
}

.nav-item.active {
  color: #667eea;
}
</style>
