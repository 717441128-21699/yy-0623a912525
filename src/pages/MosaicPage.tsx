import { useState, useEffect, useRef } from 'react'
import {
  Row, Col, Button, Card, Tag, Space, message, Empty, Input,
  Divider, Alert, Switch
} from 'antd'
import {
  BlockOutlined, EyeOutlined, EyeInvisibleOutlined,
  ThunderboltOutlined, EditOutlined, InfoCircleOutlined
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
  const imgRef = useRef<HTMLImageElement>(null)

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

  const getImageRect = () => {
    if (!imgRef.current) return null
    const rect = imgRef.current.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imgRef.current || !currentAsset) return
    const rect = getImageRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    if (x < 0 || x > 100 || y < 0 || y > 100) return
    setDrawing(true)
    setDrawStart({ x, y })
    setTempArea({ x, y, width: 0, height: 0 })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !drawStart || !imgRef.current) return
    const rect = getImageRect()
    if (!rect) return
    let x = ((e.clientX - rect.left) / rect.width) * 100
    let y = ((e.clientY - rect.top) / rect.height) * 100
    x = Math.max(0, Math.min(100, x))
    y = Math.max(0, Math.min(100, y))
    setTempArea({
      x: Math.min(drawStart.x, x),
      y: Math.min(drawStart.y, y),
      width: Math.abs(x - drawStart.x),
      height: Math.abs(y - drawStart.y)
    })
  }

  const handleMouseUp = () => {
    if (tempArea && tempArea.width > 2 && tempArea.height > 2) {
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
      { x: 25, y: 8, width: 50, height: 55 },
      { x: 25, y: 70, width: 50, height: 18 }
    ])
    message.info('已添加默认面部和隐私区域框，可拖拽边缘调整')
  }

  const applyMosaic = async () => {
    if (!currentAsset) return
    if (areas.length === 0) {
      message.warning('请先在图片上框选需要打码的区域')
      return
    }
    setProcessing(true)
    try {
      const res = await imageApi.applyMosaic(currentAsset.id, areas)
      if (res) {
        message.success('马赛克已应用，对应区域已完全模糊遮挡')
        const refreshed = await assetApi.list(currentCase!.id)
        setAssets(refreshed)
        const updated = refreshed.find(a => a.id === currentAsset.id)
        if (updated) {
          setCurrentAsset(updated)
          setShowProcessed(true)
        }
        setAreas([])
      } else {
        message.error('马赛克处理失败，请重试')
      }
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
      message.success('合规提示语已添加到底部')
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
          <p className="page-subtitle">对照片面部、敏感隐私区域进行打码遮挡，添加机构水印与合规提示语</p>
        </div>
        <Space>
          <Button icon={<EditOutlined />} onClick={applyAll} loading={processing}>
            批量加水印+提示语
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={5}>
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

        <Col span={7}>
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

        <Col span={12}>
          <div className="card-section">
            <div className="card-section-title" style={{ justifyContent: 'space-between', display: 'flex' }}>
              <span>图像处理区域</span>
              {currentAsset?.processed_path && (
                <Space size="small">
                  <Switch
                    size="small"
                    checked={showProcessed}
                    onChange={setShowProcessed}
                    checkedChildren={<EyeOutlined />}
                    unCheckedChildren={<EyeInvisibleOutlined />}
                  />
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {showProcessed ? '处理图预览' : '原图预览'}
                  </span>
                </Space>
              )}
            </div>

            {!currentAsset ? (
              <Empty description="请选择左侧一张素材照片进行处理" style={{ padding: '80px 0' }} />
            ) : (
              <div>
                <Alert
                  type="info"
                  showIcon
                  icon={<InfoCircleOutlined />}
                  style={{ marginBottom: 12 }}
                  message="在图片区域内按住鼠标左键拖动即可框选打码区域（仅在图片上有效，超出图片区域自动忽略）"
                />

                <div
                  className={`image-canvas-wrap ${drawing ? 'drawing' : ''}`}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    display: 'inline-block',
                    background: '#f8fafc',
                    position: 'relative',
                    lineHeight: 0
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img
                    ref={imgRef}
                    src={fileUrl(showProcessed && currentAsset.processed_path ? currentAsset.processed_path : currentAsset.original_path)}
                    alt=""
                    draggable={false}
                    style={{ display: 'block', maxWidth: '100%', maxHeight: 420, userSelect: 'none' }}
                  />
                  {areas.map((a, i) => (
                    <div
                      key={i}
                      className="mosaic-box"
                      style={{
                        left: `${a.x}%`,
                        top: `${a.y}%`,
                        width: `${a.width}%`,
                        height: `${a.height}%`,
                        position: 'absolute'
                      }}
                    >
                      <button
                        className="remove-btn"
                        onClick={(e) => { e.stopPropagation(); removeArea(i) }}
                        title="删除此区域"
                      >×</button>
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
                        position: 'absolute',
                        background: 'rgba(231,111,81,0.28)',
                        border: '2px dashed #e76f51'
                      }}
                    />
                  )}
                  <div className="draw-hint" style={{ pointerEvents: drawing ? 'none' : 'auto' }}>
                    在图片区域内拖拽鼠标框选打码
                  </div>
                </div>

                <Divider style={{ margin: '16px 0' }} />

                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <div>
                    <Space wrap>
                      <Button icon={<ThunderboltOutlined />} onClick={autoFaceAreas} size="small">
                        自动添加面部+隐私区
                      </Button>
                      <Button onClick={() => setAreas([])} size="small" disabled={areas.length === 0}>
                        清除所有区域（{areas.length}）
                      </Button>
                      <Button
                        type="primary"
                        danger={false}
                        icon={<BlockOutlined />}
                        onClick={applyMosaic}
                        loading={processing}
                        disabled={areas.length === 0}
                        style={{ background: '#e76f51', borderColor: '#e76f51' }}
                      >
                        应用马赛克打码
                      </Button>
                      {areas.length > 0 && (
                        <Tag color="orange">{areas.length} 个区域将被模糊遮挡</Tag>
                      )}
                    </Space>
                  </div>

                  <Divider style={{ margin: '4px 0' }} />

                  <div>
                    <div style={{ fontSize: 13, color: '#334155', marginBottom: 6, fontWeight: 500 }}>
                      <Space><EditOutlined style={{ color: '#1d4e89' }} /> 机构水印文字</Space>
                    </div>
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        value={watermarkText}
                        onChange={e => setWatermarkText(e.target.value)}
                        placeholder="请输入水印文字"
                      />
                      <Button type="primary" ghost onClick={applyWatermark} loading={processing}>添加水印</Button>
                    </Space.Compact>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, color: '#334155', marginBottom: 6, fontWeight: 500 }}>
                      <Space><InfoCircleOutlined style={{ color: '#e9c46a' }} /> 底部合规提示语</Space>
                    </div>
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        value={disclaimerText}
                        onChange={e => setDisclaimerText(e.target.value)}
                        placeholder="恢复期效果因人而异"
                      />
                      <Button type="primary" ghost onClick={applyDisclaimer} loading={processing}>添加提示语</Button>
                    </Space.Compact>
                  </div>

                  <div style={{
                    fontSize: 12, color: '#64748b', lineHeight: 1.8,
                    background: '#f8fafc', padding: '10px 14px', borderRadius: 6
                  }}>
                    <div>📌 操作流程：框选打码区域 → 应用马赛克 → 添加水印 → 添加提示语</div>
                    <div>📌 原图和处理图两套版本均会保留，通过右上角开关切换预览</div>
                    <div>📌 打码区域坐标按照片实际显示位置精确计算，鼠标指到哪里就打码到哪里</div>
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
