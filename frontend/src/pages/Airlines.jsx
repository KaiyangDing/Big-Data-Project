import { useEffect, useState } from 'react'
import { Row, Col, Card, Spin, Alert, Typography, Segmented, Tag, Divider } from 'antd'
import { TrophyOutlined, ClockCircleOutlined, WarningOutlined, FireOutlined, DotChartOutlined } from '@ant-design/icons'
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
  { label: 'Top 10', value: 'top' },
  { label: 'Bottom 10', value: 'bottom' },
  { label: 'All', value: 'all' },
]

function applyFilter(sorted, mode) {
  if (mode === 'top')    return sorted.slice(0, 10)
  if (mode === 'bottom') return sorted.slice(-10).reverse()  // worst first for visual impact
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
    grid: { left: 140, right: 80, top: 16, bottom: 40 },
    xAxis: {
      type: 'category',
      data: causes,
      axisTick: { alignWithLabel: true },
      axisLabel: { fontSize: 11, interval: 0, rotate: 15 },
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
      orient: 'vertical',
      right: 8,
      bottom: 40,
      itemHeight: 120,
      inRange: { color: ['#fff7e6', '#ff7a00', '#a8071a'] },
      text: ['High', 'Low'],
      textStyle: { fontSize: 10 },
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
  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [rankFilter, setRankFilter] = useState('top')
  const [selectedAirline, setSelectedAirline] = useState(null)

  useEffect(() => {
    getAnalysis('carriers')
      .then(d => {
        setData(d)
        setSelectedAirline(d.find(a => a.airline === 'UA') || null)
      })
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

  const totalMag = d => CAUSES.reduce((s, c) => s + (d[c.key] ?? 0), 0)
  const byMag    = [...data].sort((a, b) => totalMag(a) - totalMag(b))
  const bestDelay  = byMag[0]
  const worstDelay = byMag[byMag.length - 1]

  // quadrant boundaries (mirrors freqMagOption internals)
  const qPts   = data.map(d => ({ code: d.airline, freq: +(100 - d.on_time_rate_pct).toFixed(1), mag: +totalMag(d).toFixed(1) }))
  const avgFreq = +(qPts.reduce((s, p) => s + p.freq, 0) / qPts.length).toFixed(1)
  const avgMag  = +(qPts.reduce((s, p) => s + p.mag,  0) / qPts.length).toFixed(1)

  const getQuadrant = (airline) => {
    const pt = qPts.find(p => p.code === airline)
    if (!pt) return null
    const lo = pt.freq <= avgFreq, sm = pt.mag <= avgMag
    if (lo && sm)  return { label: 'Best',              color: 'green'  }
    if (!lo && !sm) return { label: 'Worst',             color: 'red'    }
    if (!lo && sm)  return { label: 'Frequent but Mild', color: 'orange' }
    return                  { label: 'Rare but Severe',  color: 'orange' }
  }

  const handleChartClick = (params) => {
    if (params.componentType !== 'series') return
    const airline = data.find(d => d.airline === params.data.code)
    setSelectedAirline(airline || null)
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 20, color: '#262626' }}>
        Airlines · 2019 – 2024
      </Title>

      {/* KPI strip — quadrant-oriented */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #52c41a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <TrophyOutlined style={{ fontSize: 28, color: '#52c41a' }} />
              <div>
                <div style={{ fontSize: 12, color: '#888' }}>Best On-Time Rate</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{name(best.airline)}</div>
                <div style={{ color: '#52c41a', fontWeight: 600, fontSize: 18 }}>
                  {best.on_time_rate_pct.toFixed(1)}%
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #ff4d4f' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <WarningOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />
              <div>
                <div style={{ fontSize: 12, color: '#888' }}>Worst On-Time Rate</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{name(worst.airline)}</div>
                <div style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 18 }}>
                  {worst.on_time_rate_pct.toFixed(1)}%
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #1677ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <ClockCircleOutlined style={{ fontSize: 28, color: '#1677ff' }} />
              <div>
                <div style={{ fontSize: 12, color: '#888' }}>Best Avg Delay (when late)</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{name(bestDelay.airline)}</div>
                <div style={{ color: '#1677ff', fontWeight: 600, fontSize: 18 }}>
                  {totalMag(bestDelay).toFixed(1)} min
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #fa8c16' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <FireOutlined style={{ fontSize: 28, color: '#fa8c16' }} />
              <div>
                <div style={{ fontSize: 12, color: '#888' }}>Worst Avg Delay (when late)</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{name(worstDelay.airline)}</div>
                <div style={{ color: '#fa8c16', fontWeight: 600, fontSize: 18 }}>
                  {totalMag(worstDelay).toFixed(1)} min
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Reliability Map — main chart */}
      <Card
        style={{ borderRadius: 8, marginBottom: 16 }}
        title={<span style={{ fontWeight: 600 }}>Reliability Map · Frequency vs Severity</span>}
        extra={
          <span style={{ color: '#888', fontSize: 12 }}>
            <span style={{ color: '#52c41a' }}>■</span> Best ·{' '}
            <span style={{ color: '#fa8c16' }}>■</span> One-dimensional ·{' '}
            <span style={{ color: '#ff4d4f' }}>■</span> Worst
          </span>
        }
      >
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
          {/* scatter chart */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ReactECharts
              option={freqMagOption(sorted)}
              style={{ height: 420 }}
              notMerge
              onEvents={{ click: handleChartClick }}
            />
          </div>

          {/* sidebar */}
          <div style={{ width: 252, marginLeft: 16, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            {!selectedAirline ? (
              <div style={{
                flex: 1, borderRadius: 12, border: '1px dashed #d9d9d9',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: '#bbb', gap: 10,
              }}>
                <DotChartOutlined style={{ fontSize: 36 }} />
                <div style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.6, color: '#ccc' }}>
                  Click a point to see details
                </div>
              </div>
            ) : (() => {
              const sel = selectedAirline
              const quad = getQuadrant(sel.airline)
              const recovery = (sel.avg_dep_delay_min - sel.avg_arr_delay_min).toFixed(1)
              const recoveryPos = +recovery >= 0
              const delayRate   = (100 - sel.on_time_rate_pct).toFixed(1)
              const onTimeColor = sel.on_time_rate_pct >= 85 ? '#52c41a' : sel.on_time_rate_pct >= 80 ? '#fa8c16' : '#ff4d4f'

              const headerGrad =
                quad?.color === 'green'  ? 'linear-gradient(135deg,#256a3e,#3a9a5c)' :
                quad?.color === 'red'    ? 'linear-gradient(135deg,#b83232,#d94f4f)' :
                                           'linear-gradient(135deg,#c97008,#e89420)'

              const metrics = [
                { label: 'On-Time Rate',  value: `${sel.on_time_rate_pct.toFixed(1)}%`, color: onTimeColor },
                { label: 'Delay Rate',    value: `${delayRate}%`,                        color: '#ff4d4f'   },
                { label: 'Dep Delay',     value: `${sel.avg_dep_delay_min.toFixed(1)} min` },
                { label: 'Arr Delay',     value: `${sel.avg_arr_delay_min.toFixed(1)} min` },
                { label: 'Recovery',      value: `${recoveryPos ? '+' : ''}${recovery} min`, color: recoveryPos ? '#52c41a' : '#ff4d4f' },
                { label: 'Total Flights', value: (sel.total_flights / 1e6).toFixed(2) + ' M' },
              ]

              return (
                <div style={{
                  flex: 1, borderRadius: 12, overflow: 'hidden',
                  border: '1px solid #e8e8e8',
                  display: 'flex', flexDirection: 'column',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}>
                  {/* dark header */}
                  <div style={{ background: headerGrad, padding: '18px 16px 16px' }}>
                    <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 5 }}>
                      Airline Profile
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.25, marginBottom: 10 }}>
                      {name(sel.airline)}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        background: 'rgba(255,255,255,0.18)', color: '#fff',
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      }}>
                        {sel.airline}
                      </span>
                      {quad && (
                        <span style={{
                          background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)',
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          border: '1px solid rgba(255,255,255,0.25)',
                        }}>
                          {quad.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* white body */}
                  <div style={{ flex: 1, background: '#fff', padding: '14px 14px 12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {metrics.map(m => (
                        <div key={m.label} style={{
                          background: '#fafafa', borderRadius: 8,
                          padding: '9px 10px', border: '1px solid #f0f0f0',
                        }}>
                          <div style={{ fontSize: 9, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                            {m.label}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: m.color || '#262626', lineHeight: 1 }}>
                            {m.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 12, padding: '9px 10px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>About Recovery</div>
                      <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.6 }}>
                        Dep delay − Arr delay.<br />Positive = time made up in flight.
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </Card>

      {/* On-Time Ranking + Cause Breakdown */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            style={{ borderRadius: 8 }}
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
        </Col>
        <Col xs={24} xl={10}>
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
