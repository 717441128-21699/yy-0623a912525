export const PROJECT_TYPES = [
  '双眼皮/眼综合',
  '隆鼻/鼻综合',
  '自体脂肪填充',
  '假体隆胸',
  '吸脂塑形',
  '线雕提升',
  '玻尿酸注射',
  '肉毒素注射',
  '光子嫩肤',
  '热玛吉',
  '皮秒祛斑',
  '植发',
  '私密整形',
  '其他'
]

export const BODY_PARTS = [
  '眼部',
  '鼻部',
  '面部轮廓',
  '胸部',
  '腰腹',
  '大腿',
  '手臂',
  '臀部',
  '皮肤',
  '毛发',
  '私密',
  '全身'
]

export const PERIODS = [
  '术前',
  '术后即刻',
  '术后1天',
  '术后3天',
  '术后7天',
  '术后15天',
  '术后1个月',
  '术后3个月',
  '术后6个月',
  '术后1年'
]

export const AGE_GROUPS = [
  { label: '18-24岁', value: '18-24' },
  { label: '25-30岁', value: '25-30' },
  { label: '31-35岁', value: '31-35' },
  { label: '36-40岁', value: '36-40' },
  { label: '41-45岁', value: '41-45' },
  { label: '46岁以上', value: '46+' }
]

export const CHANNELS = [
  { label: '微信公众号', value: 'wechat_official' },
  { label: '朋友圈', value: 'wechat_moments' },
  { label: '短视频封面', value: 'short_video_cover' },
  { label: '小红书', value: 'xiaohongshu' },
  { label: '微博', value: 'weibo' },
  { label: '院内展示', value: 'in_house' }
]

export const CASE_STATUS = {
  pending: { label: '待审核', color: 'default' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已退回', color: 'warning' },
  forbidden: { label: '禁止发布', color: 'error' }
} as const

export const DEFAULT_WATERMARK = 'XX医疗美容 · 版权所有'
export const DEFAULT_DISCLAIMER = '※ 恢复期效果因人而异，案例仅供参考'
