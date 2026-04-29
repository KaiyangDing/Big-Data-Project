import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  BankOutlined,
  EnvironmentOutlined,
  NodeIndexOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import Overview from './pages/Overview'
import Airlines from './pages/Airlines'
import Airports from './pages/Airports'
import RoutesPage from './pages/Routes'
import Predict from './pages/Predict'

const { Sider, Header, Content } = Layout

const NAV = [
  { key: '/',         label: 'Overview', icon: <DashboardOutlined /> },
  { key: '/airlines', label: 'Airlines', icon: <BankOutlined /> },
  { key: '/airports', label: 'Airports', icon: <EnvironmentOutlined /> },
  { key: '/routes',   label: 'Routes',   icon: <NodeIndexOutlined /> },
  { key: '/predict',  label: 'Predict',  icon: <ThunderboltOutlined /> },
]

function AppLayout() {
  const { pathname } = useLocation()
  const selected = NAV.find(n => n.key === pathname)?.key ?? '/'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} theme="dark">
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, padding: '20px 16px 12px' }}>
          ✈ SkyPath
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={NAV.map(({ key, label, icon }) => ({
            key,
            icon,
            label: <NavLink to={key}>{label}</NavLink>,
          }))}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: '#1677ff' }}>
            SkyPath Analytics — Flight Delay Analysis &amp; Prediction
          </span>
        </Header>
        <Content style={{ margin: 24, background: '#fff', borderRadius: 8, minHeight: 360 }}>
          <Routes>
            <Route path="/"         element={<Overview />} />
            <Route path="/airlines" element={<Airlines />} />
            <Route path="/airports" element={<Airports />} />
            <Route path="/routes"   element={<RoutesPage />} />
            <Route path="/predict"  element={<Predict />} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
