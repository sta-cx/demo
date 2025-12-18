const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    answers: [],
    stats: null,
    loading: false,
    filterDate: '',
    categoryIndex: 0,
    categories: [
      { label: '全部', value: '' },
      { label: '日常', value: 'daily' },
      { label: '情感', value: 'emotion' },
      { label: '趣味', value: 'fun' },
      { label: '回忆', value: 'memory' },
      { label: '深度', value: 'deep' }
    ],
    minDate: '',
    maxDate: ''
  },

  onLoad() {
    this.initDateRange()
    this.loadHistory()
  },

  onShow() {
    this.loadHistory()
  },

  initDateRange() {
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    this.setData({
      maxDate: this.formatDate(today),
      minDate: this.formatDate(thirtyDaysAgo)
    })
  },

  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  async loadHistory() {
    try {
      this.setData({ loading: true })
      
      const params = {
        limit: 50
      }
      
      if (this.data.filterDate) {
        params.date = this.data.filterDate
      }
      
      const category = this.data.categories[this.data.categoryIndex].value
      if (category) {
        params.category = category
      }
      
      const res = await api.getAnswerHistory(params)
      
      this.setData({
        answers: res.data.answers || [],
        stats: this.calculateStats(res.data.answers || []),
        loading: false
      })
    } catch (error) {
      console.error('加载历史记录失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  calculateStats(answers) {
    const totalAnswers = answers.length
    const positiveAnswers = answers.filter(answer => 
      answer.sentiment === 'positive'
    ).length
    
    return {
      total_answers: totalAnswers,
      positive_answers: positiveAnswers
    }
  },

  onDateChange(e) {
    this.setData({ 
      filterDate: e.detail.value,
      answers: []
    })
    this.loadHistory()
  },

  onCategoryChange(e) {
    this.setData({ 
      categoryIndex: parseInt(e.detail.value),
      answers: []
    })
    this.loadHistory()
  },

  onPullDownRefresh() {
    this.loadHistory().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    this.loadMoreHistory()
  },

  async loadMoreHistory() {
    if (this.data.loading || this.data.answers.length === 0) {
      return
    }

    try {
      this.setData({ loading: true })
      
      const params = {
        limit: 20,
        offset: this.data.answers.length
      }
      
      if (this.data.filterDate) {
        params.date = this.data.filterDate
      }
      
      const category = this.data.categories[this.data.categoryIndex].value
      if (category) {
        params.category = category
      }
      
      const res = await api.getAnswerHistory(params)
      
      const newAnswers = res.data.answers || []
      this.setData({
        answers: [...this.data.answers, ...newAnswers],
        loading: false
      })
    } catch (error) {
      console.error('加载更多历史记录失败:', error)
      this.setData({ loading: false })
    }
  }
})