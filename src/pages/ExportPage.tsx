import { useState, useEffect } from 'react'
import {
  Row, Col, Card, Button, Table, Tag, Space, Select, message, Empty,
  Checkbox, Alert, Modal, Input, Tooltip
} from 'antd'
import {
  RocketOutlined, ExportOutlined, CheckCircleOutlined, WarningOutlined,
  WechatOutlined, VideoCameraOutlined, FileZipOutlined, FolderOpenOutlined, SafetyOutlined
} from '@ant-design/icons'
import { caseApi, assetApi, authApi, exportApi, dialog, fileUrl } from '../services/api'
import { CaseItem, AssetItem, AuthorizationItem } from '../types'
import { CHANNELS, CASE_STATUS } from '../constants'
import dayjs from 'dayjs'

interface Props {
  onDataChange?: () => void
}

export default function ExportPage({ onDataChange }: Props) {
  const [approvedCases, setApprovedCases] = useState<CaseItem[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [channel, setChannel] = useState<string>('wechat_official')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewCase, setPreviewCase] = useState<CaseItem | null>(null)
  const [previewAssets, setPreviewAssets] = useState<AssetItem[]>([])
  const [previewAuth, setPreviewAuth] = useState<AuthorizationItem | null>(null)
  const [exporting, setExporting] = useState(false)

  const loadData = async () => {
    const list = await caseApi.list()
    setApprovedCases(list)
    onDataChange?.()
  }

  useEffect(() => { loadData() }, [])

  const openPreview = async (c: CaseItem) => {
    setPreviewCase(c)
    const [assets, auth] = await Promise.all([assetApi.list(c.id), authApi.get(c.id)])
    setPreviewAssets(assets)
    setPreviewAuth(auth)
    setPreviewOpen(true)
  }

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择要打包的案例')
      return
    }
    const outputDir = await dialog.selectDirectory()
    if (!outputDir) return
    setExporting(true)
    try {
      const zipPath = await exportApi.package(selectedIds, channel, outputDir)
      message.success(`发布包已生成：${zipPath}`)
    } finally {
      setExporting(false)
    }
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
      title: '素材数',
      dataIndex: 'asset_count',
      width: 80,
      render: (v: number) => `${v || 0} 张`
    },
    {
      title: '授权',
      key: 'auth',
      width: 100,
      render: (_: any, r: CaseItem) => <AuthStatusTag caseId={r.id} />
    },
    {
      title: '合规检查',
      key: 'compliance',
      width: 120,
      render: (_: any, r: CaseItem) => <ComplianceTag caseId={r.id} />
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: keyof typeof CASE_STATUS) => {
        const s = CASE_STATUS[v] || { label: v, color: 'default' }
        return <Tag color={s.color as any}>{s.label}</Tag>
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: any, r: CaseItem) => (
        <Button type="link" size="small" onClick={() => openPreview(r)}>预览</Button>
      )
    }
  ]

  const selectedCases = approvedCases.filter(c => selectedIds.includes(c.id))
  const readyCount = selectedCases.filter(c => c.status === 'approved').length

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 className="page-title">发布包</h2>
          <p className="page-subtitle">将审核通过的合规素材打包，供公众号、朋友圈、短视频封面等渠道使用</p>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <div className="stats-card">
            <div className="label">可发布案例</div>
            <div className="value" style={{ color: '#2a9d8f' }}>
              {approvedCases.filter(c => c.status === 'approved').length}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stats-card">
            <div className="label">待审核</div>
            <div className="value" style={{ color: '#e9c46a' }}>
              {approvedCases.filter(c => c.status === 'pending').length}
            </div>
          </div>
        </Col>
        <Col span={12}>
          <div className="card-section" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: '#334155', fontWeight: 500, whiteSpace: 'nowrap' }}>导出渠道：</span>
            <Select
              value={channel}
              onChange={setChannel}
              style={{ flex: 1 }}
              options={CHANNELS}
            />
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleExport}
              loading={exporting}
              disabled={selectedIds.length === 0}
            >
              打包导出（{selectedIds.length}）
            </Button>
          </div>
        </Col>
      </Row>

      {selectedIds.length > 0 && readyCount < selectedIds.length && (
        <Alert
          showIcon
          type="warning"
          style={{ marginBottom: 16 }}
          message={
            <Space>
              <WarningOutlined />
              选中的 {selectedIds.length} 个案例中，有 {selectedIds.length - readyCount} 个未通过审核，建议仅导出已通过的案例
            </Space>
          }
        />
      )}

      <div className="card-section">
        <div className="card-section-title">案例素材列表</div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={approvedCases}
          pagination={{ pageSize: 10 }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys: React.Key[]) => setSelectedIds(keys as string[]),
            getCheckboxProps: (r: CaseItem) => ({
              disabled: r.status === 'forbidden'
            })
          }}
        />
      </div>

      <Modal
        title="发布包预览"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewOpen(false)}>关闭</Button>,
          <Button key="export" type="primary" icon={<FileZipOutlined />}
            onClick={() => {
              if (previewCase) setSelectedIds([previewCase.id])
              setPreviewOpen(false)
            }}>
            仅导出此案例
          </Button>
        ]}
        width={900}
      >
        {previewCase && (
          <div>
            <Row gutter={[16, 8]} style={{ marginBottom: 12 }}>
              <Col span={8}><strong>项目：</strong>{previewCase.project_type}</Col>
              <Col span={8}><strong>部位：</strong>{previewCase.body_part}</Col>
              <Col span={8}><strong>年龄段：</strong>{previewCase.age_group || '-'}</Col>
              <Col span={24}><strong>描述：</strong>{previewCase.description || '-'}</Col>
            </Row>

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                <SafetyOutlined style={{ color: '#1d4e89' }} /> 合规检查
              </div>
              <Row gutter={12}>
                <Col span={8}>
                  <Tag color={previewAuth ? 'success' : 'error'}>
                    {previewAuth ? '已建档授权' : '⚠️ 无授权档案'}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Tag color={previewAssets.every(a => a.mosaic_applied) ? 'success' : 'warning'}>
                    {previewAssets.every(a => a.mosaic_applied) ? '已全部打码' : '部分素材未打码'}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Tag color={previewAssets.every(a => a.watermark_applied && a.disclaimer_applied) ? 'success' : 'warning'}>
                    水印+提示语 {previewAssets.every(a => a.watermark_applied && a.disclaimer_applied) ? '完整' : '不完整'}
                  </Tag>
                </Col>
              </Row>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              素材预览（{previewAssets.length}张）
            </div>
            {previewAssets.length === 0 ? (
              <Empty description="暂无素材" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div className="asset-grid">
                {previewAssets.map(a => (
                  <div key={a.id} className="asset-card">
                    <div className="asset-thumb">
                      <img src={fileUrl(a.processed_path || a.thumbnail_path || a.original_path)} alt="" />
                    </div>
                    <div className="asset-meta">
                      <div style={{ fontWeight: 500, fontSize: 12 }}>{a.phase || '未标注'}</div>
                      <div className="asset-tags">
                        {a.mosaic_applied && <Tag color="green">打码</Tag>}
                        {a.watermark_applied && <Tag color="blue">水印</Tag>}
                        {a.disclaimer_applied && <Tag color="orange">提示</Tag>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function AuthStatusTag({ caseId }: { caseId: string }) {
  const [auth, setAuth] = useState<AuthorizationItem | null>(null)
  useEffect(() => {
    authApi.get(caseId).then(setAuth)
  }, [caseId])
  if (!auth) return <Tag color="error">未授权</Tag>
  const expired = auth.expire_date && dayjs(auth.expire_date).isBefore(dayjs())
  return expired ? <Tag color="error">已过期</Tag> : <Tag color="success">已授权</Tag>
}

function ComplianceTag({ caseId }: { caseId: string }) {
  const [assets, setAssets] = useState<AssetItem[]>([])
  useEffect(() => {
    assetApi.list(caseId).then(setAssets)
  }, [caseId])
  if (assets.length === 0) return <Tag color="default">无素材</Tag>
  const allMosaic = assets.every(a => a.mosaic_applied)
  const allWatermark = assets.every(a => a.watermark_applied && a.disclaimer_applied)
  if (allMosaic && allWatermark) return <Tag color="success" icon={<CheckCircleOutlined />}>合规</Tag>
  if (!allMosaic) return <Tag color="warning">缺打码</Tag>
  return <Tag color="warning">缺提示</Tag>
}
