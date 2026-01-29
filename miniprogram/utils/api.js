const app = getApp()

const request = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wx.getStorageSync('token')}`,
        ...options.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.data.error || 'Request failed'}`))
        }
      },
      fail: reject
    })
  })
}

// 认证相关
const auth = {
  sendCode: (phone) => request('/auth/send-code', {
    method: 'POST',
    data: { phone }
  }),
  
  login: (phone, code) => request('/auth/login', {
    method: 'POST',
    data: { phone, code }
  })
}

// 情侣相关
const couple = {
  bind: (partnerPhone, coupleName) => request('/couple/bind', {
    method: 'POST',
    data: { partner_phone: partnerPhone, couple_name: coupleName }
  }),
  
  getInfo: () => request('/couple/info')
}

// 问题相关
const questions = {
  getToday: () => request('/questions/today'),
  
  submitAnswer: (data) => request('/questions/answer', {
    method: 'POST',
    data
  }),
  
  getHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/questions/history?${query}`)
  }
}

// 回忆录相关
const memories = {
  getList: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/memories?${query}`)
  },
  
  share: (id) => request(`/memories/${id}/share`, {
    method: 'POST'
  })
}

// 用户相关
const user = {
  getSettings: () => request('/user/settings'),
  
  updateSettings: (settings) => request('/user/settings', {
    method: 'PUT',
    data: settings
  })
}

// 导出API
module.exports = {
  // 直接导出方法
  sendCode: auth.sendCode,
  login: auth.login,
  getCoupleInfo: couple.getInfo,
  bindPartner: couple.bind,
  getTodayQuestion: questions.getToday,
  submitAnswer: questions.submitAnswer,
  getAnswerHistory: questions.getHistory,
  getMemories: memories.getList,
  shareMemory: memories.share,
  getUserSettings: user.getSettings,
  updateUserSettings: user.updateSettings,
  
  // 按模块导出
  auth,
  couple,
  questions,
  memories,
  user
}