import { useEffect, useState } from 'react'
import { Row, Col, Card, Spin, Alert, Typography, Segmented } from 'antd'
import { TrophyOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { getAnalysis } from '../services/api'

const { Title } = Typography

const AIRLINE_NAMES = {
  '9E': 'Endeavor Air',  QX: 'Horizon Air',     DL: 'Delta Air Lines',
  YX: 'Republic Airways', HA: 'Hawaiian Airlines', OO: 'SkyWest Airlines',
  OH: 'PSA Airlines',    MQ: 'Envoy Air',        AS: 'Alaska Airlines',
  YV: 'Mesa Air',        UA: 'United Airlines',   WN: 'Southwest Airlines',
  AA: 'American Airlines', EV: 'ExpressJet',      NK: 'Spirit Airlines',
  G4: 'Allegiant Air',   F9: 'Frontier Airlines', B6: 'JetBlue Airways',
}

const name = (code) => AIRLINE_NAMES[code] || code

// ── chart builders ───────────────────────────────────────────────────────────

function onTimeRankingOption(visible, avgRate) {
  const labels = visible.map(d => name(d.airline))
  const values = visible.map(d => +d.on_time_rate_pct.toFixed(1))

  return {
    tooltip: {
      trigger: 'axis',
      formatter: p => `${p[0].name}<br/>On-Time Rate: <b>${p[0].value}%</b>`,
    },
    grid: { left: 140, right: 70, top: 12, bottom: 24 },
    xAxis: {
      type: 'value', min: 70, max: 92,
      axisLabel: { formatter: v => `${v}%` },
    },
    yAxis: {
      type: 'category', data: labels, inverse: true,
      axisLabel: { fontSize: 12, width: 130, overflow: 'truncate' },
    },
    series: [{
      type: 'bar',
      data: values.map(v => ({
        value: v,
        itemStyle: {
          color: v >= 85 ? '#52c41a' : v >= 80 ? '#fa8c16' : '#ff4d4f',
          borderRadius: [0, 4, 4, 0],
        },
      })),
      label: { show: true, position: 'right', formatter: p => `${p.value}%`, fontSize: 11 },
      barMaxWidth: 22,
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: '#1677ff', type: 'dashed', width: 1.5 },
        label: {
          position: 'insideEndTop',
          formatter: `Avg ${avgRate}%`,
          color: '#1677ff',
          fontSize: 11,
        },
        data: [{ xAxis: +avgRate }],
      },
    }],
  }
}

const RANK_OPTIONS = [
  { label: 'Top 8', value: 'top' },
  { label: 'Bottom 8', value: 'bottom' },
  { label: 'All', value: 'all' },
]

function applyFilter(sorted, mode) {
  if (mode === 'top')    return sorted.slice(0, 8)
  if (mode === 'bottom') return sorted.slice(-8).reverse()  // worst first for visual impact
  return sorted
}

function freqMagOption(data) {
  const pts = data.map(d => {
    const mag = CAUSES.reduce((s, c) => s + (d[c.key] ?? 0), 0)
    return { code: d.airline, freq: +(100 - d.on_time_rate_pct).toFixed(1), mag: +mag.toFixed(1) }
  })

  const avgFreq = +(pts.reduce((s, p) => s + p.freq, 0) / pts.length).toFixed(1)
  const avgMag  = +(pts.reduce((s, p) => s + p.mag,  0) / pts.length).toFixed(1)
  const xMin = Math.floor(Math.min(...pts.map(p => p.freq))) - 1
  const xMax = Math.ceil( Math.max(...pts.map(p => p.freq))) + 1
  const yMin = Math.floor(Math.min(...pts.map(p => p.mag)))  - 5
  const yMax = Math.ceil( Math.max(...pts.map(p => p.mag)))  + 5

  const Q = [
    { x1: xMin,    y1: avgMag, x2: avgFreq, y2: yMax,   color: 'rgba(250,140,22,0.07)', label: 'Rare but Severe',  lpos: 'insideTopLeft'     },
    { x1: avgFreq, y1: avgMag, x2: xMax,    y2: yMax,   color: 'rgba(255,77,79,0.07)',  label: 'Worst',            lpos: 'insideTopRight'    },
    { x1: xMin,    y1: yMin,   x2: avgFreq, y2: avgMag, color: 'rgba(82,196,26,0.07)',  label: 'Best',             lpos: 'insideBottomLeft'  },
    { x1: avgFreq, y1: yMin,   x2: xMax,    y2: avgMag, color: 'rgba(250,140,22,0.05)', label: 'Frequent but Mild',lpos: 'insideBottomRight' },
  ]

  return {
    tooltip: {
      trigger: 'item',
      formatter: p => {
        const d = p.data
        return `<b>${name(d.code)}</b> (${d.code})<br/>` +
          `Delay Rate: <b>${d.freq}%</b><br/>` +
          `Avg Delay When Late: <b>${d.mag} min</b>`
      },
    },
    grid: { left: 60, right: 24, top: 24, bottom: 52 },
    xAxis: {
      type: 'value', min: xMin, max: xMax,
      name: 'Delay Rate (%)   →   more frequent',
      nameLocation: 'middle', nameGap: 32,
      axisLabel: { formatter: v => `${v}%` },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value', min: yMin, max: yMax,
      name: 'Avg Delay When Late (min)   ↑   more severe',
      nameLocation: 'middle', nameGap: 52,
      splitLine: { show: false },
    },
    series: [{
      type: 'scatter',
      symbolSize: 13,
      data: pts.map(p => ({
        ...p,
        value: [p.freq, p.mag],
        itemStyle: {
          color: p.freq <= avgFreq && p.mag <= avgMag ? '#52c41a'
               : p.freq >  avgFreq && p.mag >  avgMag ? '#ff4d4f'
               : '#fa8c16',
        },
      })),
      label: { show: true, formatter: p => p.data.code, position: 'top', fontSize: 10, color: '#555' },
      labelLayout: { hideOverlap: true },
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: '#ccc', type: 'dashed', width: 1 },
        data: [
          { yAxis: avgMag,  label: { formatter: `Avg ${avgMag} min`, position: 'insideEndTop',   color: '#aaa', fontSize: 10 } },
          { xAxis: avgFreq, label: { formatter: `Avg ${avgFreq}%`, position: 'insideStartTop', color: '#aaa', fontSize: 10 } },
        ],
      },
      markArea: {
        silent: true,
        data: Q.map(q => [
          { coord: [q.x1, q.y1], itemStyle: { color: q.color }, label: { show: true, position: q.lpos, formatter: q.label, fontSize: 10, color: '#666' } },
          { coord: [q.x2, q.y2] },
        ]),
      },
    }],
  }
}

const CAUSES = [
  { name: 'Carrier',      key: 'avg_carrier_delay',      color: '#ff4d4f' },
  { name: 'Late Aircraft', key: 'avg_late_aircraft_delay', color: '#fa8c16' },
  { name: 'NAS',          key: 'avg_nas_delay',           color: '#1677ff' },
  { name: 'Weather',      key: 'avg_weather_delay',       color: '#722ed1' },
  { name: 'Security',     key: 'avg_security_delay',      color: '#13c2c2' },
]

function delayCauseOption(sorted) {
  const byTotal = [...sorted].sort((a, b) => {
    const total = d => CAUSES.reduce((s, c) => s + (d[c.key] ?? 0), 0)
    return total(b) - total(a)
  })

  const airlines = byTotal.map(d => name(d.airline))
  const causes   = CAUSES.map(c => c.name)

  const cells = []
  byTotal.forEach((d, ai) => {
    CAUSES.forEach((c, ci) => {
      cells.push([ci, ai, +(d[c.key] ?? 0).toFixed(1)])
    })
  })

  const maxVal = Math.max(...cells.map(c => c[2]))

  return {
    tooltip: {
      formatter: p => {
        const [ci, ai, v] = p.data
        return `<b>${airlines[ai]}</b><br/>${causes[ci]}: <b>${v} min</b>`
      },
    },
    grid: { left: 140, right: 100, top: 16, bottom: 60 },
    xAxis: {
      type: 'category',
      data: causes,
      axisTick: { alignWithLabel: true },
      axisLabel: { fontSize: 12 },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: airlines,
      axisLabel: { fontSize: 11, width: 130, overflow: 'truncate' },
      splitArea: { show: true },
    },
    visualMap: {
      min: 0, max: maxVal,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: ['#fff7e6', '#ff7a00', '#a8071a'] },
      text: ['High', 'Low'],
      textStyle: { fontSize: 11 },
    },
    series: [{
      type: 'heatmap',
      data: cells,
      label: { show: true, fontSize: 10, formatter: p => p.data[2] > 0 ? p.data[2] : '' },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.3)' } },
    }],
  }
}

// ── component ────────────────────────────────────────────────────────────────

export default function Airlines() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [rankFilter, setRankFilter] = useState('top')

  useEffect(() => {
    getAnalysis('carriers')
      .then(setData)
      .catch(() => setError('Failed to load carriers data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" showIcon message={error || 'No data available'} />
      </div>
    )
  }

  const sorted   = [...data].sort((a, b) => b.on_time_rate_pct - a.on_time_rate_pct)
  const best     = sorted[0]
  const worst    = sorted[sorted.length - 1]
  const avgRate  = (data.reduce((s, d) => s + d.on_time_rate_pct, 0) / data.length).toFixed(1)
  const visible  = applyFilter(sorted, rankFilter)

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 20, color: '#262626' }}>
        Airlines · 2019 – 2024
      </Title>

      {/* KPI strip */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #52c41a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <TrophyOutlined style={{ fontSize: 28, color: '#52c41a' }} />
              <div>
                <div style={{ fontSize: 12, color: '#888' }}>Best On-Time</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{name(best.airline)}</div>
                <div style={{ color: '#52c41a', fontWeight: 600, fontSize: 18 }}>
                  {best.on_time_rate_pct.toFixed(1)}%
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #1677ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <ClockCircleOutlined style={{ fontSize: 28, color: '#1677ff' }} />
              <div>
                <div style={{ fontSize: 12, color: '#888' }}>Industry Avg On-Time Rate</div>
                <div style={{ fontWeight: 700, fontSize: 28, color: '#1677ff', lineHeight: 1.2 }}>
                  {avgRate}%
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #ff4d4f' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <WarningOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />
              <div>
                <div style={{ fontSize: 12, color: '#888' }}>Most Delayed</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{name(worst.airline)}</div>
                <div style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 18 }}>
                  {worst.on_time_rate_pct.toFixed(1)}%
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* On-Time Rate Ranking */}
      <Card
        style={{ borderRadius: 8, marginBottom: 16 }}
        title={<span style={{ fontWeight: 600 }}>On-Time Rate Ranking</span>}
        extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: '#888', fontSize: 12 }}>
              <span style={{ color: '#52c41a' }}>■</span> ≥85% ·{' '}
              <span style={{ color: '#fa8c16' }}>■</span> ≥80% ·{' '}
              <span style={{ color: '#ff4d4f' }}>■</span> &lt;80%
            </span>
            <Segmented
              size="small"
              options={RANK_OPTIONS}
              value={rankFilter}
              onChange={setRankFilter}
            />
          </div>
        }
      >
        <ReactECharts
          option={onTimeRankingOption(visible, avgRate)}
          style={{ height: visible.length * 36 + 48 }}
          notMerge
        />
      </Card>

      {/* Avg Delay + Cause Breakdown */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card
            style={{ borderRadius: 8 }}
            title={<span style={{ fontWeight: 600 }}>Reliability Map · Frequency vs Severity</span>}
            extra={
              <span style={{ color: '#888', fontSize: 12 }}>
                <span style={{ color: '#52c41a' }}>■</span> Best ·{' '}
                <span style={{ color: '#fa8c16' }}>■</span> One-dimensional ·{' '}
                <span style={{ color: '#ff4d4f' }}>■</span> Worst
              </span>
            }
          >
            <ReactECharts option={freqMagOption(sorted)} style={{ height: 300 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card
            style={{ borderRadius: 8 }}
            title={<span style={{ fontWeight: 600 }}>Delay Cause Breakdown</span>}
            extra={<span style={{ color: '#888', fontSize: 12 }}>avg min · sorted by total delay ↓</span>}
          >
            <ReactECharts option={delayCauseOption(sorted)} style={{ height: 460 }} notMerge />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
