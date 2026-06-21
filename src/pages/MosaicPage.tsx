import { useState, useEffect, useRef } from 'react'
import {
  Row, Col, Button, Card, Tag, Space, message, Empty, Select, Input,
  Divider, Alert, Switch, Tooltip
} from 'antd'
import {
  BlockOutlined, EyeOutlined, EyeInvisibleOutlined, CheckCircleOutlined,
  PictureOutlined, ThunderboltOutlined, WatermarkOutlined, InfoCircleOutlined
} from '@ant-design/icons'
import { caseApi, assetApi, imageApi, fileUrl } from '../services/api'
import { CaseItem, AssetItem, MosaicArea } from '../types'
import { DEFAULT_WATERMARK, DEFAULT_DISCLAIMER } from '../constants'

interface Props {
  onDataChange?: () => void
}

export default function MosaicPage({ onDataChange }: Props) {
  const [cases, setCases] = useState<CaseItem[]>([])
  const [currentCase, setCurrentCase] = useState<CaseItem | null>(null)
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [currentAsset, setCurrentAsset] = useState<AssetItem | null>(null)
  const [areas, setAreas] = useState<MosaicArea[]>([])
  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [tempArea, setTempArea] = useState<MosaicArea | null>(null)
  const [showProcessed, setShowProcessed] = useState(true)
  const [watermarkText, setWatermarkText] = useState(DEFAULT_WATERMARK)
  const [disclaimerText, setDisclaimerText] = useState(DEFAULT_DISCLAIMER)
  const [processing, setProcessing] = useState(false)
  const imgWrapRef = useRef<HTMLDivElement>(null)

  const loadCases = async () => {
    const list = await caseApi.list()
    setCases(list)
    onDataChange?.()
  }

  useEffect(() => { loadCases() }, [])

  const selectCase = async (c: CaseItem) => {
    setCurrentCase(c)
    const list = await assetApi.list(c.id)
    setAssets(list)
    setCurrentAsset(null)
    setAreas([])
  }

  const selectAsset = (a: AssetItem) => {
    setCurrentAsset(a)
    setAreas([])
    setShowProcessed(!!a.processed_path)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imgWrapRef.current || !currentAsset) return
    const rect = imgWrapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setDrawing(true)
    setDrawStart({ x, y })
    setTempArea({ x, y, width: 0, height: 0 })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !drawStart || !imgWrapRef.current) return
    const rect = imgWrapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setTempArea({
      x: Math.min(drawStart.x, x),
      y: Math.min(drawStart.y, y),
      width: Math.abs(x - drawStart.x),
      height: Math.abs(y - drawStart.y)
    })
  }

  const handleMouseUp = () => {
    if (tempArea && tempArea.width > 3 && tempArea.height > 3) {
      setAreas(prev => [...prev, tempArea])
    }
    setDrawing(false)
    setDrawStart(null)
    setTempArea(null)
  }

  const removeArea = (idx: number) => {
    setAreas(prev => prev.filter((_, i) => i !== idx))
  }

  const autoFaceAreas = () => {
    setAreas([
      { x: 25, y: 10, width: 50, height: 50 },
      { x: 20, y: 68, width: 60, height: 20 }
    ])
    message.info('已添加默认面部和隐私区域，可手动调整')
  }

  const applyMosaic = async () => {
    if (!currentAsset) return
    if (areas.length === 0) {
      message.warning('请先在图片上框选需要打码的区域')
      return
    }
    setProcessing(true)
    try {
      await imageApi.applyMosaic(currentAsset.id, areas)
      message.success('马赛克处理已应用')
      const refreshed = await assetApi.list(currentCase!.id)
      setAssets(refreshed)
      const updated = refreshed.find(a => a.id === currentAsset.id)
      if (updated) {
        setCurrentAsset(updated)
        setShowProcessed(true)
      }
      setAreas([])
    } finally {
      setProcessing(false)
    }
  }

  const applyWatermark = async () => {
    if (!currentAsset) return
    setProcessing(true)
    try {
      await imageApi.applyWatermark(currentAsset.id, watermarkText)
      message.success('机构水印已添加')
      const refreshed = await assetApi.list(currentCase!.id)
      setAssets(refreshed)
      const updated = refreshed.find(a => a.id === currentAsset.id)
      if (updated) setCurrentAsset(updated)
    } finally {
      setProcessing(false)
    }
  }

  const applyDisclaimer = async () => {
    if (!currentAsset) return
    setProcessing(true)
    try {
      await imageApi.addDisclaimer(currentAsset.id, disclaimerText)
      message.success('合规提示语已添加')
      const refreshed = await assetApi.list(currentCase!.id)
      setAssets(refreshed)
      const updated = refreshed.find(a => a.id === currentAsset.id)
      if (updated) setCurrentAsset(updated)
    } finally {
      setProcessing(false)
    }
  }

  const applyAll = async () => {
    if (!currentCase || assets.length === 0) {
      message.warning('请先选择案例')
      return
    }
    setProcessing(true)
    try {
      for (const a of assets) {
        if (watermarkText && !a.watermark_applied) {
          await imageApi.applyWatermark(a.id, watermarkText)
        }
        if (disclaimerText && !a.disclaimer_applied) {
          await imageApi.addDisclaimer(a.id, disclaimerText)
        }
      }
      message.success(`已批量处理 ${assets.length} 张素材`)
      const refreshed = await assetApi.list(currentCase.id)
      setAssets(refreshed)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 className="page-title">马赛克处理</h2>
          <p className="page-subtitle">对照片面部、敏感隐私区域进行一键打码遮挡，添加机构水印与合规提示语</p>
        </div>
        <Space>
          <Button icon={<WatermarkOutlined />} onClick={applyAll} loading={processing}>
            批量加水印+提示语
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <div className="card-section" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            <div className="card-section-title">案例列表（{cases.length}）</div>
            {cases.length === 0 ? (
              <Empty description="暂无案例" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {cases.map(c => (
                  <Card
                    key={c.id}
                    size="small"
                    hoverable
                    onClick={() => selectCase(c)}
                    style={{
                      border: currentCase?.id === c.id ? '2px solid #1d4e89' : '1px solid #e2e8f0',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.project_type}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {c.body_part} · {c.asset_count || 0}张
                    </div>
                  </Card>
                ))}
              </Space>
            )}
          </div>
        </Col>

        <Col span={8}>
          <div className="card-section" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            <div className="card-section-title">素材照片（{assets.length}）</div>
            {!currentCase ? (
              <Empty description="请先选择案例" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : assets.length === 0 ? (
              <Empty description="暂无素材" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div className="asset-grid">
                {assets.map(a => (
                  <div
                    key={a.id}
                    className={`asset-card ${currentAsset?.id === a.id ? 'selected' : ''}`}
                    onClick={() => selectAsset(a)}
                  >
                    <div className="asset-thumb">
                      <img src={fileUrl(a.thumbnail_path || a.original_path)} alt="" />
                    </div>
                    <div className="asset-meta">
                      <div style={{ fontWeight: 500, fontSize: 12 }}>{a.phase || '未标注'}</div>
                      <div className="asset-tags">
                        {a.mosaic_applied && <Tag color="green" icon={<BlockOutlined />}>打码</Tag>}
                        {a.watermark_applied && <Tag color="blue">水印</Tag>}
                        {a.disclaimer_applied && <Tag color="orange">提示</Tag>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Col>

        <Col span={10}>
          <div className="card-section">
            <div className="card-section-title" style={{ justifyContent: 'space-between', display: 'flex' }}>
              <span>图像处理</span>
              {currentAsset?.processed_path && (
                <Space size="small">
                  <Switch
                    size="small"
                    checked={showProcessed}
                    onChange={setShowProcessed}
                    checkedChildren={<EyeOutlined />}
                    unCheckedChildren={<EyeInvisibleOutlined />}
                  />
                  <span style={{ fontSize: 12, color: '#64748b' }}>查看处理图</span>
                </Space>
              )}
            </div>

            {!currentAsset ? (
              <Empty description="请选择一张素材照片进行处理" style={{ padding: '80px 0' }} />
            ) : (
              <div>
                <Alert
                  type="info"
                  showIcon
                  icon={<InfoCircleOutlined />}
                  style={{ marginBottom: 12 }}
                  message="操作提示：在图片上按住鼠标拖拽，框选需要打码的面部或隐私区域，然后点击「应用马赛克」"
                />

                <div
                  ref={imgWrapRef}
                  className={`image-canvas-wrap ${drawing ? 'drawing' : ''}`}
                  style={{ border: '1px solid #e2e8f0', borderRadius: 6, width: '100%', display: 'flex', justifyContent: 'center', background: '#f8fafc' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img
                    src={fileUrl(showProcessed && currentAsset.processed_path ? currentAsset.processed_path : currentAsset.original_path)}
                    alt=""
                    draggable={false}
                    style={{ maxHeight: 360 }}
                  />
                  {areas.map((a, i) => (
                    <div
                      key={i}
                      className="mosaic-box"
                      style={{
                        left: `${a.x}%`,
                        top: `${a.y}%`,
                        width: `${a.width}%`,
                        height: `${a.height}%`
                      }}
                    >
                      <button className="remove-btn" onClick={(e) => { e.stopPropagation(); removeArea(i) }}>×</button>
                    </div>
                  ))}
                  {tempArea && (
                    <div
                      className="mosaic-box"
                      style={{
                        left: `${tempArea.x}%`,
                        top: `${tempArea.y}%`,
                        width: `${tempArea.width}%`,
                        height: `${tempArea.height}%`,
                        background: 'rgba(231,111,81,0.25)'
                      }}
                    />
                  )}
                  <div className="draw-hint">拖拽鼠标框选打码区域</div>
                </div>

                <Divider style={{ margin: '16px 0' }} />

                <Space direction="vertical" style={{ width: '100%' }} size={10}>
                  <div>
                    <Space>
                      <Button icon={<ThunderboltOutlined />} onClick={autoFaceAreas} size="small">
                        自动添加面部/隐私区
                      </Button>
                      <Button onClick={() => setAreas([])} size="small" disabled={areas.length === 0}>
                        清除区域（{areas.length}）
                      </Button>
                      <Button
                        type="primary"
                        icon={<BlockOutlined />}
                        onClick={applyMosaic}
                        loading={processing}
                        disabled={areas.length === 0}
                      >
                        应用马赛克
                      </Button>
                    </Space>
                  </div>

                  <Divider style={{ margin: '8px 0' }} />

                  <div>
                    <div style={{ fontSize: 13, color: '#334155', marginBottom: 6 }}>
                      <Space>
                        <WatermarkOutlined /> 机构水印
                      </Space>
                    </div>
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        value={watermarkText}
                        onChange={e => setWatermarkText(e.target.value)}
                        placeholder="请输入水印文字"
                      />
                      <Button type="primary" ghost onClick={applyWatermark} loading={processing}>添加水印</Button>
                    </Space>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, color: '#334155', marginBottom: 6 }}>
                      <Space>
                        <InfoCircleOutlined /> 合规提示语
                      </Space>
                    </div>
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        value={disclaimerText}
                        onChange={e => setDisclaimerText(e.target.value)}
                        placeholder="恢复期效果因人而异"
                      />
                      <Button type="primary" ghost onClick={applyDisclaimer} loading={processing}>添加提示语</Button>
                    </Space>
                  </div>

                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                    <div>原图和处理图将同时保留，可通过右上角开关预览切换</div>
                    <div>建议处理流程：打码 → 水印 → 提示语</div>
                  </div>
                </Space>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  )
}
