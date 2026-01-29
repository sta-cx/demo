const { Sequelize, DataTypes } = require('sequelize');

const Couple = sequelize.define('Couple', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  couple_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '情侣名称'
  },
  user1_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '用户1 ID'
  },
  user2_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '用户2 ID'
  },
  user1_phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '用户1 手机号'
  },
  user2_phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '用户2 手机号'
  },
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '开始日期'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否激活'
  }
}, {
  tableName: 'couples',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['user1_id']
    },
    {
      unique: true,
      fields: ['user2_id']
    },
    {
      unique: true,
      fields: ['user1_phone']
    },
    {
      unique: true,
      fields: ['user2_phone']
    }
  ]
});

module.exports = Couple;
