import { useNavigate, useLocation } from 'react-router-dom'
import { Tooltip } from 'antd'
import {
  HomeOutlined,
  CodeOutlined,
  SearchOutlined,
  SettingOutlined,
  GithubOutlined,
} from '@ant-design/icons'

interface ActivityItem {
  key: string
  icon: React.ReactNode
  label: string
  path?: string
  onClick?: () => void
}

interface ActivityBarProps {
  onSettingsClick?: () => void
}

export default function ActivityBar({ onSettingsClick }: ActivityBarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const topItems: ActivityItem[] = [
    { key: 'home', icon: <HomeOutlined />, label: '首页', path: '/' },
    { key: 'code', icon: <CodeOutlined />, label: '代码分析', path: '/code' },
    { key: 'search', icon: <SearchOutlined />, label: '搜索', path: '/search' },
  ]

  const bottomItems: ActivityItem[] = [
    { key: 'settings', icon: <SettingOutlined />, label: '设置', onClick: onSettingsClick },
  ]

  const isActive = (path?: string) => {
    if (!path) return false
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const renderItem = (item: ActivityItem) => (
    <Tooltip key={item.key} title={item.label} placement="right">
      <button
        className={`activity-bar-item ${isActive(item.path) ? 'active' : ''}`}
        onClick={() => {
          if (item.onClick) item.onClick()
          else if (item.path) navigate(item.path)
        }}
      >
        <span className="text-lg">{item.icon}</span>
      </button>
    </Tooltip>
  )

  return (
    <div className="activity-bar">
      {/* Logo */}
      <div className="activity-bar-logo">
        <GithubOutlined className="text-xl" />
      </div>

      {/* Top menu items */}
      <div className="activity-bar-top">
        {topItems.map(renderItem)}
      </div>

      {/* Bottom menu items */}
      <div className="activity-bar-bottom">
        {bottomItems.map(renderItem)}
      </div>
    </div>
  )
}
