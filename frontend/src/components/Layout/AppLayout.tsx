import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import ActivityBar from './ActivityBar'
import Sidebar from './Sidebar'
import FloatingSettings from './FloatingSettings'
import { useThemeStore } from '@/stores/themeStore'

export default function AppLayout() {
  const { mode } = useThemeStore()
  const [settingsVisible, setSettingsVisible] = useState(true)

  // Apply theme class on mount
  useEffect(() => {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [mode])

  return (
    <ConfigProvider
      theme={{
        algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <>
        <div className="app-layout">
          {/* 最左侧图标菜单栏 */}
          <ActivityBar onSettingsClick={() => setSettingsVisible(true)} />

          {/* 文件浏览器侧边栏 */}
          <div className="sidebar-container">
            <Sidebar />
          </div>

          {/* 主内容区域 */}
          <div className="main-content">
            <Outlet />
          </div>
        </div>

        {/* 悬浮设置栏 - 放在 app-layout 外面避免 overflow:hidden 裁剪 */}
        <FloatingSettings
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
        />
      </>
    </ConfigProvider>
  )
}
