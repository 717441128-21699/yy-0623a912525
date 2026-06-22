import { useState, useEffect, useMemo } from 'react'
import {
  Row, Col, Card, Button, Table, Tag, Space, Modal, Form, Input, DatePicker,
  Checkbox, Select, message, Alert, Empty, Progress, Descriptions, Skeleton
} from 'antd'
import {
  SafetyCertificateOutlined, WarningOutlined, CheckCircleOutlined,
  CloseCircleOutlined, EditOutlined, ClockCircleOutlined, ExclamationCircleOutlined
} from '@ant-design/icons'
import { caseApi, authApi } from '../services/api'
import { CaseItem, AuthorizationItem } from '../types'
import dayjs from 'dayjs'

interface Props {
  onDataChange?: () => void
}

interface CaseWithAuth extends CaseItem {
  auth?: AuthorizationItem | null
  authScore?: number
  authStatusLabel?: string
  authStatusColor?: string
  authIcon?: any
}

function calcAuthScore(a: AuthorizationItem | null | undefined) {
  if (!a) return 0
  let score = 0
  if (a.customer_name) score += 15
  if (a.signed_date) score += 15
  if (a.expire_date) score += 20
  if (a.auth_scope) score += 10
  if (a.has_identity) score += 15
  if (a.has_signature) score += 15
  if (a.has_full_content) score += 10
  return score
}

function getAuthStatus(a: AuthorizationItem | null | undefined) {
  if (!a) {
    return { label: '未建档', color: 'default', icon: <CloseCircleOutlined /> }
  }
  const expired = a.expire_date && dayjs(a.expire_date).isBefore(dayjs())
  const willExpire = a.expire_date && dayjs(a.expire_date).isBefore(dayjs().add(30, 'day')) && !expired
  const score = calcAuthScore(a)
  if (expired) return { label: '已过期', color: 'error', icon: <ExclamationCircleOutlined /> }
  if (willExpire) return { label: '即将过期', color: 'warning', icon: <ClockCircleOutlined /> }
  if (score >= 80) return { label: '完整', color: 'success', icon: <CheckCircleOutlined /> }
  if (score >= 50) return { label: '基本完整', color: 'processing', icon: null }
  return { label: '待补全', color: 'warning', icon: <WarningOutlined /> }
}

export default function AuthPage({ onDataChange }: Props) {
  const [cases, setCases] = useState<CaseWithAuth[]>([])
  const [expiring, setExpiring] = useState<AuthorizationItem[]>([])
  const [selectedCase, setSelectedCase] = useState<CaseWithAuth | null>(null)
  const [authData, setAuthData] = useState<AuthorizationItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const loadData = async () => {
    setLoading(true)
    try {
      const [list, exp] = await Promise.all([caseApi.list(), authApi.listExpiring(30)])
      const authMap = new Map<string, AuthorizationItem>()
      await Promise.all(
        list.map(async (c) => {
          const a = await authApi.get(c.id)
          if (a) authMap.set(c.id, a)
        })
      )
      const enriched: CaseWithAuth[] = list.map(c => {
        const auth = authMap.get(c.id) || null
        const status = getAuthStatus(auth)
        return {
          ...c,
          auth,
          authScore: calcAuthScore(auth),
          authStatusLabel: status.label,
          authStatusColor: status.color as any,
          authIcon: status.icon
        }
      })
      setCases(enriched)
      setExpiring(exp)
    } finally {
      setLoading(false)
    }
    onDataChange?.()
  }

  useEffect(() => { loadData() }, [])

  const loadAuth = async (c: CaseWithAuth) => {
    setSelectedCase(c)
    setAuthData(c.auth || null)
  }

  const openEdit = () => {
    if (!selectedCase) return
    form.setFieldsValue({
      ...authData,
      signed_date: authData?.signed_date ? dayjs(authData.signed_date) : undefined,
      expire_date: authData?.expire_date ? dayjs(authData.expire_date) : undefined,
      has_identity: !!authData?.has_identity,
      has_signature: !!authData?.has_signature,
      has_full_content: !!authData?.has_full_content
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const data = {
        ...values,
        case_id: selectedCase!.id,
        signed_date: values.signed_date?.format('YYYY-MM-DD'),
        expire_date: values.expire_date?.format('YYYY-MM-DD'),
        has_identity: values.has_identity ? 1 : 0,
        has_signature: values.has_signature ? 1 : 0,
        has_full_content: values.has_full_content ? 1 : 0
      }
      if (authData) {
        await authApi.update(authData.id, data)
      } else {
        await authApi.create(data)
      }
      message.success('授权信息已保存')
      setModalOpen(false)
      loadData()
    } catch (e: any) {
      if (!e?.errorFields) message.error('保存失败')
    }
  }

  const completenessScore = useMemo(() => calcAuthScore(authData), [authData])
  const isExpiring = useMemo(() => {
    if (!authData?.expire_date) return false
    return dayjs(authData.expire_date).isBefore(dayjs().add(30, 'day'))
  }, [authData])

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
      title: '授权状态',
      dataIndex: 'authStatusLabel',
      key: 'auth_status',
      width: 120,
      render: (_: any, r: CaseWithAuth) => (
        <Tag color={r.authStatusColor as any} icon={r.authIcon}>
          {r.authStatusLabel}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: any, r: CaseWithAuth) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => loadAuth(r)}>核验授权</Button>
      )
    }
  ]

  return (
    <div className="page-container">
      <div>
        <h2 className="page-title">授权核验</h2>
        <p className="page-subtitle">检查顾客授权说明是否完整，提醒过期授权需重新确认，降低合规风险</p>
      </div>

      {expiring.length > 0 && (
        <Alert
          showIcon
          type="warning"
          style={{ marginBottom: 16 }}
          message={
            <span>
              <WarningOutlined /> 有 {expiring.length} 份授权即将在30天内过期，请及时联系顾客重新确认
            </span>
          }
          description={
            <Space size="large" wrap>
              {expiring.slice(0, 5).map(e => (
                <Tag key={e.id} color="orange">
                  {e.project_type} · {e.body_part} · 到期 {e.expire_date}
                </Tag>
              ))}
              {expiring.length > 5 && <span style={{ color: '#92400e' }}>等共 {expiring.length} 项</span>}
            </Space>
          }
        />
      )}

      <Row gutter={16}>
        <Col span={14}>
          <div className="card-section">
            <div className="card-section-title">案例授权列表</div>
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <Table
                rowKey="id"
                columns={columns}
                dataSource={cases}
                pagination={{ pageSize: 8 }}
                scroll={{ y: 480 }}
                onRow={r => ({ onClick: () => loadAuth(r), style: { cursor: 'pointer' } })}
              />
            )}
          </div>
        </Col>
        <Col span={10}>
          <div className="card-section" style={{ minHeight: 560 }}>
            <div className="card-section-title" style={{ justifyContent: 'space-between', display: 'flex' }}>
              <span>授权详情核验</span>
              {selectedCase && (
                <Button type="primary" size="small" icon={<EditOutlined />} onClick={openEdit}>
                  {authData ? '编辑授权' : '新建授权'}
                </Button>
              )}
            </div>

            {!selectedCase ? (
              <Empty description="点击左侧案例查看授权详情" style={{ padding: '60px 0' }} />
            ) : !authData ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <SafetyCertificateOutlined style={{ fontSize: 48, color: '#cbd5e1' }} />
                <div style={{ marginTop: 12, color: '#64748b' }}>尚未建立授权档案</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>请点击右上角按钮创建完整授权记录</div>
                <Button type="primary" style={{ marginTop: 16 }} onClick={openEdit}>立即建档</Button>
              </div>
            ) : (
              <div>
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                  <Col span={12}>
                    <Card size="small" style={{ background: '#f8fafc', border: 'none' }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>授权完整度</div>
                      <Progress percent={completenessScore}
                        status={completenessScore >= 80 ? 'success' : completenessScore >= 50 ? 'active' : 'exception'} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" style={{
                      background: isExpiring ? '#fef3c7' : '#ecfdf5',
                      border: 'none'
                    }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>有效期状态</div>
                      <div style={{ marginTop: 4, fontWeight: 600, color: isExpiring ? '#92400e' : '#065f46' }}>
                        {authData.expire_date
                          ? (dayjs(authData.expire_date).isBefore(dayjs()) ? '已过期' : `至 ${authData.expire_date}`)
                          : '未设置有效期'}
                      </div>
                    </Card>
                  </Col>
                </Row>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="顾客姓名">{authData.customer_name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="签署日期">{authData.signed_date || '-'}</Descriptions.Item>
                  <Descriptions.Item label="到期日期">
                    <Space>
                      {authData.expire_date || '-'}
                      {isExpiring && <Tag color="warning">即将过期/已过期</Tag>}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="授权范围">{authData.auth_scope || '-'}</Descriptions.Item>
                  <Descriptions.Item label="身份核验">
                    {authData.has_identity
                      ? <Tag color="success" icon={<CheckCircleOutlined />}>已核验身份证</Tag>
                      : <Tag color="default" icon={<CloseCircleOutlined />}>未核验</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="顾客签名">
                    {authData.has_signature
                      ? <Tag color="success" icon={<CheckCircleOutlined />}>已签名</Tag>
                      : <Tag color="default" icon={<CloseCircleOutlined />}>无签名</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="完整授权条款">
                    {authData.has_full_content
                      ? <Tag color="success" icon={<CheckCircleOutlined />}>包含完整条款</Tag>
                      : <Tag color="default" icon={<CloseCircleOutlined />}>条款缺失</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="备注">{authData.notes || '-'}</Descriptions.Item>
                </Descriptions>
              </div>
            )}
          </div>
        </Col>
      </Row>

      <Modal
        title={authData ? '编辑授权档案' : '新建授权档案'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        width={640}
        okText="保存授权"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <div className="form-section-title">基础信息</div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="顾客姓名" name="customer_name" rules={[{ required: true, message: '请填写' }]}>
                <Input placeholder="真实姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="授权范围" name="auth_scope" rules={[{ required: true }]} initialValue="全院营销使用">
                <Select options={[
                  { label: '全院营销使用', value: '全院营销使用' },
                  { label: '仅公众号使用', value: '仅公众号使用' },
                  { label: '仅朋友圈使用', value: '仅朋友圈使用' },
                  { label: '仅院内展示', value: '仅院内展示' }
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="签署日期" name="signed_date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="到期日期" name="expire_date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <div className="form-section-title">合规核验项</div>
          <Form.Item name="has_identity" valuePropName="checked">
            <Checkbox>已核验顾客身份证明（身份证/护照）</Checkbox>
          </Form.Item>
          <Form.Item name="has_signature" valuePropName="checked">
            <Checkbox>授权书包含顾客手写签名或电子签名</Checkbox>
          </Form.Item>
          <Form.Item name="has_full_content" valuePropName="checked">
            <Checkbox>授权书包含完整使用范围、期限、撤销条款等内容</Checkbox>
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <Input.TextArea rows={3} placeholder="其他补充说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
