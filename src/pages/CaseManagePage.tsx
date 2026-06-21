import { useState, useEffect } from 'react'
import {
  Row, Col, Button, Table, Tag, Space, Modal, Form, Input, Select,
  InputNumber, message, Popconfirm, Drawer, Empty, Divider, Input as AntInput
} from 'antd'
import {
  EditOutlined, DeleteOutlined, SearchOutlined, FilterOutlined,
  FileTextOutlined, PlusOutlined
} from '@ant-design/icons'
import { caseApi, assetApi, dialog, fileUrl } from '../services/api'
import { CaseItem, AssetItem } from '../types'
import { PROJECT_TYPES, BODY_PARTS, AGE_GROUPS, CASE_STATUS, PERIODS } from '../constants'

const { Option } = Select
const { TextArea } = AntInput

interface Props {
  onDataChange?: () => void
}

export default function CaseManagePage({ onDataChange }: Props) {
  const [cases, setCases] = useState<CaseItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<any>({})
  const [keyword, setKeyword] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editCase, setEditCase] = useState<CaseItem | null>(null)
  const [form] = Form.useForm()
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailCase, setDetailCase] = useState<CaseItem | null>(null)
  const [detailAssets, setDetailAssets] = useState<AssetItem[]>([])

  const loadData = async () => {
    setLoading(true)
    const list = await caseApi.list({ ...filters, keyword })
    setCases(list)
    setLoading(false)
    onDataChange?.()
  }

  useEffect(() => { loadData() }, [filters])

  const handleSearch = () => { loadData() }

  const openEdit = (c?: CaseItem) => {
    setEditCase(c || null)
    form.setFieldsValue(c || {})
    setEditOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (editCase) {
        await caseApi.update(editCase.id, values)
        message.success('案例信息已更新')
      } else {
        await caseApi.create({ ...values, status: 'pending' })
        message.success('案例已创建')
      }
      setEditOpen(false)
      loadData()
    } catch (e: any) {
      if (!e?.errorFields) message.error('保存失败')
    }
  }

  const handleDelete = async (id: string) => {
    await caseApi.delete(id)
    message.success('案例已删除')
    loadData()
  }

  const openDetail = async (c: CaseItem) => {
    setDetailCase(c)
    const assets = await assetApi.list(c.id)
    setDetailAssets(assets)
    setDetailOpen(true)
  }

  const updateCopyPoints = async (text: string) => {
    if (!detailCase) return
    await caseApi.update(detailCase.id, { copy_points: text })
    message.success('文案要点已保存')
    setDetailCase({ ...detailCase, copy_points: text })
  }

  const columns = [
    {
      title: '项目类型',
      dataIndex: 'project_type',
      key: 'project_type',
      width: 130,
      filters: PROJECT_TYPES.map(p => ({ text: p, value: p })),
      onFilter: (v: any, r: CaseItem) => r.project_type === v
    },
    {
      title: '治疗部位',
      dataIndex: 'body_part',
      key: 'body_part',
      width: 100,
      filters: BODY_PARTS.map(p => ({ text: p, value: p })),
      onFilter: (v: any, r: CaseItem) => r.body_part === v
    },
    {
      title: '年龄段',
      dataIndex: 'age_group',
      key: 'age_group',
      width: 90,
      filters: AGE_GROUPS.map(a => ({ text: a.label, value: a.value })),
      onFilter: (v: any, r: CaseItem) => r.age_group === v,
      render: (v: string) => v ? AGE_GROUPS.find(a => a.value === v)?.label : '-'
    },
    {
      title: '咨询师',
      dataIndex: 'consultant',
      key: 'consultant',
      width: 100,
      render: (v: string) => v || '-'
    },
    {
      title: '素材数',
      dataIndex: 'asset_count',
      key: 'asset_count',
      width: 80,
      render: (v: number) => `${v || 0} 张`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: keyof typeof CASE_STATUS) => {
        const s = CASE_STATUS[v] || { label: v, color: 'default' }
        return <Tag color={s.color as any}>{s.label}</Tag>
      }
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 170,
      sorter: (a: CaseItem, b: CaseItem) => a.updated_at.localeCompare(b.updated_at)
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, r: CaseItem) => (
        <Space size="small">
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => openDetail(r)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除此案例？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 className="page-title">案例整理</h2>
          <p className="page-subtitle">按项目、部位、周期和年龄段对素材进行分类整理，便于检索与复用</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>新建案例</Button>
      </div>

      <div className="card-section">
        <Row gutter={12} align="middle" style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Input
              placeholder="搜索案例描述、文案要点"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="项目类型"
              allowClear
              value={filters.project_type || undefined}
              onChange={v => setFilters(prev => ({ ...prev, project_type: v }))}
              style={{ width: '100%' }}
            >
              {PROJECT_TYPES.map(p => <Option key={p} value={p}>{p}</Option>)}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="治疗部位"
              allowClear
              value={filters.body_part || undefined}
              onChange={v => setFilters(prev => ({ ...prev, body_part: v }))}
              style={{ width: '100%' }}
            >
              {BODY_PARTS.map(p => <Option key={p} value={p}>{p}</Option>)}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="案例状态"
              allowClear
              value={filters.status || undefined}
              onChange={v => setFilters(prev => ({ ...prev, status: v }))}
              style={{ width: '100%' }}
            >
              {Object.entries(CASE_STATUS).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
            </Select>
          </Col>
          <Col span={4}>
            <Space>
              <Button type="primary" icon={<FilterOutlined />} onClick={handleSearch}>筛选</Button>
              <Button onClick={() => { setFilters({}); setKeyword(''); setTimeout(loadData, 0) }}>重置</Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={cases}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1100 }}
        />
      </div>

      <Modal
        title={editCase ? '编辑案例信息' : '新建案例'}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        width={720}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="项目类型" name="project_type" rules={[{ required: true }]}>
                <Select options={PROJECT_TYPES.map(p => ({ label: p, value: p }))} placeholder="请选择" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="治疗部位" name="body_part" rules={[{ required: true }]}>
                <Select options={BODY_PARTS.map(p => ({ label: p, value: p }))} placeholder="请选择" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="年龄段" name="age_group">
                <Select options={AGE_GROUPS} placeholder="请选择" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="年龄" name="age">
                <InputNumber min={16} max={80} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="提交咨询师" name="consultant">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="术后周期" name="period">
                <Select options={PERIODS.map(p => ({ label: p, value: p }))} placeholder="请选择" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="案例描述" name="description">
                <TextArea rows={3} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="文案要点（运营填写）" name="copy_points">
                <TextArea rows={4} placeholder="运营填写的推广文案要点、卖点提炼等" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title="案例详情与文案编辑"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={900}
      >
        {detailCase && (
          <div>
            <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
              <Col span={6}><strong>项目：</strong>{detailCase.project_type}</Col>
              <Col span={6}><strong>部位：</strong>{detailCase.body_part}</Col>
              <Col span={6}><strong>年龄段：</strong>{detailCase.age_group || '-'}</Col>
              <Col span={6}><strong>状态：</strong>
                <Tag color={CASE_STATUS[detailCase.status as keyof typeof CASE_STATUS]?.color as any}>
                  {CASE_STATUS[detailCase.status as keyof typeof CASE_STATUS]?.label}
                </Tag>
              </Col>
              <Col span={24}><strong>描述：</strong>{detailCase.description || '-'}</Col>
            </Row>
            <Divider>素材照片（{detailAssets.length}张）</Divider>
            {detailAssets.length === 0 ? (
              <Empty description="暂无素材" />
            ) : (
              <div className="asset-grid">
                {detailAssets.map(a => (
                  <div key={a.id} className="asset-card">
                    <div className="asset-thumb">
                      <img src={fileUrl(a.processed_path || a.thumbnail_path || a.original_path)} alt="" />
                    </div>
                    <div className="asset-meta">
                      <div style={{ fontWeight: 500 }}>{a.phase || '未标注'}</div>
                      <div className="asset-tags">
                        {a.mosaic_applied ? <Tag color="green">已打码</Tag> : <Tag color="default">未打码</Tag>}
                        {a.watermark_applied ? <Tag color="blue">水印</Tag> : null}
                        {a.disclaimer_applied ? <Tag color="orange">提示语</Tag> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Divider>运营文案要点</Divider>
            <TextArea
              rows={6}
              defaultValue={detailCase.copy_points || ''}
              placeholder="请填写推广文案要点、卖点、注意事项等"
              onBlur={e => updateCopyPoints(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={{ fontSize: 12, color: '#94a3b8' }}>失焦自动保存</div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
