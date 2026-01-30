// 预设问题库 - 共100个问题，分为不同类别
const presetQuestions = [
  // daily (日常类) - 30个
  {
    question_text: '今天最开心的一件事是什么？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '快乐', '分享'],
    answer_type: 'text'
  },
  {
    question_text: '今天吃了什么好吃的？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '美食', '分享'],
    answer_type: 'text'
  },
  {
    question_text: '今天工作/学习顺利吗？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '工作', '关心'],
    answer_type: 'text'
  },
  {
    question_text: '今天有什么新发现？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '探索', '好奇'],
    answer_type: 'text'
  },
  {
    question_text: '今天天气怎么样，心情如何？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '天气', '心情'],
    answer_type: 'text'
  },
  {
    question_text: '今天最想和对方分享的事是什么？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '分享', '互动'],
    answer_type: 'text'
  },
  {
    question_text: '今天学到了什么新东西？',
    category: 'daily',
    difficulty: 2,
    tags: ['日常', '学习', '成长'],
    answer_type: 'text'
  },
  {
    question_text: '今天遇到什么有趣的人或事吗？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '社交', '有趣'],
    answer_type: 'text'
  },
  {
    question_text: '今天有什么小成就？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '成就', '积极'],
    answer_type: 'text'
  },
  {
    question_text: '今天最想对对方说的一句话？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '表达', '亲密'],
    answer_type: 'text'
  },
  {
    question_text: '今天有什么小困扰？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '倾诉', '支持'],
    answer_type: 'text'
  },
  {
    question_text: '今天几点起床的？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '作息', '简单'],
    answer_type: 'text'
  },
  {
    question_text: '今天走了多少步？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '运动', '健康'],
    answer_type: 'text'
  },
  {
    question_text: '今天喝了多少水？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '健康', '关怀'],
    answer_type: 'text'
  },
  {
    question_text: '今天几点睡觉？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '作息', '关心'],
    answer_type: 'text'
  },
  {
    question_text: '今天买过什么东西吗？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '消费', '分享'],
    answer_type: 'text'
  },
  {
    question_text: '今天看了什么视频/电影？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '娱乐', '兴趣'],
    answer_type: 'text'
  },
  {
    question_text: '今天听了什么歌？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '音乐', '兴趣'],
    answer_type: 'text'
  },
  {
    question_text: '今天心情怎么样？用三个词形容。',
    category: 'daily',
    difficulty: 2,
    tags: ['日常', '心情', '表达'],
    answer_type: 'text'
  },
  {
    question_text: '今天有什么计划完成了吗？',
    category: 'daily',
    difficulty: 2,
    tags: ['日常', '计划', '成就'],
    answer_type: 'text'
  },
  {
    question_text: '今天最累的是什么？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '倾诉', '理解'],
    answer_type: 'text'
  },
  {
    question_text: '今天有什么特别想吃的？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '美食', '愿望'],
    answer_type: 'text'
  },
  {
    question_text: '今天看了多少页书？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '阅读', '习惯'],
    answer_type: 'text'
  },
  {
    question_text: '今天和谁聊过天？',
    category: 'daily',
    difficulty: 1,
    tags: ['日常', '社交', '分享'],
    answer_type: 'text'
  },
  {
    question_text: '今天有什么遗憾吗？',
    category: 'daily',
    difficulty: 2,
    tags: ['日常', '反思', '深度'],
    answer_type: 'text'
  },
  {
    question_text: '今天最感谢的人是谁？',
    category: 'daily',
    difficulty: 2,
    tags: ['日常', '感恩', '积极'],
    answer_type: 'text'
  },
  {
    question_text: '今天有什么小确幸？',
    category: 'daily',
    difficulty: 2,
    tags: ['日常', '幸福', '积极'],
    answer_type: 'text'
  },
  {
    question_text: '今天期待明天吗？为什么？',
    category: 'daily',
    difficulty: 2,
    tags: ['日常', '期待', '未来'],
    answer_type: 'text'
  },
  {
    question_text: '今天有什么想改进的地方？',
    category: 'daily',
    difficulty: 2,
    tags: ['日常', '成长', '反思'],
    answer_type: 'text'
  },
  {
    question_text: '今天最放松的时刻是什么时候？',
    category: 'daily',
    difficulty: 2,
    tags: ['日常', '放松', '关怀'],
    answer_type: 'text'
  },
  {
    question_text: '今天如果用一种颜色形容，是什么颜色？',
    category: 'daily',
    difficulty: 2,
    tags: ['日常', '创意', '表达'],
    answer_type: 'text'
  },

  // emotion (情感类) - 35个
  {
    question_text: '你最欣赏对方的什么品质？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '赞美', '欣赏'],
    answer_type: 'text'
  },
  {
    question_text: '什么时候发现自己喜欢对方的？',
    category: 'emotion',
    difficulty: 3,
    tags: ['情感', '回忆', '故事'],
    answer_type: 'text'
  },
  {
    question_text: '对方做过最让你感动的事是什么？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '感动', '回忆'],
    answer_type: 'text'
  },
  {
    question_text: '你最想和对方一起做的三件事是什么？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '愿望', '未来'],
    answer_type: 'text'
  },
  {
    question_text: '对方哪个小动作让你觉得可爱？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '细节', '甜蜜'],
    answer_type: 'text'
  },
  {
    question_text: '什么时候觉得彼此最默契？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '默契', '理解'],
    answer_type: 'text'
  },
  {
    question_text: '最想对对方说的一句情话？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '表达', '甜蜜'],
    answer_type: 'text'
  },
  {
    question_text: '对方生病时你最想做什么？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '关怀', '陪伴'],
    answer_type: 'text'
  },
  {
    question_text: '第一次牵手是什么时候？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '回忆', '浪漫'],
    answer_type: 'text'
  },
  {
    question_text: '对方说什么话会让你觉得很安心？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '安心', '依赖'],
    answer_type: 'text'
  },
  {
    question_text: '最想念对方的时候是什么时候？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '思念', '依恋'],
    answer_type: 'text'
  },
  {
    question_text: '对方什么表情让你印象深刻？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '细节', '记忆'],
    answer_type: 'text'
  },
  {
    question_text: '什么时候觉得特别幸福？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '幸福', '满足'],
    answer_type: 'text'
  },
  {
    question_text: '最想带对方去哪里旅行？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '旅行', '梦想'],
    answer_type: 'text'
  },
  {
    question_text: '对方的什么习惯让你觉得很可爱？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '细节', '可爱'],
    answer_type: 'text'
  },
  {
    question_text: '什么时候觉得彼此是最好的朋友？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '友谊', '理解'],
    answer_type: 'text'
  },
  {
    question_text: '最想记住的关于对方的一个细节？',
    category: 'emotion',
    difficulty: 3,
    tags: ['情感', '细节', '珍惜'],
    answer_type: 'text'
  },
  {
    question_text: '对方穿什么风格的衣服你最喜欢？',
    category: 'emotion',
    difficulty: 1,
    tags: ['情感', '喜好', '审美'],
    answer_type: 'text'
  },
  {
    question_text: '什么时候觉得彼此的心意相通？',
    category: 'emotion',
    difficulty: 3,
    tags: ['情感', '默契', '深层'],
    answer_type: 'text'
  },
  {
    question_text: '最想收到对方什么礼物？',
    category: 'emotion',
    difficulty: 1,
    tags: ['情感', '礼物', '期待'],
    answer_type: 'text'
  },
  {
    question_text: '对方的什么优点让你觉得骄傲？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '骄傲', '认可'],
    answer_type: 'text'
  },
  {
    question_text: '什么时候觉得彼此的关系更进一步？',
    category: 'emotion',
    difficulty: 3,
    tags: ['情感', '成长', '关系'],
    answer_type: 'text'
  },
  {
    question_text: '最想和对方一起度过的节日是哪个？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '节日', '期待'],
    answer_type: 'text'
  },
  {
    question_text: '对方什么样子让你觉得特别有魅力？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '魅力', '心动'],
    answer_type: 'text'
  },
  {
    question_text: '什么时候觉得彼此是命中注定？',
    category: 'emotion',
    difficulty: 3,
    tags: ['情感', '缘分', '深度'],
    answer_type: 'text'
  },
  {
    question_text: '最想在什么场合向对方表白？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '浪漫', '表达'],
    answer_type: 'text'
  },
  {
    question_text: '对方的什么改变让你惊喜？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '惊喜', '成长'],
    answer_type: 'text'
  },
  {
    question_text: '什么时候觉得特别珍惜这段关系？',
    category: 'emotion',
    difficulty: 3,
    tags: ['情感', '珍惜', '感恩'],
    answer_type: 'text'
  },
  {
    question_text: '最想和对方一起完成的挑战是什么？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '挑战', '成长'],
    answer_type: 'text'
  },
  {
    question_text: '对方什么语气让你觉得温柔？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '温柔', '细节'],
    answer_type: 'text'
  },
  {
    question_text: '什么时候觉得彼此是最好的伙伴？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '伙伴', '支持'],
    answer_type: 'text'
  },
  {
    question_text: '最想和对方一起养的宠物是什么？',
    category: 'emotion',
    difficulty: 1,
    tags: ['情感', '宠物', '生活'],
    answer_type: 'text'
  },
  {
    question_text: '对方的什么梦想你特别支持？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '梦想', '支持'],
    answer_type: 'text'
  },
  {
    question_text: '什么时候觉得彼此的理解很深？',
    category: 'emotion',
    difficulty: 3,
    tags: ['情感', '理解', '深度'],
    answer_type: 'text'
  },
  {
    question_text: '最想在什么时候给对方惊喜？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '惊喜', '浪漫'],
    answer_type: 'text'
  },
  {
    question_text: '对方什么习惯你想一直保留？',
    category: 'emotion',
    difficulty: 2,
    tags: ['情感', '习惯', '珍惜'],
    answer_type: 'text'
  },
  {
    question_text: '什么时候觉得彼此是不可或缺的？',
    category: 'emotion',
    difficulty: 3,
    tags: ['情感', '依赖', '深层'],
    answer_type: 'text'
  },

  // fun (趣味类) - 20个
  {
    question_text: '如果你是一种动物，觉得自己是什么？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '想象', '轻松'],
    answer_type: 'text'
  },
  {
    question_text: '如果中了彩票，第一件事做什么？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '想象', '愿望'],
    answer_type: 'text'
  },
  {
    question_text: '最想拥有的超能力是什么？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '想象', '好玩'],
    answer_type: 'text'
  },
  {
    question_text: '如果可以穿越，想去哪个时代？',
    category: 'fun',
    difficulty: 2,
    tags: ['趣味', '想象', '历史'],
    answer_type: 'text'
  },
  {
    question_text: '最想和哪个名人吃饭？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '名人', '想象'],
    answer_type: 'text'
  },
  {
    question_text: '如果必须只吃一种食物一年，选什么？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '选择', '搞笑'],
    answer_type: 'text'
  },
  {
    question_text: '最想拥有的神奇物品是什么？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '想象', '好玩'],
    answer_type: 'text'
  },
  {
    question_text: '如果可以和任何人对调一天，选谁？',
    category: 'fun',
    difficulty: 2,
    tags: ['趣味', '想象', '有趣'],
    answer_type: 'text'
  },
  {
    question_text: '最想学会什么奇怪的技能？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '技能', '搞笑'],
    answer_type: 'text'
  },
  {
    question_text: '如果必须在一个荒岛生活一年，带三样什么？',
    category: 'fun',
    difficulty: 2,
    tags: ['趣味', '生存', '选择'],
    answer_type: 'text'
  },
  {
    question_text: '最想开一家什么店？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '梦想', '创业'],
    answer_type: 'text'
  },
  {
    question_text: '如果可以瞬间学会一门语言，选什么？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '语言', '技能'],
    answer_type: 'text'
  },
  {
    question_text: '最想参加什么电视节目？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '娱乐', '想象'],
    answer_type: 'text'
  },
  {
    question_text: '如果可以和任何历史人物聊天，选谁？',
    category: 'fun',
    difficulty: 2,
    tags: ['趣味', '历史', '想象'],
    answer_type: 'text'
  },
  {
    question_text: '最想发明什么东西？',
    category: 'fun',
    difficulty: 2,
    tags: ['趣味', '发明', '创意'],
    answer_type: 'text'
  },
  {
    question_text: '如果动物会说话，最想听哪种动物说话？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '动物', '搞笑'],
    answer_type: 'text'
  },
  {
    question_text: '最想在哪个电影里扮演主角？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '电影', '想象'],
    answer_type: 'text'
  },
  {
    question_text: '如果可以拥有一个魔豆，种出什么？',
    category: 'fun',
    difficulty: 1,
    tags: ['趣味', '童话', '想象'],
    answer_type: 'text'
  },
  {
    question_text: '最想解锁什么人生成就？',
    category: 'fun',
    difficulty: 2,
    tags: ['趣味', '成就', '游戏'],
    answer_type: 'text'
  },
  {
    question_text: '如果世界变成卡通风格，你会是什么角色？',
    category: 'fun',
    difficulty: 2,
    tags: ['趣味', '卡通', '想象'],
    answer_type: 'text'
  },

  // future (未来类) - 15个
  {
    question_text: '明年的这个时候，希望我们在做什么？',
    category: 'future',
    difficulty: 2,
    tags: ['未来', '期待', '规划'],
    answer_type: 'text'
  },
  {
    question_text: '想象一下我们退休后的生活？',
    category: 'future',
    difficulty: 3,
    tags: ['未来', '想象', '生活'],
    answer_type: 'text'
  },
  {
    question_text: '最想和对方一起实现的梦想是什么？',
    category: 'future',
    difficulty: 2,
    tags: ['未来', '梦想', '共同'],
    answer_type: 'text'
  },
  {
    question_text: '五年后希望自己是什么样子？',
    category: 'future',
    difficulty: 2,
    tags: ['未来', '成长', '规划'],
    answer_type: 'text'
  },
  {
    question_text: '最想住在哪里？描述一下理想的家。',
    category: 'future',
    difficulty: 2,
    tags: ['未来', '居住', '理想'],
    answer_type: 'text'
  },
  {
    question_text: '希望未来我们一起去哪里旅行？',
    category: 'future',
    difficulty: 1,
    tags: ['未来', '旅行', '期待'],
    answer_type: 'text'
  },
  {
    question_text: '最想学会什么新技能？',
    category: 'future',
    difficulty: 2,
    tags: ['未来', '技能', '成长'],
    answer_type: 'text'
  },
  {
    question_text: '希望未来我们的关系是什么样的？',
    category: 'future',
    difficulty: 3,
    tags: ['未来', '关系', '深度'],
    answer_type: 'text'
  },
  {
    question_text: '最想和对方一起尝试的新事物是什么？',
    category: 'future',
    difficulty: 2,
    tags: ['未来', '尝试', '新鲜'],
    answer_type: 'text'
  },
  {
    question_text: '希望未来的家里养什么宠物？',
    category: 'future',
    difficulty: 1,
    tags: ['未来', '宠物', '家庭'],
    answer_type: 'text'
  },
  {
    question_text: '想和对方一起完成什么人生大事？',
    category: 'future',
    difficulty: 2,
    tags: ['未来', '大事', '规划'],
    answer_type: 'text'
  },
  {
    question_text: '最想给未来的我们一句什么话？',
    category: 'future',
    difficulty: 3,
    tags: ['未来', '寄语', '深度'],
    answer_type: 'text'
  },
  {
    question_text: '希望未来我们一起培养什么爱好？',
    category: 'future',
    difficulty: 2,
    tags: ['未来', '爱好', '共同'],
    answer_type: 'text'
  },
  {
    question_text: '最想和对方一起看的风景是什么？',
    category: 'future',
    difficulty: 2,
    tags: ['未来', '风景', '浪漫'],
    answer_type: 'text'
  },
  {
    question_text: '想象一下我们十周年的纪念日怎么过？',
    category: 'future',
    difficulty: 3,
    tags: ['未来', '纪念日', '浪漫'],
    answer_type: 'text'
  }
];

module.exports = presetQuestions;
