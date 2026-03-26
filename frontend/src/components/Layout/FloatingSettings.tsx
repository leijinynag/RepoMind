import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useThemeStore } from '@/stores/themeStore'
import { useChatStore } from '@/stores/chatStore'

interface FloatingSettingsProps {
  visible: boolean
  onClose: () => void
}

export default function FloatingSettings({ visible, onClose }: FloatingSettingsProps) {
  const { mode, toggleMode } = useThemeStore()
  const { displaySteps, clearDisplaySteps } = useChatStore()
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [initialized, setInitialized] = useState(false)
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const offset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (visible && !initialized) {
      setPos({
        x: Math.round((window.innerWidth - 240) / 2),
        y: 60,
      })
      setInitialized(true)
    }
  }, [visible, initialized])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 240, e.clientX - offset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 120, e.clientY - offset.current.y)),
      })
    }
    const onUp = () => setDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  if (!visible) return null

  const isDark = mode === 'dark'
  const panelBg = isDark ? '#2d2d2d' : '#ffffff'
  const headerBg = isDark ? '#353535' : '#f0f0f0'
  const textColor = isDark ? '#cccccc' : '#333333'
  const borderColor = isDark ? '#444444' : '#e0e0e0'

  const el = (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        zIndex: 99999,
        left: pos.x,
        top: pos.y,
        width: 240,
        borderRadius: 8,
        background: panelBg,
        border: `1px solid ${borderColor}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Drag header */}
      <div
        onMouseDown={onMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: headerBg,
          borderBottom: `1px solid ${borderColor}`,
          borderRadius: '8px 8px 0 0',
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: textColor }}>⚙ 设置</span>
        <span
          onClick={onClose}
          style={{ cursor: 'pointer', fontSize: 14, color: textColor, lineHeight: 1 }}
        >
          ✕
        </span>
      </div>

      {/* Theme toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
        }}
      >
        <span style={{ fontSize: 13, color: textColor }}>
          {isDark ? '🌙 深色模式' : '☀️ 浅色模式'}
        </span>
        <div
          onClick={toggleMode}
          style={{
            width: 40,
            height: 22,
            borderRadius: 11,
            background: isDark ? '#1677ff' : '#ccc',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#fff',
              position: 'absolute',
              top: 2,
              left: isDark ? 20 : 2,
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      </div>

      {/* Clear Agent Graph */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderTop: `1px solid ${borderColor}`,
        }}
      >
        <span style={{ fontSize: 13, color: textColor }}>
          🗑️ 清除思考图
        </span>
        <button
          onClick={clearDisplaySteps}
          disabled={displaySteps.length === 0}
          style={{
            padding: '4px 12px',
            fontSize: 12,
            borderRadius: 4,
            border: 'none',
            background: displaySteps.length > 0 ? '#ef4444' : (isDark ? '#444' : '#ddd'),
            color: displaySteps.length > 0 ? '#fff' : (isDark ? '#666' : '#999'),
            cursor: displaySteps.length > 0 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          清除 ({displaySteps.length})
        </button>
      </div>
    </div>
  )

  return createPortal(el, document.body)
}
