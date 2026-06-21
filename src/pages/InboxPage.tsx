import { useState, useEffect } from 'react'
import {
  Row, Col, Card, Button, Modal, Form, Input, Select, Upload, message, Empty,
  Statistic, Tag, Space, Divider, InputNumber, DatePicker
} from 'antd'
import {
  InboxOutlined, PlusOutlined, FileImageOutlined, CheckCircleOutlined,
  ClockCircleOutlined, StopOutlined, CloseCircleOutlined, SafetyOutlined, EyeOutlined
} from '@ant-design/icons'
import { caseApi, assetApi, imageApi, dialog, fileUrl, statsApi } from '../services/api'
import { CaseItem, AssetItem, Stats } from '../types'
import { PROJECT_TYPES, BODY_PARTS, PERIODS, AGE_GROUPS, CASE_STATUS } from '../constants'
import dayjs from 'dayjs'

const { Dragger } = Upload

interface Props {
  onDataChange?: () => void
}

export default function InboxPage({ onDataChange }: Props) {
  const [cases, setCases] = useState<CaseItem[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0, forbidden: 0, assets: 0, expiring: 0 })
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [assetsPhase, setAssetsPhase] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentCase, setCurrentCase] = useState<CaseItem | null>(null)
  const [currentAssets, setCurrentAssets] = useState<AssetItem[]>([])

  const loadData = async () => {
    const [list, s] = await Promise.all([caseApi.list({ status: 'pending' }), statsApi.get()])
    setCases(list)
    setStats(s)
    onDataChange?.()
  }

  useEffect(() => { loadData() }, [])

  const selectFiles = async () => {
    const paths = await dialog.selectFiles()
    if (paths?.length) {
      setSelectedFiles(prev => [...prev, ...paths])
      paths.forEach(p => {
        setAssetsPhase(prev => ({ ...prev, [p]: '术后1个月' }))
      })
    }
  }

  const removeFile = (path: string) => {
    setSelectedFiles(prev => prev.filter(p => p !== path))
    const next = { ...assetsPhase }
    delete next[path]
    setAssetsPhase(next)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (selectedFiles.length === 0) {
        message.warning('请至少上传一张术前/术后照片')
        return
      }
      setSubmitting(true)
      const caseId = await caseApi.create({
        ...values,
        status: 'pending',
        age_group: values.age_group
      })
      for (let i = 0; i < selectedFiles.length; i++) {
        const copied = await imageApi.copyToStorage(selectedFiles[i], caseId)
        await assetApi.create({
          case_id: caseId,
          original_path: copied.original_path,
          thumbnail_path: copied.thumbnail_path,
          phase: assetsPhase[selectedFiles[i]],
          sort_order: i
        })
      }
      message.success('案例素材已提交，等待整理与审核')
      setModalOpen(false)
      form.resetFields()
      setSelectedFiles([])
      setAssetsPhase({})
      loadData()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error('提交失败：' + (e?.message || String(e)))
    } finally {
      setSubmitting(false)
    }
  }

  const viewCase = async (c: CaseItem) => {
    setCurrentCase(c)
    const assets = await assetApi.list(c.id)
    setCurrentAssets(assets)
    setDetailOpen(true)
  }

  const statCards = [
    { label: '案例总数', value: stats.total, icon: '📁', color: '#1d4e89' },
    { label: '待处理素材', value: stats.pending, icon: '⏳', color: '#e9c46a' },
    { label: '已通过', value: stats.approved, icon: '✅', color: '#2a9d8f' },
    { label: '素材总数', value: stats.assets, icon: '🖼️', color: '#3a7bd5' }
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 className="page-title">素材收件箱</h2>
          <p className="page-subtitle">接收咨询师提交的术前术后照片素材，建立合规案例档案</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setModalOpen(true)}>
          新建案例素材
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        {statCards.map(s => (
          <Col span={6} key={s.label}>
            <div className="stats-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="label">{s.label}</div>
                <div className="value">{s.value}</div>
              </div>
              <div className="icon-box" style={{ background: s.color }}>{s.icon}</div>
            </div>
          </Col>
        ))}
      </Row>

      <div className="card-section">
        <div className="card-section-title">待处理案例（{cases.length}）</div>
        {cases.length === 0 ? (
          <Empty description="暂无待处理素材，点击右上角新建案例" style={{ padding: '60px 0' }} />
        ) : (
          <Row gutter={[16, 16]}>
            {cases.map(c => (
              <Col span={8} key={c.id}>
                <Card hoverable size="small"
                  onClick={() => viewCase(c)}
                  actions={[
                    <EyeOutlined key="view" onClick={(e) => { e.stopPropagation(); viewCase(c) }} />
                  ]}>
                  <Card.Meta
                    avatar={<div style={{ width: 48, height: 48, borderRadius: 8, background: 'linear-gradient(135deg,#3a7bd5,#1d4e89)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>案</div>}
                    title={<Space>
                      <span style={{ fontWeight: 600 }}>{c.project_type}</span>
                      <Tag color={CASE_STATUS[c.status as keyof typeof CASE_STATUS]?.color as any}>
                        {CASE_STATUS[c.status as keyof typeof CASE_STATUS]?.label}
                      </Tag>
                    </Space>}
                    description={
                      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
                        <div>部位：{c.body_part} ｜ 年龄段：{c.age_group || '-'}</div>
                        <div>咨询师：{c.consultant || '-'}</div>
                        <div>素材数：{c.asset_count || 0} 张</div>
                        <div style={{ color: '#94a3b8' }}>{c.created_at}</div>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      <Modal
        title="提交案例素材"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={800}
        okText="提交审核"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" preserve={false}>
          <div className="form-section-title">案例基础信息</div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="项目类型" name="project_type" rules={[{ required: true, message: '请选择项目类型' }]}>
                <Select placeholder="请选择" options={PROJECT_TYPES.map(p => ({ label: p, value: p }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="治疗部位" name="body_part" rules={[{ required: true, message: '请选择治疗部位' }]}>
                <Select placeholder="请选择" options={BODY_PARTS.map(p => ({ label: p, value: p }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="年龄段" name="age_group">
                <Select placeholder="请选择" options={AGE_GROUPS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="实际年龄" name="age">
                <InputNumber min={16} max={80} style={{ width: '100%' }} placeholder="选填" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="提交咨询师" name="consultant">
                <Input placeholder="请填写咨询师姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="术后周期（默认）" name="period" initialValue="术后1个月">
                <Select placeholder="请选择" options={PERIODS.map(p => ({ label: p, value: p }))} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="案例简述" name="description">
                <Input.TextArea rows={3} placeholder="简要描述案例情况，如顾客诉求、治疗方案等" />
              </Form.Item>
            </Col>
          </Row>

          <div className="form-section-title">术前术后照片（{selectedFiles.length}张）</div>
          <Dragger
            multiple
            accept="image/*"
            showUploadList={false}
            beforeUpload={() => false}
            onClick={selectFiles}
            style={{ padding: '16px' }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: '#1d4e89' }} /></p>
            <p className="ant-upload-text">点击或拖拽照片到此区域</p>
            <p className="ant-upload-hint">支持 JPG、PNG 等格式，建议包含术前、术后各阶段对比照</p>
          </Dragger>

          {selectedFiles.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Divider style={{ margin: '12px 0' }}>已选择照片</Divider>
              <div className="asset-grid">
                {selectedFiles.map((p, i) => (
                  <div key={p + i} className="asset-card">
                    <div className="asset-thumb">
                      <img src={fileUrl(p)} alt="" />
                      <Button size="small" danger type="text" style={{
                        position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff'
                      }} onClick={(e) => { e.stopPropagation(); removeFile(p) }}>×</Button>
                    </div>
                    <div className="asset-meta">
                      <Select
                        size="small"
                        value={assetsPhase[p]}
                        onChange={v => setAssetsPhase(prev => ({ ...prev, [p]: v }))}
                        style={{ width: '100%' }}
                        options={PERIODS.map(pp => ({ label: pp, value: pp }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title="案例详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={900}
      >
        {currentCase && (
          <div>
            <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
              <Col span={6}><strong>项目类型：</strong>{currentCase.project_type}</Col>
              <Col span={6}><strong>治疗部位：</strong>{currentCase.body_part}</Col>
              <Col span={6}><strong>年龄段：</strong>{currentCase.age_group || '-'}</Col>
              <Col span={6}><strong>咨询师：</strong>{currentCase.consultant || '-'}</Col>
              <Col span={24}><strong>案例描述：</strong>{currentCase.description || '-'}</Col>
              <Col span={24}><strong>提交时间：</strong>{currentCase.created_at}</Col>
            </Row>
            <Divider>素材照片（{currentAssets.length}张）</Divider>
            <div className="asset-grid">
              {currentAssets.map(a => (
                <div key={a.id} className="asset-card">
                  <div className="asset-thumb">
                    <img src={fileUrl(a.thumbnail_path || a.original_path)} alt="" />
                  </div>
                  <div className="asset-meta">
                    <div style={{ fontWeight: 500 }}>{a.phase || '未标注'}</div>
                    <div className="asset-tags">
                      {a.mosaic_applied ? <Tag color="green" icon={<StopOutlined />}>已打码</Tag> : <Tag color="default">未打码</Tag>}
                      {a.watermark_applied ? <Tag color="blue">已加水印</Tag> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
