import React, { useState } from 'react'
import { Drawer, Tabs, Button, Empty, Badge } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useAlerts } from '@/hooks/useAlerts'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Bell, MapPin, CheckCheck, Trash2 } from 'lucide-react'
import type { AlertEntry } from '@/types/api'

interface NotificationCenterProps {
  open: boolean
  onClose: () => void
}

function AlertItem({ alert, onAck, onViewZone }: {
  alert: AlertEntry & { id?: string }
  onAck: () => void
  onViewZone: () => void
}) {
  const time = alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour12: false }) : '--:--'
  return (
    <div className="border-b border-[#272a33] p-4 hover:bg-[#272a33] transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge level={alert.risk_level || 'unknown'} size="sm" />
            <span className="font-sans font-semibold text-sm text-[#e1e2ee]">{alert.zone_name}</span>
          </div>
          <p className="font-sans text-xs text-[#8c90a1] line-clamp-2">
            {alert.message || alert.description || 'Risk detected in zone'}
          </p>
        </div>
        <span className="font-mono text-[10px] text-[#8c90a1] shrink-0">{time}</span>
      </div>
      <div className="flex gap-2">
        <Button size="small" onClick={onAck} className="text-[10px]" icon={<CheckCheck size={10} />}>
          Acknowledge
        </Button>
        <Button size="small" onClick={onViewZone} className="text-[10px]" icon={<MapPin size={10} />}>
          View Zone
        </Button>
      </div>
    </div>
  )
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ open, onClose }) => {
  const navigate = useNavigate()
  const { clearAllNotifications, acknowledgeNotification } = useAppStore()
  const { grouped, totalCount } = useAlerts()
  const [resolved, setResolved] = useState<AlertEntry[]>([])

  const handleAck = (alert: AlertEntry) => {
    setResolved((prev) => [alert, ...prev])
    acknowledgeNotification((alert as AlertEntry & { id?: string }).id || alert.zone_id)
  }

  const handleViewZone = (zoneId: string) => {
    useAppStore.getState().setCurrentZone(zoneId)
    navigate('/plant')
    onClose()
  }

  const items = [
    {
      key: 'critical',
      label: (
        <span className="flex items-center gap-1.5">
          Critical <Badge count={grouped.critical.length} color="#ef4444" size="small" />
        </span>
      ),
      children: grouped.critical.length ? (
        grouped.critical.map((a, i) => (
          <AlertItem key={i} alert={a} onAck={() => handleAck(a)} onViewZone={() => handleViewZone(a.zone_id)} />
        ))
      ) : <Empty description="No critical alerts" className="py-8" />,
    },
    {
      key: 'warning',
      label: (
        <span className="flex items-center gap-1.5">
          Warning <Badge count={grouped.warning.length} color="#f59e0b" size="small" />
        </span>
      ),
      children: grouped.warning.length ? (
        grouped.warning.map((a, i) => (
          <AlertItem key={i} alert={a} onAck={() => handleAck(a)} onViewZone={() => handleViewZone(a.zone_id)} />
        ))
      ) : <Empty description="No warnings" className="py-8" />,
    },
    {
      key: 'safe',
      label: 'Safe / Normal',
      children: grouped.safe.length ? (
        grouped.safe.map((a: import('@/types/api').AlertEntry, i: number) => (
          <AlertItem key={i} alert={a} onAck={() => handleAck(a)} onViewZone={() => handleViewZone(a.zone_id)} />
        ))
      ) : <Empty description="No safe alerts" className="py-8" />,
    },
    {
      key: 'resolved',
      label: `Resolved (${resolved.length})`,
      children: resolved.length ? (
        resolved.map((a, i) => (
          <div key={i} className="border-b border-[#272a33] p-3 opacity-50">
            <div className="flex items-center gap-2">
              <StatusBadge level={a.risk_level || 'unknown'} size="sm" />
              <span className="text-xs text-[#8c90a1]">{a.zone_name} — acknowledged</span>
            </div>
          </div>
        ))
      ) : <Empty description="No resolved alerts" className="py-8" />,
    },
  ]

  return (
    <Drawer
      title={
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-[#b3c5ff]" />
            <span className="text-[#e1e2ee] font-display font-semibold">Notifications</span>
            {totalCount > 0 && (
              <Badge count={totalCount} color="#0066ff" />
            )}
          </div>
          <Button
            size="small"
            type="text"
            icon={<Trash2 size={12} />}
            onClick={clearAllNotifications}
            className="text-[#8c90a1] hover:text-[#e1e2ee]"
          >
            Clear all
          </Button>
        </div>
      }
      open={open}
      onClose={onClose}
      width={420}
      placement="right"
      closable
      styles={{ body: { padding: 0 } }}
    >
      <Tabs
        items={items}
        tabBarStyle={{ margin: 0, paddingLeft: 16, borderBottom: '1px solid #424656' }}
        tabBarGutter={16}
      />
    </Drawer>
  )
}
