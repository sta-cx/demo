const WebSocket = require('ws')
const jwt = require('jsonwebtoken')
const logger = require('./logger')

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server })
    this.clients = new Map() // userId -> ws connection
    this.coupleClients = new Map() // coupleId -> Set of userIds
    
    this.init()
  }

  init() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req)
    })

    // 定期清理断开的连接
    setInterval(() => {
      this.cleanupConnections()
    }, 30000)
  }

  async handleConnection(ws, req) {
    try {
      // 从URL中获取token
      const url = new URL(req.url, 'http://localhost')
      const token = url.searchParams.get('token')
      
      if (!token) {
        ws.close(1008, 'Token required')
        return
      }

      // 验证JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const userId = decoded.userId

      // 查找用户所属的情侣
      const Couple = require('../models/Couple')
      const couple = await Couple.findOne({
        where: {
          [require('sequelize').Op.or]: [
            { user1_id: userId },
            { user2_id: userId }
          ],
          status: 'active'
        }
      })

      if (!couple) {
        ws.close(1008, 'No active couple found')
        return
      }

      // 存储连接
      this.clients.set(userId, ws)
      
      if (!this.coupleClients.has(couple.id)) {
        this.coupleClients.set(couple.id, new Set())
      }
      this.coupleClients.get(couple.id).add(userId)

      // 设置用户信息
      ws.userId = userId
      ws.coupleId = couple.id

      logger.info(`WebSocket connected: userId=${userId}, coupleId=${couple.id}`)

      // 发送连接成功消息
      this.sendToUser(userId, {
        type: 'connection',
        status: 'connected',
        userId,
        coupleId: couple.id
      })

      // 处理消息
      ws.on('message', (data) => {
        this.handleMessage(userId, couple.id, data)
      })

      // 处理断开连接
      ws.on('close', () => {
        this.handleDisconnection(userId, couple.id)
      })

      // 处理错误
      ws.on('error', (error) => {
        logger.error(`WebSocket error for user ${userId}:`, error)
      })

    } catch (error) {
      logger.error('WebSocket connection error:', error)
      ws.close(1008, 'Authentication failed')
    }
  }

  handleMessage(userId, coupleId, data) {
    try {
      const message = JSON.parse(data)
      
      switch (message.type) {
        case 'ping':
          this.sendToUser(userId, { type: 'pong' })
          break
          
        case 'typing':
          this.broadcastToCouple(coupleId, {
            type: 'partner_typing',
            userId
          }, userId)
          break
          
        default:
          logger.warn(`Unknown message type: ${message.type}`)
      }
    } catch (error) {
      logger.error('Error handling WebSocket message:', error)
    }
  }

  handleDisconnection(userId, coupleId) {
    logger.info(`WebSocket disconnected: userId=${userId}, coupleId=${coupleId}`)
    
    this.clients.delete(userId)
    
    const coupleUserIds = this.coupleClients.get(coupleId)
    if (coupleUserIds) {
      coupleUserIds.delete(userId)
      if (coupleUserIds.size === 0) {
        this.coupleClients.delete(coupleId)
      }
    }

    // 通知伴侣用户离线
    this.broadcastToCouple(coupleId, {
      type: 'partner_offline',
      userId
    })
  }

  cleanupConnections() {
    for (const [userId, ws] of this.clients) {
      if (ws.readyState === WebSocket.CLOSED) {
        this.clients.delete(userId)
        logger.info(`Cleaned up closed connection for user ${userId}`)
      }
    }
  }

  sendToUser(userId, message) {
    const ws = this.clients.get(userId)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
      return true
    }
    return false
  }

  broadcastToCouple(coupleId, message, excludeUserId = null) {
    const userIds = this.coupleClients.get(coupleId)
    if (!userIds) return 0

    let sentCount = 0
    for (const userId of userIds) {
      if (userId !== excludeUserId && this.sendToUser(userId, message)) {
        sentCount++
      }
    }
    return sentCount
  }

  // 通知新回答
  notifyNewAnswer(coupleId, answerData) {
    this.broadcastToCouple(coupleId, {
      type: 'new_answer',
      data: answerData
    })
  }

  // 通知问题完成
  notifyQuestionCompleted(coupleId, questionData) {
    this.broadcastToCouple(coupleId, {
      type: 'question_completed',
      data: questionData
    })
  }

  // 获取在线状态
  getOnlineStatus(coupleId) {
    const userIds = this.coupleClients.get(coupleId)
    return userIds ? Array.from(userIds) : []
  }
}

module.exports = WebSocketServer