import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Spin, Alert, Typography } from 'antd'
import {
  RocketOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { getAnalysis } from '../services/api'

const { Title } = Typography

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
// PySpark dayofweek: 1=Sun, 2=Mon, ..., 7=Sat
const DOW_LABELS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── chart builders ──────────────────────────────────────────────────────────

function monthlyOption(byMonth) {
  const labels  = byMonth.map(d => MONTH_LABELS[d.Month - 1])
  const delays  = byMonth.map(d => +d.avg_arr_delay_min.toFixed(2))
  const onTime  = byMonth.map(d => +d.on_time_rate_pct.toFixed(1))

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Avg Arrival Delay (min)', 'On-Time Rate (%)'], top: 4 },
    grid: { left: 56, right: 64, bottom: 36, top: 40 },
    xAxis: { type: 'category', data: labels },
    yAxis: [
      { type: 'value', name: 'Delay (min)', nameTextStyle: { color: '#fa8c16' },
        axisLine: { show: true, lineStyle: { color: '#fa8c16' } },
        axisLabel: { color: '#fa8c16' } },
      { type: 'value', name: 'On-Time %', min: 70, max: 95, splitLine: { show: false },
        nameTextStyle: { color: '#1677ff' },
        axisLine: { show: true, lineStyle: { color: '#1677ff' } },
        axisLabel: { color: '#1677ff' } },
    ],
    series: [
      {
        name: 'Avg Arrival Delay (min)',
        type: 'bar',
        data: delays,
        itemStyle: {
          color: (p) => {
            const v = p.data
            if (v >= 8)  return '#ff4d4f'
            if (v >= 4)  return '#fa8c16'
            return '#52c41a'
          },
        },
        label: { show: true, position: 'top', fontSize: 11,
          formatter: p => p.data > 0 ? p.data : '' },
      },
      {
        name: 'On-Time Rate (%)',
        type: 'line',
        yAxisIndex: 1,
        data: onTime,
        smooth: true,
        lineStyle: { color: '#1677ff', width: 2 },
        itemStyle: { color: '#1677ff' },
        symbol: 'circle', symbolSize: 6,
      },
    ],
  }
}

function weekdayOption(byWeekday) {
  // sort by DayOfWeek 1-7, map to Sun-Sat labels
  const sorted = [...byWeekday].sort((a, b) => a.DayOfWeek - b.DayOfWeek)
  const labels = sorted.map(d => DOW_LABELS[d.DayOfWeek - 1])
  const delays = sorted.map(d => +d.avg_arr_delay_min.toFixed(2))
  const onTime = sorted.map(d => +d.on_time_rate_pct.toFixed(1))

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Avg Delay (min)', 'On-Time Rate (%)'], top: 4 },
    grid: { left: 56, right: 64, bottom: 30, top: 40 },
    xAxis: { type: 'category', data: labels },
    yAxis: [
      { type: 'value', name: 'Delay (min)', nameTextStyle: { color: '#fa8c16' },
        axisLine: { show: true, lineStyle: { color: '#fa8c16' } },
        axisLabel: { color: '#fa8c16' } },
      { type: 'value', name: 'On-Time %', min: 78, max: 87, splitLine: { show: false },
        nameTextStyle: { color: '#1677ff' },
        axisLine: { show: true, lineStyle: { color: '#1677ff' } },
        axisLabel: { color: '#1677ff' } },
    ],
    series: [
      {
        name: 'Avg Delay (min)',
        type: 'bar',
        data: delays,
        itemStyle: { color: '#fa8c16', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'On-Time Rate (%)',
        type: 'line',
        yAxisIndex: 1,
        data: onTime,
        smooth: true,
        lineStyle: { color: '#1677ff', width: 2 },
        itemStyle: { color: '#1677ff' },
        symbol: 'circle', symbolSize: 6,
      },
    ],
  }
}

function hourlyOption(byHour) {
  // exclude hour 24 (only 1 flight, outlier)
  const filtered = byHour.filter(d => d.dep_hour < 24)
  const labels   = filtered.map(d => `${String(d.dep_hour).padStart(2,'0')}:00`)
  const depDelay = filtered.map(d => +d.avg_dep_delay_min.toFixed(1))
  const arrDelay = filtered.map(d => +d.avg_arr_delay_min.toFixed(1))

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Avg Dep Delay (min)', 'Avg Arr Delay (min)'], top: 4 },
    grid: { left: 56, right: 24, bottom: 36, top: 40 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { rotate: 45, interval: 1, fontSize: 10 },
    },
    yAxis: { type: 'value', name: 'Delay (min)' },
    series: [
      {
        name: 'Avg Dep Delay (min)',
        type: 'line', data: depDelay, smooth: true,
        lineStyle: { color: '#fa8c16', width: 2 },
        itemStyle: { color: '#fa8c16' },
        areaStyle: { color: 'rgba(250,140,22,0.12)' },
      },
      {
        name: 'Avg Arr Delay (min)',
        type: 'line', data: arrDelay, smooth: true,
        lineStyle: { color: '#ff4d4f', width: 2 },
        itemStyle: { color: '#ff4d4f' },
        areaStyle: { color: 'rgba(255,77,79,0.08)' },
      },
    ],
  }
}

// ── KPI config ───────────────────────────────────────────────────────────────

const KPI_CONFIG = [
  { key: 'total_flights',    title: 'Total Flights',        icon: <RocketOutlined />,      color: '#1677ff', bg: '#e6f4ff',
    fmt: v => ({ value: (v / 1_000_000).toFixed(2), suffix: 'M' }) },
  { key: 'avg_dep_delay_min', title: 'Avg Departure Delay', icon: <ClockCircleOutlined />, color: '#fa8c16', bg: '#fff7e6',
    fmt: v => ({ value: v, suffix: ' min', precision: 2 }) },
  { key: 'avg_arr_delay_min', title: 'Avg Arrival Delay',   icon: <ClockCircleOutlined />, color: '#722ed1', bg: '#f9f0ff',
    fmt: v => ({ value: v, suffix: ' min', precision: 2 }) },
  { key: 'on_time_rate_pct', title: 'On-Time Rate',         icon: <CheckCircleOutlined />, color: '#52c41a', bg: '#f6ffed',
    fmt: v => ({ value: v, suffix: '%', precision: 2 }) },
  { key: 'cancellation_rate_pct', title: 'Cancellation Rate', icon: <CloseCircleOutlined />, color: '#ff4d4f', bg: '#fff1f0',
    fmt: v => ({ value: v, suffix: '%', precision: 2 }) },
]

// ── component ────────────────────────────────────────────────────────────────

export default function Overview() {
  const [summary,  setSummary]  = useState(null)
  const [temporal, setTemporal] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    Promise.allSettled([
      getAnalysis('overview'),
      getAnalysis('temporal'),
    ]).then(([ovRes, tmpRes]) => {
      if (ovRes.status  === 'fulfilled') setSummary(ovRes.value)
      else setError('Overview data unavailable')

      if (tmpRes.status === 'fulfilled') setTemporal(tmpRes.value)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 20 }} />
      )}

      {/* Title row with Total Flights on the right */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#262626' }}>
          Flight Overview · 2019 – 2024
        </Title>
        {summary && (() => {
          const cfg = KPI_CONFIG.find(k => k.key === 'total_flights')
          const { value, suffix } = cfg.fmt(summary.total_flights)
          return (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RocketOutlined style={{ color: '#1677ff', fontSize: 16 }} />
              <span style={{ color: '#888', fontSize: 13 }}>Total Flights</span>
              <span style={{ color: '#1677ff', fontWeight: 600, fontSize: 20 }}>{value}{suffix}</span>
            </span>
          )
        })()}
      </div>

      {/* KPI Cards (4 metrics, Total Flights shown in title row) */}
      <div style={{ display: 'flex', gap: 16 }}>
        {KPI_CONFIG.filter(c => c.key !== 'total_flights').map(({ key, title, icon, color, bg, fmt }) => {
          const raw = summary?.[key] ?? 0
          const { value, suffix, precision } = fmt(raw)
          return (
            <Card key={key} style={{ borderRadius: 8, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 10, background: bg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, color,
                }}>
                  {icon}
                </div>
                <Statistic
                  title={<span style={{ fontSize: 13, color: '#888' }}>{title}</span>}
                  value={value}
                  suffix={suffix}
                  precision={precision}
                  valueStyle={{ color, fontSize: 26, fontWeight: 600 }}
                />
              </div>
            </Card>
          )
        })}
      </div>

      {temporal && <>
        {/* Monthly Pattern */}
        <Card
          style={{ marginTop: 20, borderRadius: 8 }}
          title={<span style={{ fontWeight: 600 }}>Delay by Month of Year</span>}
          extra={<span style={{ color: '#888', fontSize: 12 }}>2019 – 2024 aggregate</span>}
        >
          <ReactECharts option={monthlyOption(temporal.by_month)} style={{ height: 320 }} notMerge />
        </Card>

        {/* Weekday + Hourly side by side */}
        <Row gutter={[16, 0]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={10}>
            <Card
              style={{ borderRadius: 8 }}
              title={<span style={{ fontWeight: 600 }}>Delay by Day of Week</span>}
            >
              <ReactECharts option={weekdayOption(temporal.by_weekday)} style={{ height: 280 }} notMerge />
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card
              style={{ borderRadius: 8 }}
              title={<span style={{ fontWeight: 600 }}>Delay by Departure Hour</span>}
              extra={<span style={{ color: '#888', fontSize: 12 }}>early flights arrive early; delays accumulate through the day</span>}
            >
              <ReactECharts option={hourlyOption(temporal.by_hour)} style={{ height: 280 }} notMerge />
            </Card>
          </Col>
        </Row>
      </>}
    </div>
  )
}
