const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    currentTab: 'weekly',
    memories: [],
    loading: false
  },

  onLoad() {
    this.loadMemories()
  },

  onShow() {
    this.loadMemories()
  },

  async loadMemories() {
    try {
      this.setData({ loading: true })
      
      const res = await api.getMemories({
        type: this.data.currentTab,
        limit: 10
      })

      this.setData({
        memories: res.data.memories || [],
        loading: false
      })
    } catch (error) {
      console.error('加载回忆录失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab !== this.data.currentTab) {
      this.setData({ 
        currentTab: tab,
        memories: []
      })
      this.loadMemories()
    }
  },

  viewMemory(e) {
    const memoryId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/memory-detail/memory-detail?id=${memoryId}`
    })
  },

  async shareMemory(e) {
    const memoryId = e.currentTarget.dataset.id
    e.stopPropagation()

    try {
      wx.showLoading({ title: '生成分享图片...' })
      
      const res = await api.shareMemory(memoryId)
      const shareUrl = res.data.share_url

      wx.hideLoading()
      
      wx.previewImage({
        urls: [shareUrl],
        current: shareUrl
      })
    } catch (error) {
      wx.hideLoading()
      console.error('分享失败:', error)
      wx.showToast({
        title: '分享失败',
        icon: 'none'
      })
    }
  },

  onPullDownRefresh() {
    this.loadMemories().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    // 加载更多回忆录
    this.loadMoreMemories()
  },

  async loadMoreMemories() {
    if (this.data.loading || this.data.memories.length === 0) {
      return
    }

    try {
      this.setData({ loading: true })
      
      const res = await api.getMemories({
        type: this.data.currentTab,
        limit: 10,
        offset: this.data.memories.length
      })

      const newMemories = res.data.memories || []
      this.setData({
        memories: [...this.data.memories, ...newMemories],
        loading: false
      })
    } catch (error) {
      console.error('加载更多回忆录失败:', error)
      this.setData({ loading: false })
    }
  }
})