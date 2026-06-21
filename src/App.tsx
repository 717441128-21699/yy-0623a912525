import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import { Layout, Menu, Badge, Avatar } from 'antd'
import {
  InboxOutlined,
  FolderOpenOutlined,
  SafetyCertificateOutlined,
  BlockOutlined,
  RocketOutlined,
  AuditOutlined,
  UserOutlined
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import InboxPage from './pages/InboxPage'
import CaseManagePage from './pages/CaseManagePage'
import AuthPage from './pages/AuthPage'
import MosaicPage from './pages/MosaicPage'
import ExportPage from './pages/ExportPage'
import ReviewPage from './pages/ReviewPage'
import { statsApi } from './services/api'
import { Stats } from './types'

const { Header, Sider, Content } = Layout

function App() {
  const location = useLocation()
  const [stats, setStats] = useState<Stats>({
    total: 0, pending: 0, approved: 0, rejected: 0, forbidden: 0, assets: 0, expiring: 0
  })

  const loadStats = async () => {
    const s = await statsApi.get()
    setStats(s)
  }

  useEffect(() => {
    loadStats()
    const t = setInterval(loadStats, 15000)
    return () => clearInterval(t)
  }, [])

  const menuItems = [
    { key: '/inbox', icon: <InboxOutlined />, label: (
      <span className="menu-item-label">素材收件箱{stats.pending > 0 && <Badge count={stats.pending} size="small" style={{ marginLeft: 8 }} />}</span>
    )},
    { key: '/cases', icon: <FolderOpenOutlined />, label: <span className="menu-item-label">案例整理</span> },
    { key: '/auth', icon: <SafetyCertificateOutlined />, label: (
      <span className="menu-item-label">授权核验{stats.expiring > 0 && <Badge count={stats.expiring} size="small" style={{ marginLeft: 8 }} color="#f59e0b" />}</span>
    )},
    { key: '/mosaic', icon: <BlockOutlined />, label: <span className="menu-item-label">马赛克处理</span> },
    { key: '/export', icon: <RocketOutlined />, label: <span className="menu-item-label">发布包</span> },
    { key: '/review', icon: <AuditOutlined />, label: <span className="menu-item-label">审核记录</span> }
  ]

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider width={210} theme="dark">
        <div style={{ padding: '18px 20px', color: '#fff', fontSize: 16, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg,#3a7bd5,#1d4e89)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>医</div>
            <div>
              <div style={{ fontSize: 14, lineHeight: '16px' }}>合规归档系统</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Aesthetic Archive</div>
            </div>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems.map(item => ({
            ...item,
            label: <Link to={item.key}>{item.label}</Link>
          }))}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header className="app-header" style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px' }}>
          <div style={{ color: '#0f172a', fontSize: 16, fontWeight: 600 }}>
            {menuItems.find((m: any) => m.key === location.pathname)?.label?.props?.children?.[0] || '医美案例素材合规归档'}
          </div>
          <div className="header-right" style={{ color: '#334155' }}>
            <span style={{ fontSize: 13 }}>今日 {new Date().toLocaleDateString('zh-CN')}</span>
            <Avatar size={30} icon={<UserOutlined />} style={{ background: '#1d4e89' }} />
            <span style={{ fontSize: 13 }}>管理员</span>
          </div>
        </Header>
        <Content style={{ overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/inbox" replace />} />
            <Route path="/inbox" element={<InboxPage onDataChange={loadStats} />} />
            <Route path="/cases" element={<CaseManagePage onDataChange={loadStats} />} />
            <Route path="/auth" element={<AuthPage onDataChange={loadStats} />} />
            <Route path="/mosaic" element={<MosaicPage onDataChange={loadStats} />} />
            <Route path="/export" element={<ExportPage onDataChange={loadStats} />} />
            <Route path="/review" element={<ReviewPage onDataChange={loadStats} />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
