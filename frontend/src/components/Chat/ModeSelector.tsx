import { Segmented, Tooltip } from 'antd';
import { ThunderboltOutlined, MessageOutlined } from '@ant-design/icons';

export type ChatMode = 'normal' | 'enhanced';

interface ModeSelectorProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ mode, onChange, disabled }: ModeSelectorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Segmented
        value={mode}
        onChange={(value) => onChange(value as ChatMode)}
        disabled={disabled}
        options={[
          {
            value: 'normal',
            label: (
              <Tooltip title="直接对话，适合简单问题">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MessageOutlined />
                  <span>普通模式</span>
                </div>
              </Tooltip>
            ),
          },
          {
            value: 'enhanced',
            label: (
              <Tooltip title="先分析项目再回答，适合复杂问题">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ThunderboltOutlined />
                  <span>增强模式</span>
                </div>
              </Tooltip>
            ),
          },
        ]}
      />
      {mode === 'enhanced' && (
        <Tooltip title="增强模式会先运行分析工作流，然后基于分析结果回答问题，适合理解架构、追踪链路等复杂场景">
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              cursor: 'pointer'
            }}
          >
            工作流分析
          </span>
        </Tooltip>
      )}
    </div>
  );
}
