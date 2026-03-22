import { Outlet } from 'react-router-dom'
import { Layout, ConfigProvider, theme } from 'antd'
import Sidebar from './Sidebar'

const { Content } = Layout

export default function AppLayout() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          borderRadius: 8,
        },
      }}
    >
      <Layout className="h-screen">
        {/* 左侧边栏 */}
        <Layout.Sider
          width={280}
          className="!bg-slate-900"
          style={{ 
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
          }}
        >
          <Sidebar />
        </Layout.Sider>

        {/* 主内容区域 */}
        <Layout style={{ marginLeft: 280 }}>
          <Content className="h-screen overflow-hidden">
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}
