import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { HeatmapCell } from '@/types/api'

interface ZoneRiskRadarProps {
  cells: HeatmapCell[]
  height?: number
}

export const ZoneRiskRadar: React.FC<ZoneRiskRadarProps> = ({ cells, height = 300 }) => {
  const option = useMemo(() => {
    const indicators = cells.map((c) => ({ name: c.zone_name.replace(' ', '\n'), max: 100 }))
    const values = cells.map((c) => c.risk_score)

    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: '#272a33',
        borderColor: '#424656',
        textStyle: { color: '#e1e2ee', fontFamily: 'JetBrains Mono', fontSize: 12 },
      },
      radar: {
        indicator: indicators,
        axisName: { color: '#c2c6d8', fontFamily: 'Inter', fontSize: 10 },
        splitLine: { lineStyle: { color: '#272a33' } },
        splitArea: { areaStyle: { color: ['rgba(29,31,40,0.3)', 'rgba(29,31,40,0.1)'] } },
        axisLine: { lineStyle: { color: '#424656' } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: values,
          name: 'Zone Risk',
          areaStyle: { color: 'rgba(0,102,255,0.15)' },
          lineStyle: { color: '#0066ff', width: 2 },
          itemStyle: { color: '#0066ff' },
          symbol: 'circle',
          symbolSize: 5,
        }],
        emphasis: { lineStyle: { width: 3 } },
      }],
    }
  }, [cells])

  return <ReactECharts option={option} style={{ height }} opts={{ renderer: 'svg' }} />
}
