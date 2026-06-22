import { useState, useEffect } from 'react'
import {
  Row, Col, Button, Table, Tag, Space, Modal, Form, Input, Select,
  message, Empty, Drawer, Divider, Radio, Descriptions, Skeleton
} from 'antd'
import {
  AuditOutlined, CheckOutlined, RollbackOutlined, StopOutlined,
  CommentOutlined, FileTextOutlined, ClockCircleOutlined
} from '@ant-design/icons'
import { caseApi, reviewApi, assetApi, fileUrl } from '../services/api'
import { CaseItem, ReviewItem, AssetItem } from '../types'
import { CASE_STATUS } from '../constants'

const { TextArea } = Input

interface Props {
  onDataChange?: () => void
}

interface CaseWithReview extends CaseItem {
  lastReview?: ReviewItem | null
}

export default function ReviewPage({ onDataChange }: Props) {
  const [cases, setCases] = useState<CaseWithReview[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [currentCase, setCurrentCase] = useState<CaseWithReview | null>(null)
  const [currentAssets, setCurrentAssets] = useState<AssetItem[]>([])
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const list = await caseApi.list()
      const reviewMap = new Map<string, ReviewItem>()
      await Promise.all(
        list.map(async (c) => {
          const rs = await reviewApi.list(c.id)
          if (rs && rs.length > 0) reviewMap.set(c.id, rs[0])
        })
      )
      const enriched: CaseWithReview[] = list.map(c => ({
        ...c,
        lastReview: reviewMap.get(c.id) || null
      }))
      setCases(enriched)
    } finally {
      setLoading(false)
    }
    onDataChange?.()
  }

  useEffect(() => { loadData() }, [])

  const openReview = async (c: CaseWithReview) => {
    setCurrentCase(c)
    const [assets, rvs] = await Promise.all([assetApi.list(c.id), reviewApi.list(c.id)])
    setCurrentAssets(assets)
    setReviews(rvs)
    form.resetFields()
    setReviewOpen(true)
  }

  const openDetail = async (c: CaseWithReview) => {
    setCurrentCase(c)
    const [assets, rvs] = await Promise.all([assetApi.list(c.id), reviewApi.list(c.id)])
    setCurrentAssets(assets)
    setReviews(rvs)
    setDetailOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (!currentCase) return
      setSubmitting(true)
      await caseApi.updateStatus(currentCase.id, values.status, values.reviewer || '院长', values.reason || '')
      message.success('审核结果已提交')
      setReviewOpen(false)
      loadData()
    } catch (e: any) {
      if (!e?.errorFields) message.error('提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const renderLastReview = (r: CaseWithReview) => {
    if (!r.lastReview) return <span style={{ color: '#94a3b8', fontSize: 12 }}>尚无审核记录</span>
    const lr = r.lastReview
    const statusInfo = CASE_STATUS[lr.status as keyof typeof CASE_STATUS]
    return (
      <Space direction="vertical" size={0} style={{ lineHeight: 1.5 }}>
        <Tag color={(statusInfo?.color || 'default') as any} style={{ margin: 0 }}>
          {statusInfo?.label || lr.status}
        </Tag>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {lr.reviewer} · {String(lr.created_at || '').slice(5, 16)}
        </span>
      </Space>
    )
  }

  const columns = [
    {
      title: '项目类型',
      dataIndex: 'project_type',
      width: 140
    },
    {
      title: '治疗部位',
      dataIndex: 'body_part',
      width: 100
    },
    {
      title: '年龄段',
      dataIndex: 'age_group',
      width: 90,
      render: (v: string) => v || '-'
    },
    {
      title: '咨询师',
      dataIndex: 'consultant',
      width: 100,
      render: (v: string) => v || '-'
    },
    {
      title: '素材数',
      dataIndex: 'asset_count',
      width: 80,
      render: (v: number) => `${v || 0} 张`
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      width: 100,
      render: (v: keyof typeof CASE_STATUS) => {
        const s = CASE_STATUS[v] || { label: v, color: 'default' }
        return <Tag color={s.color as any}>{s.label}</Tag>
      }
    },
    {
      title: '最近审核',
      key: 'last',
      width: 160,
      render: (_: any, r: CaseWithReview) => renderLastReview(r)
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, r: CaseWithReview) => (
        <Space size="small">
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => openDetail(r)}>审核记录</Button>
          <Button type="primary" size="small" icon={<AuditOutlined />} onClick={() => openReview(r)}>审核</Button>
        </Space>
      )
    }
  ]

  const pendingCount = cases.filter(c => c.status === 'pending').length
  const approvedCount = cases.filter(c => c.status === 'approved').length
  const rejectedCount = cases.filter(c => c.status === 'rejected').length
  const forbiddenCount = cases.filter(c => c.status === 'forbidden').length

  return (
    <div className="page-container">
      <div>
        <h2 className="page-title">审核记录</h2>
        <p className="page-subtitle">院长或负责人对案例进行审核，记录每次修改原因与审核意见，实现全流程可追溯</p>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <div className="stats-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="label">待审核</div>
              <div className="value" style={{ color: '#e9c46a' }}>{pendingCount}</div>
            </div>
            <div className="icon-box" style={{ background: '#e9c46a' }}><ClockCircleOutlined /></div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stats-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="label">已通过</div>
              <div className="value" style={{ color: '#2a9d8f' }}>{approvedCount}</div>
            </div>
            <div className="icon-box" style={{ background: '#2a9d8f' }}><CheckOutlined /></div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stats-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="label">已退回</div>
              <div className="value" style={{ color: '#f59e0b' }}>{rejectedCount}</div>
            </div>
            <div className="icon-box" style={{ background: '#f59e0b' }}><RollbackOutlined /></div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stats-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="label">禁止发布</div>
              <div className="value" style={{ color: '#e76f51' }}>{forbiddenCount}</div>
            </div>
            <div className="icon-box" style={{ background: '#e76f51' }}><StopOutlined /></div>
          </div>
        </Col>
      </Row>

      <div className="card-section">
        <div className="card-section-title">审核列表</div>
        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={cases}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1100 }}
          />
        )}
      </div>

      <Modal
        title="案例审核"
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={860}
        okText="提交审核"
        cancelText="取消"
        destroyOnClose
      >
        {currentCase && (
          <div>
            <div style={{ background: '#f0f6ff', padding: 14, borderRadius: 6, marginBottom: 16 }}>
              <Descriptions column={3} size="small">
                <Descriptions.Item label="项目">{currentCase.project_type}</Descriptions.Item>
                <Descriptions.Item label="部位">{currentCase.body_part}</Descriptions.Item>
                <Descriptions.Item label="年龄段">{currentCase.age_group || '-'}</Descriptions.Item>
                <Descriptions.Item label="咨询师">{currentCase.consultant || '-'}</Descriptions.Item>
                <Descriptions.Item label="素材">{currentAssets.length} 张</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={CASE_STATUS[currentCase.status as keyof typeof CASE_STATUS]?.color as any}>
                    {CASE_STATUS[currentCase.status as keyof typeof CASE_STATUS]?.label}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                <strong>描述：</strong>{currentCase.description || '-'}
              </div>
              {currentCase.copy_points && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  <strong>文案：</strong>{currentCase.copy_points}
                </div>
              )}
            </div>

            {currentAssets.length > 0 && (
              <>
                <Divider style={{ margin: '8px 0 12px 0' }}>素材预览</Divider>
                <div className="asset-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))' }}>
                  {currentAssets.map(a => (
                    <div key={a.id} className="asset-card">
                      <div className="asset-thumb">
                        <img src={fileUrl(a.processed_path || a.thumbnail_path || a.original_path)} alt="" />
                      </div>
                      <div className="asset-meta">
                        <div style={{ fontSize: 11 }}>{a.phase || '未标注'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <Divider style={{ margin: '16px 0' }}>审核结论</Divider>

            <Form form={form} layout="vertical" preserve={false}>
              <Form.Item label="审核人" name="reviewer" initialValue="院长">
                <Select options={[
                  { label: '院长', value: '院长' },
                  { label: '运营负责人', value: '运营负责人' },
                  { label: '合规负责人', value: '合规负责人' }
                ]} />
              </Form.Item>
              <Form.Item label="审核结论" name="status" rules={[{ required: true, message: '请选择审核结论' }]}>
                <Radio.Group>
                  <Space direction="vertical">
                    <Radio value="approved">
                      <Space><CheckOutlined style={{ color: '#2a9d8f' }} /><strong style={{ color: '#2a9d8f' }}>通过</strong> — 素材合规，可用于发布</Space>
                    </Radio>
                    <Radio value="rejected">
                      <Space><RollbackOutlined style={{ color: '#f59e0b' }} /><strong style={{ color: '#f59e0b' }}>退回</strong> — 需要补充或修改后重新提交</Space>
                    </Radio>
                    <Radio value="forbidden">
                      <Space><StopOutlined style={{ color: '#e76f51' }} /><strong style={{ color: '#e76f51' }}>禁止发布</strong> — 素材存在风险，禁止对外使用</Space>
                    </Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="修改原因 / 审核意见" name="reason" rules={[{ required: true, message: '请填写审核意见' }]}>
                <TextArea
                  rows={4}
                  placeholder="请详细说明审核意见，退回需注明需要修改的内容，通过可填写注意事项"
                />
              </Form.Item>
            </Form>

            {reviews.length > 0 && (
              <>
                <Divider style={{ margin: '8px 0 12px 0' }}>历史审核记录</Divider>
                <div>
                  {reviews.map(r => (
                    <div key={r.id} className={`timeline-item ${r.status}`}>
                      <Space>
                        <Tag color={CASE_STATUS[r.status as keyof typeof CASE_STATUS]?.color as any}>
                          {CASE_STATUS[r.status as keyof typeof CASE_STATUS]?.label || r.status}
                        </Tag>
                        <strong>{r.reviewer}</strong>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>{r.created_at}</span>
                      </Space>
                      {r.reason && <div style={{ marginTop: 4, fontSize: 13, color: '#475569' }}>{r.reason}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Drawer
        title="审核记录详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={720}
        destroyOnClose
      >
        {currentCase && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>{currentCase.project_type} · {currentCase.body_part}</strong>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                提交咨询师：{currentCase.consultant || '-'} ｜ 素材数：{currentAssets.length}
              </div>
            </div>

            <Divider>审核时间线</Divider>
            {reviews.length === 0 ? (
              <Empty description="暂无审核记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div>
                {reviews.map(r => (
                  <div key={r.id} className={`timeline-item ${r.status}`}>
                    <Space align="center">
                      <Tag color={CASE_STATUS[r.status as keyof typeof CASE_STATUS]?.color as any} style={{ margin: 0 }}>
                        {CASE_STATUS[r.status as keyof typeof CASE_STATUS]?.label || r.status}
                      </Tag>
                      <Space size={4}>
                        <strong>{r.reviewer}</strong>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>（{r.role || '审核人'}）</span>
                      </Space>
                      <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 'auto' }}>{r.created_at}</span>
                    </Space>
                    {r.reason && (
                      <div style={{
                        marginTop: 8,
                        padding: '10px 12px',
                        background: '#f8fafc',
                        borderRadius: 6,
                        fontSize: 13,
                        color: '#334155',
                        borderLeft: '3px solid #1d4e89'
                      }}>
                        <CommentOutlined style={{ color: '#94a3b8', marginRight: 6 }} />
                        {r.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {currentAssets.length > 0 && (
              <>
                <Divider>关联素材</Divider>
                <div className="asset-grid">
                  {currentAssets.map(a => (
                    <div key={a.id} className="asset-card">
                      <div className="asset-thumb">
                        <img src={fileUrl(a.processed_path || a.thumbnail_path || a.original_path)} alt="" />
                      </div>
                      <div className="asset-meta">
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{a.phase || '未标注'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
