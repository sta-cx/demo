<template>
  <div class="answer-container">
    <header>
      <button class="back" @click="$router.back()">←</button>
      <h1>回答问题</h1>
    </header>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="question" class="content">
      <div class="question-card">
        <div class="question-text">{{ question.question_text }}</div>
        <div class="category" v-if="question.category">
          {{ question.category }}
        </div>
      </div>

      <div class="answer-form">
        <textarea
          v-model="answer"
          placeholder="在这里写下你的回答..."
          rows="5"
        ></textarea>

        <button
          @click="submit"
          :disabled="!answer.trim() || submitting"
          class="submit-btn"
        >
          {{ submitting ? '提交中...' : '提交回答' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { questions } from '../api';

const router = useRouter();
const loading = ref(true);
const submitting = ref(false);
const question = ref(null);
const answer = ref('');

const loadQuestion = async () => {
  loading.value = true;
  try {
    const res = await questions.getToday();
    question.value = res.data.question;
  } catch (e) {
    alert('加载问题失败');
    router.push('/');
  } finally {
    loading.value = false;
  }
};

const submit = async () => {
  if (!answer.value.trim()) return;

  submitting.value = true;
  try {
    await questions.submitAnswer({
      question_id: question.value.id,
      answer_text: answer.value.trim()
    });
    alert('回答提交成功！');
    router.push('/');
  } catch (e) {
    alert(e.response?.data?.error || '提交失败');
  } finally {
    submitting.value = false;
  }
};

onMounted(loadQuestion);
</script>

<style scoped>
.answer-container {
  min-height: 100vh;
  background: #f5f5f5;
}

header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: white;
}

.back {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  margin-right: 16px;
}

h1 {
  margin: 0;
  font-size: 18px;
}

.loading {
  padding: 40px;
  text-align: center;
  color: #666;
}

.content {
  padding: 20px;
}

.question-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
}

.question-text {
  font-size: 18px;
  color: #333;
  line-height: 1.6;
  word-wrap: break-word;
  word-break: break-word;
}

.category {
  margin-top: 12px;
  font-size: 12px;
  color: #667eea;
  background: #eef2ff;
  padding: 4px 12px;
  border-radius: 20px;
  display: inline-block;
}

.answer-form {
  background: white;
  border-radius: 12px;
  padding: 20px;
}

textarea {
  width: 100%;
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
  font-size: 16px;
  resize: none;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  word-wrap: break-word;
}

textarea:focus {
  border-color: #667eea;
}

.submit-btn {
  width: 100%;
  margin-top: 16px;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
