<template>
  <div class="history-container">
    <header>
      <h1>历史记录</h1>
    </header>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="history.length === 0" class="empty">
      <p>还没有问答记录</p>
      <p class="tip">回答问题后即可查看历史</p>
    </div>

    <div v-else class="history-list">
      <div
        v-for="item in history"
        :key="item.id"
        class="history-item"
      >
        <div class="date">{{ formatDate(item.created_at) }}</div>
        <div class="question">{{ item.question_text }}</div>
        <div class="answers">
          <div class="answer my-answer" v-if="item.my_answer">
            <span class="label">我：</span>
            <span>{{ item.my_answer }}</span>
          </div>
          <div class="answer partner-answer" v-if="item.partner_answer">
            <span class="label">伴侣：</span>
            <span>{{ item.partner_answer }}</span>
          </div>
        </div>
      </div>
    </div>

    <nav class="bottom-nav">
      <router-link to="/" class="nav-item">今日</router-link>
      <router-link to="/history" class="nav-item active">历史</router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { questions } from '../api';

const loading = ref(true);
const history = ref([]);

const loadHistory = async () => {
  loading.value = true;
  try {
    const res = await questions.getHistory({ limit: 50 });
    history.value = res.data.answers;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

onMounted(loadHistory);
</script>

<style scoped>
.history-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20px;
  padding-bottom: 80px;
}

header {
  margin-bottom: 20px;
}

h1 {
  margin: 0;
  font-size: 20px;
}

.loading, .empty {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.tip {
  font-size: 14px;
  color: #999;
}

.history-item {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.date {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.question {
  font-size: 16px;
  color: #333;
  margin-bottom: 12px;
  line-height: 1.4;
}

.answers {
  border-top: 1px solid #eee;
  padding-top: 12px;
}

.answer {
  font-size: 14px;
  margin-bottom: 8px;
}

.answer:last-child {
  margin-bottom: 0;
}

.label {
  font-weight: bold;
}

.my-answer {
  color: #667eea;
}

.partner-answer {
  color: #27ae60;
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
