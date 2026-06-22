import { useState, useEffect } from 'react'
import {
  Row, Col, Button, Table, Tag, Space, Select, message, Empty,
  Alert, Modal, Tooltip, Skeleton
} from 'antd'
import {
  RocketOutlined, ExportOutlined, CheckCircleOutlined, WarningOutlined,
  FileZipOutlined, SafetyOutlined, CloseCircleOutlined
} from '@ant-design/icons'
import { caseApi, assetApi, authApi, exportApi, dialog, fileUrl } from '../services/api'
import { CaseItem, AssetItem, AuthorizationItem } from '../types'
import { CHANNELS, CASE_STATUS } from '../constants'
import dayjs from 'dayjs'

interface Props {
  onDataChange?: () => void
}

interface CaseWithCompliance extends CaseItem {
  auth?: AuthorizationItem | null
  assets?: AssetItem[]
  authOk: boolean
  mosaicOk: boolean
  watermarkOk: boolean
  isExportable: boolean
  complianceLabel: string
  complianceColor: string
}

function computeCompliance(c: CaseItem, auth: AuthorizationItem | null | undefined, assets: AssetItem[]): {
  authOk: boolean
  mosaicOk: boolean
  watermarkOk: boolean
  isExportable: boolean
  complianceLabel: string
  complianceColor: string
} {
  const authOk = !!(auth && auth.customer_name && auth.signed_date && auth.expire_date
    && auth.has_identity && auth.has_signature && auth.has_full_content
    && !dayjs(auth.expire_date).isBefore(dayjs()))
  const hasAssets = assets.length > 0
  const mosaicOk = hasAssets && assets.every(a => a.mosaic_applied)
  const watermarkOk = hasAssets && assets.every(a => a.watermark_applied && a.disclaimer_applied)
  const statusOk = c.status === 'approved'
  const isExportable = statusOk && authOk && mosaicOk && watermarkOk

  if (!statusOk) return { authOk, mosaicOk, watermarkOk, isExportable, complianceLabel: '未通过审核', complianceColor: 'default' }
  if (!authOk) return { authOk, mosaicOk, watermarkOk, isExportable, complianceLabel: '授权不完整', complianceColor: 'error' }
  if (!mosaicOk) return { authOk, mosaicOk, watermarkOk, isExportable, complianceLabel: '素材未打码', complianceColor: 'warning' }
  if (!watermarkOk) return { authOk, mosaicOk, watermarkOk, isExportable, complianceLabel: '缺水印/提示', complianceColor: 'warning' }
  return { authOk, mosaicOk, watermarkOk, isExportable, complianceLabel: '合规可发布', complianceColor: 'success' }
}

export default function ExportPage({ onDataChange }: Props) {
  const [cases, setCases] = useState<CaseWithCompliance[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [channel, setChannel] = useState<string>('wechat_official')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewCase, setPreviewCase] = useState<CaseWithCompliance | null>(null)
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const list = await caseApi.list()
      const enriched: CaseWithCompliance[] = []
      for (const c of list) {
        const [auth, assets] = await Promise.all([authApi.get(c.id), assetApi.list(c.id)])
        const comp = computeCompliance(c, auth, assets)
        enriched.push({ ...c, auth, assets, ...comp })
      }
      setCases(enriched)
      setSelectedIds(prev => prev.filter(id => enriched.find(e => e.id === id && e.isExportable)))
    } finally {
      setLoading(false)
    }
    onDataChange?.()
  }

  useEffect(() => { loadData() }, [])

  const openPreview = (c: CaseWithCompliance) => {
    setPreviewCase(c)
    setPreviewOpen(true)
  }

  const handleExport = async () => {
    const validIds = selectedIds.filter(id => {
      const c = cases.find(cc => cc.id === id)
      return c?.isExportable
    })
    if (validIds.length === 0) {
      message.warning('请选择已通过审核且合规检查通过的案例')
      return
    }
    if (validIds.length < selectedIds.length) {
      message.info(`已自动过滤 ${selectedIds.length - validIds.length} 个不合规案例`)
    }
    const outputDir = await dialog.selectDirectory()
    if (!outputDir) return
    setExporting(true)
    try {
      const zipPath = await exportApi.package(validIds, channel, outputDir)
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
      render: (_: any, r: CaseWithCompliance) => {
        if (!r.auth) return <Tag color="error" icon={<CloseCircleOutlined />}>未建档</Tag>
        const expired = r.auth.expire_date && dayjs(r.auth.expire_date).isBefore(dayjs())
        if (expired) return <Tag color="error">已过期</Tag>
        if (r.authOk) return <Tag color="success" icon={<CheckCircleOutlined />}>完整</Tag>
        return <Tag color="warning">待补全</Tag>
      }
    },
    {
      title: '合规检查',
      key: 'compliance',
      width: 130,
      render: (_: any, r: CaseWithCompliance) => (
        <Tag color={r.complianceColor as any} icon={r.isExportable ? <CheckCircleOutlined /> : <WarningOutlined />}>
          {r.complianceLabel}
        </Tag>
      )
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
      render: (_: any, r: CaseWithCompliance) => (
        <Tooltip title={r.isExportable ? '预览合规素材' : '该案例不合规，无法导出'}>
          <Button type="link" size="small" onClick={() => openPreview(r)} disabled={!r.isExportable}>预览</Button>
        </Tooltip>
      )
    }
  ]

  const exportableCases = cases.filter(c => c.isExportable)
  const exportableCount = exportableCases.length

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
            <div className="label">合规可发布</div>
            <div className="value" style={{ color: '#2a9d8f' }}>{exportableCount}</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stats-card">
            <div className="label">已通过审核</div>
            <div className="value" style={{ color: '#1d4e89' }}>
              {cases.filter(c => c.status === 'approved').length}
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

      {selectedIds.length > 0 && (
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 16 }}
          message={
            <Space>
              <SafetyOutlined />
              当前已选择 {selectedIds.length} 个案例，系统仅会将合规可发布的素材实际打包入压缩包
            </Space>
          }
        />
      )}

      <div className="card-section">
        <div className="card-section-title">合规案例素材列表（仅合规案例可勾选导出）</div>
        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={cases}
            pagination={{ pageSize: 10 }}
            rowSelection={{
              selectedRowKeys: selectedIds,
              onChange: (keys: React.Key[]) => {
                const validKeys = keys.filter(k => {
                  const c = cases.find(cc => cc.id === k)
                  return c?.isExportable
                }) as string[]
                setSelectedIds(validKeys)
              },
              getCheckboxProps: (r: CaseWithCompliance) => ({
                disabled: !r.isExportable,
                title: r.isExportable ? '可导出' : '该案例不合规，无法导出（需通过审核+完整授权+全部打码+水印提示语）'
              })
            }}
          />
        )}
      </div>

      <Modal
        title="发布包预览"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewOpen(false)}>关闭</Button>,
          <Button key="export" type="primary" icon={<FileZipOutlined />}
            onClick={() => {
              if (previewCase?.isExportable) {
                setSelectedIds([previewCase.id])
                setPreviewOpen(false)
              }
            }}>
            导出此案例
          </Button>
        ]}
        width={900}
        destroyOnClose
      >
        {previewCase && (
          <div>
            <Row gutter={[16, 8]} style={{ marginBottom: 12 }}>
              <Col span={8}><strong>项目：</strong>{previewCase.project_type}</Col>
              <Col span={8}><strong>部位：</strong>{previewCase.body_part}</Col>
              <Col span={8}><strong>年龄段：</strong>{previewCase.age_group || '-'}</Col>
              <Col span={24}><strong>描述：</strong>{previewCase.description || '-'}</Col>
            </Row>

            <div style={{ background: '#ecfdf5', border: '1px solid #10b981', padding: 12, borderRadius: 6, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 8 }}>
                <SafetyOutlined /> 合规检查 — 全部通过，可安全发布
              </div>
              <Row gutter={12}>
                <Col span={8}>
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    {previewCase.authOk ? '授权完整有效' : '授权缺失'}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    {previewCase.mosaicOk ? '已全部打码' : '部分未打码'}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    {previewCase.watermarkOk ? '水印+提示语完整' : '水印/提示语缺失'}
                  </Tag>
                </Col>
              </Row>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              素材预览（{previewCase.assets?.length || 0}张）
            </div>
            {!previewCase.assets || previewCase.assets.length === 0 ? (
              <Empty description="暂无素材" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div className="asset-grid">
                {previewCase.assets.map(a => (
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
