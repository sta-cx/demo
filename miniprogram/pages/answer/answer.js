const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    question: null,
    userAnswered: false,
    partnerAnswered: false,
    myAnswer: null,
    partnerAnswer: null,
    answerType: 'text',
    answerText: '',
    photoUrl: '',
    recording: false,
    canSubmit: false
  },

  onLoad() {
    this.loadQuestion()
  },

  async loadQuestion() {
    try {
      const res = await api.getTodayQuestion()
      const { question, user_answered, partner_answered } = res.data
      
      this.setData({
        question,
        userAnswered: user_answered,
        partnerAnswered: partner_answered
      })

      if (user_answered) {
        this.loadAnswers()
      }
    } catch (error) {
      console.error('加载问题失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  async loadAnswers() {
    try {
      const res = await api.getAnswerHistory({ limit: 1 })
      if (res.data.answers.length > 0) {
        const myAnswer = res.data.answers[0]
        this.setData({ myAnswer })
      }
    } catch (error) {
      console.error('加载回答失败:', error)
    }
  },

  selectAnswerType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ 
      answerType: type,
      canSubmit: type === 'text' && this.data.answerText.trim()
    })
  },

  onTextInput(e) {
    const value = e.detail.value
    this.setData({ 
      answerText: value,
      canSubmit: value.trim().length > 0
    })
  },

  choosePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({ 
          photoUrl: tempFilePath,
          canSubmit: true
        })
      },
      fail: (error) => {
        console.error('选择照片失败:', error)
      }
    })
  },

  startRecording() {
    this.setData({ recording: true })
    wx.startRecord({
      success: (res) => {
        console.log('录音开始', res)
      },
      fail: (error) => {
        console.error('录音开始失败:', error)
        this.setData({ recording: false })
      }
    })
  },

  stopRecording() {
    this.setData({ recording: false })
    wx.stopRecord({
      success: (res) => {
        const tempFilePath = res.tempFilePath
        this.setData({ 
          voiceUrl: tempFilePath,
          canSubmit: true
        })
      },
      fail: (error) => {
        console.error('录音结束失败:', error)
      }
    })
  },

  async submitAnswer() {
    if (!this.data.canSubmit) {
      return
    }

    try {
      wx.showLoading({ title: '提交中...' })
      
      const formData = {
        question_id: this.data.question.id,
        answer_text: this.data.answerText
      }

      // 处理文件上传
      if (this.data.answerType === 'photo' && this.data.photoUrl) {
        await this.uploadFile(this.data.photoUrl, formData)
      } else if (this.data.answerType === 'voice' && this.data.voiceUrl) {
        await this.uploadFile(this.data.voiceUrl, formData)
      } else {
        await api.submitAnswer(formData)
      }

      wx.hideLoading()
      wx.showToast({
        title: '提交成功',
        icon: 'success'
      })

      // 重新加载数据
      setTimeout(() => {
        this.loadQuestion()
      }, 1500)

    } catch (error) {
      wx.hideLoading()
      console.error('提交回答失败:', error)
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      })
    }
  },

  async uploadFile(filePath, formData) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${app.globalData.apiBase}/questions/answer`,
        filePath: filePath,
        name: 'media_file',
        formData: formData,
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            resolve(data)
          } catch (e) {
            reject(e)
          }
        },
        fail: reject
      })
    })
  }
})