App({
  globalData: {
    apiBase: 'https://api.our-daily.com/v1',
    userInfo: null,
    token: null
  },

  onLaunch() {
    // 初始化
    this.init()
  },

  init() {
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync()
    this.globalData.systemInfo = systemInfo

    // 从本地存储读取token
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.token = token
      this.getUserInfo()
    }

    // 检查更新
    this.checkUpdate()
  },

  async getUserInfo() {
    try {
      const api = require('./utils/api')
      const res = await api.getCoupleInfo()
      this.globalData.userInfo = res.data
    } catch (error) {
      console.error('获取用户信息失败:', error)
      // 清除无效token
      wx.removeStorageSync('token')
      this.globalData.token = null
    }
  },

  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()
      
      updateManager.onCheckForUpdate((res) => {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(() => {
            wx.showModal({
              title: '更新提示',
              content: '新版本已经准备好，是否重启应用？',
              success: (res) => {
                if (res.confirm) {
                  updateManager.applyUpdate()
                }
              }
            })
          })
          
          updateManager.onUpdateFailed(() => {
            wx.showModal({
              title: '更新失败',
              content: '新版本下载失败，请检查网络后重试',
              showCancel: false
            })
          })
        }
      })
    }
  },

  // 登录
  async login(phone, code) {
    try {
      const api = require('./utils/api')
      const res = await api.login(phone, code)
      
      const { token, user } = res.data
      this.globalData.token = token
      this.globalData.userInfo = user
      
      // 保存token到本地存储
      wx.setStorageSync('token', token)
      
      return { success: true, user }
    } catch (error) {
      console.error('登录失败:', error)
      return { success: false, error: error.message }
    }
  },

  // 退出登录
  logout() {
    this.globalData.token = null
    this.globalData.userInfo = null
    wx.removeStorageSync('token')
    
    // 跳转到登录页
    wx.reLaunch({
      url: '/pages/login/login'
    })
  }
})