const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    todayDate: '',
    coupleInfo: null,
    todayQuestion: null,
    userAnswered: false,
    partnerAnswered: false,
    loading: true
  },

  onLoad() {
    this.setTodayDate()
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  setTodayDate() {
    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const weekDay = weekDays[today.getDay()]
    
    this.setData({
      todayDate: `${month}月${day}日 星期${weekDay}`
    })
  },

  async loadData() {
    try {
      this.setData({ loading: true })
      
      // 并行加载情侣信息和今日问题
      const [coupleRes, questionRes] = await Promise.all([
        api.getCoupleInfo(),
        api.getTodayQuestion()
      ])

      this.setData({
        coupleInfo: coupleRes.data,
        todayQuestion: questionRes.data.question,
        userAnswered: questionRes.data.user_answered,
        partnerAnswered: questionRes.data.partner_answered,
        loading: false
      })
    } catch (error) {
      console.error('加载数据失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  goToAnswer() {
    wx.navigateTo({
      url: '/pages/answer/answer'
    })
  },

  goToHistory() {
    wx.switchTab({
      url: '/pages/history/history'
    })
  },

  goToMemories() {
    wx.switchTab({
      url: '/pages/memories/memories'
    })
  }
})