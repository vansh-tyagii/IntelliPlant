import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { ShapContributor } from '@/types/api'

interface ShapContributionChartProps {
  contributors: ShapContributor[]
  height?: number
}

export const ShapContributionChart: React.FC<ShapContributionChartProps> = ({ contributors, height = 280 }) => {
  const option = useMemo(() => {
    const sorted = [...contributors].sort((a, b) => Math.abs(b.shap_contribution) - Math.abs(a.shap_contribution)).slice(0, 8)
    const names = sorted.map((c) => c.feature)
    const values = sorted.map((c) => Number((c.normalized_percentage ?? Math.abs(c.shap_contribution) * 100).toFixed(1)))
    const colors = sorted.map((c) => c.shap_contribution >= 0 ? '#ef4444' : '#22c55e')

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#272a33',
        borderColor: '#424656',
        textStyle: { color: '#e1e2ee', fontFamily: 'JetBrains Mono', fontSize: 12 },
        formatter: (params: { name: string; value: number }[]) =>
          `<b>${params[0].name}</b><br/>Contribution: ${params[0].value.toFixed(1)}%`,
      },
      grid: { left: 140, right: 20, top: 10, bottom: 10, containLabel: false },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#8c90a1', fontFamily: 'JetBrains Mono', fontSize: 11, formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: '#272a33' } },
        axisLine: { lineStyle: { color: '#424656' } },
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: { color: '#c2c6d8', fontFamily: 'Inter', fontSize: 11 },
        axisLine: { lineStyle: { color: '#424656' } },
        axisTick: { show: false },
      },
      series: [{
        type: 'bar',
        data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i], borderRadius: [0, 2, 2, 0] } })),
        label: { show: true, position: 'right', color: '#8c90a1', fontFamily: 'JetBrains Mono', fontSize: 11, formatter: '{c}%' },
        barMaxWidth: 20,
      }],
    }
  }, [contributors])

  if (!contributors.length) return (
    <div className="flex items-center justify-center h-32 text-[#8c90a1] text-sm">No SHAP data available</div>
  )

  return <ReactECharts option={option} style={{ height }} opts={{ renderer: 'svg' }} />
}
