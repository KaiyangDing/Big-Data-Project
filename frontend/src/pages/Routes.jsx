import { useEffect, useState, useMemo } from 'react'
import { Row, Col, Card, Spin, Alert, Typography, Input, Button, Space, Table, AutoComplete } from 'antd'
import {
  NodeIndexOutlined,
  SearchOutlined,
  SwapOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  CompassOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { getAnalysis } from '../services/api'

const { Title } = Typography

const delayColor = (v) => {
  if (v >= 15) return '#ff4d4f'
  if (v >= 8)  return '#fa8c16'
  if (v >= 3)  return '#fadb14'
  return '#52c41a'
}

const onTimeColor = (v) => {
  if (v >= 85) return '#52c41a'
  if (v >= 80) return '#fa8c16'
  return '#ff4d4f'
}

// ── chart builders ────────────────────────────────────────────────────────────

function compareOption(fwd, rev) {
  const metrics = ['Avg Arr Delay', 'Avg Dep Delay']
  const fwdVals = [+fwd.avg_arr_delay_min.toFixed(1), +fwd.avg_dep_delay_min.toFixed(1)]
  const revVals = rev
    ? [+rev.avg_arr_delay_min.toFixed(1), +rev.avg_dep_delay_min.toFixed(1)]
    : null

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (ps) => {
        const lines = [`<b>${ps[0].axisValue}</b>`]
        ps.forEach(p => lines.push(`${p.marker} ${p.seriesName}: <b>${p.value} min</b>`))
        return lines.join('<br/>')
      },
    },
    legend: { bottom: 0 },
    grid: { left: 48, right: 20, top: 16, bottom: 40 },
    xAxis: {
      type: 'category',
      data: metrics,
      axisLabel: { fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      name: 'min',
      nameTextStyle: { fontSize: 10 },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    series: [
      {
        name: fwd.route,
        type: 'bar',
        barMaxWidth: 52,
        data: fwdVals.map(v => ({
          value: v,
          itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
        })),
        label: { show: true, position: 'top', fontSize: 11, formatter: p => `${p.value}m` },
      },
      ...(revVals ? [{
        name: rev.route,
        type: 'bar',
        barMaxWidth: 52,
        data: revVals.map(v => ({
          value: v,
          itemStyle: { color: '#fa8c16', borderRadius: [4, 4, 0, 0] },
        })),
        label: { show: true, position: 'top', fontSize: 11, formatter: p => `${p.value}m` },
      }] : []),
    ],
  }
}

function originDelayOption(routes, highlightRoute) {
  const sorted = [...routes]
    .sort((a, b) => b.avg_arr_delay_min - a.avg_arr_delay_min)
    .slice(0, 10)

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (ps) => {
        const r = sorted[ps[0].dataIndex]
        return [
          `<b>${r.route}</b>`,
          `Avg Arr Delay: <b>${r.avg_arr_delay_min.toFixed(1)} min</b>`,
          `On-Time: ${r.on_time_rate_pct.toFixed(1)}%`,
          `Flights: ${r.total_flights.toLocaleString()}`,
        ].join('<br/>')
      },
    },
    grid: { left: 56, right: 64, top: 12, bottom: 16 },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: v => `${v}m`, fontSize: 10 },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    yAxis: {
      type: 'category',
      data: sorted.map(r => r.Dest),
      inverse: true,
      axisLabel: { fontSize: 12, fontWeight: 600 },
    },
    series: [{
      type: 'bar',
      data: sorted.map(r => ({
        value: +r.avg_arr_delay_min.toFixed(1),
        itemStyle: {
          color: r.route === highlightRoute ? '#1677ff' : delayColor(r.avg_arr_delay_min),
          borderRadius: [0, 4, 4, 0],
          opacity: r.route === highlightRoute ? 1 : 0.75,
        },
      })),
      label: { show: true, position: 'right', fontSize: 11, formatter: p => `${p.value}m` },
      barMaxWidth: 22,
    }],
  }
}

// ── table ─────────────────────────────────────────────────────────────────────

const COLUMNS = [
  {
    title: 'Route',
    dataIndex: 'route',
    width: 100,
    sorter: (a, b) => a.route.localeCompare(b.route),
    render: v => <b style={{ color: '#1677ff' }}>{v}</b>,
  },
  {
    title: 'Origin',
    dataIndex: 'Origin',
    width: 80,
    render: v => <span style={{ fontWeight: 500 }}>{v}</span>,
  },
  {
    title: 'Dest',
    dataIndex: 'Dest',
    width: 80,
    render: v => <span style={{ fontWeight: 500 }}>{v}</span>,
  },
  {
    title: 'Flights',
    dataIndex: 'total_flights',
    width: 100,
    sorter: (a, b) => a.total_flights - b.total_flights,
    defaultSortOrder: 'descend',
    render: v => v.toLocaleString(),
    align: 'right',
  },
  {
    title: 'Avg Arr Delay',
    dataIndex: 'avg_arr_delay_min',
    width: 130,
    sorter: (a, b) => a.avg_arr_delay_min - b.avg_arr_delay_min,
    render: v => (
      <span style={{ color: delayColor(v), fontWeight: 500 }}>{v.toFixed(1)} min</span>
    ),
    align: 'right',
  },
  {
    title: 'Avg Dep Delay',
    dataIndex: 'avg_dep_delay_min',
    width: 130,
    sorter: (a, b) => a.avg_dep_delay_min - b.avg_dep_delay_min,
    render: v => (
      <span style={{ color: delayColor(v), fontWeight: 500 }}>{v.toFixed(1)} min</span>
    ),
    align: 'right',
  },
  {
    title: 'On-Time Rate',
    dataIndex: 'on_time_rate_pct',
    width: 120,
    sorter: (a, b) => a.on_time_rate_pct - b.on_time_rate_pct,
    render: v => (
      <span style={{ color: onTimeColor(v), fontWeight: 500 }}>{v.toFixed(1)}%</span>
    ),
    align: 'right',
  },
  {
    title: 'Distance',
    dataIndex: 'avg_distance_miles',
    width: 100,
    sorter: (a, b) => a.avg_distance_miles - b.avg_distance_miles,
    render: v => `${v.toFixed(0)} mi`,
    align: 'right',
  },
]

// ── component ─────────────────────────────────────────────────────────────────

export default function RoutesPage() {
  const [allRoutes, setAllRoutes]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const [originInput, setOriginInput] = useState('')
  const [destInput, setDestInput]     = useState('')
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [reverseRoute, setReverseRoute]   = useState(null)
  const [searchErr, setSearchErr]         = useState('')

  const [tableFilter, setTableFilter] = useState('')

  useEffect(() => {
    getAnalysis('routes')
      .then(data => setAllRoutes(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load route data'))
      .finally(() => setLoading(false))
  }, [])

  const airportCodes = useMemo(() => {
    const s = new Set()
    allRoutes.forEach(r => { s.add(r.Origin); s.add(r.Dest) })
    return [...s].sort()
  }, [allRoutes])

  const originOpts = useMemo(() => {
    if (!originInput) return []
    const q = originInput.toUpperCase()
    return airportCodes.filter(c => c.startsWith(q)).slice(0, 8).map(c => ({ value: c }))
  }, [originInput, airportCodes])

  const destOpts = useMemo(() => {
    if (!destInput) return []
    const q = destInput.toUpperCase()
    return airportCodes.filter(c => c.startsWith(q)).slice(0, 8).map(c => ({ value: c }))
  }, [destInput, airportCodes])

  const handleSearch = () => {
    setSearchErr('')
    const o = originInput.trim().toUpperCase()
    const d = destInput.trim().toUpperCase()
    if (!o || !d) { setSearchErr('Please enter both Origin and Destination.'); return }
    if (o === d)  { setSearchErr('Origin and Destination must differ.'); return }
    const fwd = allRoutes.find(r => r.Origin === o && r.Dest === d)
    if (!fwd)  { setSearchErr(`No data found for ${o} → ${d}.`); return }
    setSelectedRoute(fwd)
    setReverseRoute(allRoutes.find(r => r.Origin === d && r.Dest === o) ?? null)
  }

  const handleSwap = () => {
    setOriginInput(destInput)
    setDestInput(originInput)
    setSelectedRoute(null)
    setReverseRoute(null)
    setSearchErr('')
  }

  const routesFromOrigin = useMemo(
    () => selectedRoute ? allRoutes.filter(r => r.Origin === selectedRoute.Origin) : [],
    [allRoutes, selectedRoute],
  )

  const filteredRows = useMemo(() => {
    if (!tableFilter) return allRoutes
    const q = tableFilter.trim().toUpperCase()
    return allRoutes.filter(r => r.Origin === q || r.Dest === q || r.route.includes(q))
  }, [allRoutes, tableFilter])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" showIcon message={error} />
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 20, color: '#262626' }}>
        Routes · 2019 – 2024
      </Title>

      {/* ── Search ── */}
      <Card
        style={{ borderRadius: 8, marginBottom: 16 }}
        title={<span style={{ fontWeight: 600 }}><SearchOutlined style={{ marginRight: 6 }} />Route Search</span>}
      >
        <Space size={8} wrap align="start">
          <AutoComplete
            value={originInput}
            onChange={v => { setOriginInput(v.toUpperCase()); setSelectedRoute(null) }}
            options={originOpts}
            style={{ width: 140 }}
          >
            <Input
              prefix={<NodeIndexOutlined style={{ color: '#1677ff' }} />}
              placeholder="Origin  e.g. JFK"
              maxLength={3}
            />
          </AutoComplete>

          <Button
            icon={<SwapOutlined />}
            onClick={handleSwap}
            title="Swap origin and destination"
          />

          <AutoComplete
            value={destInput}
            onChange={v => { setDestInput(v.toUpperCase()); setSelectedRoute(null) }}
            options={destOpts}
            style={{ width: 140 }}
          >
            <Input
              prefix={<NodeIndexOutlined style={{ color: '#fa8c16' }} />}
              placeholder="Dest  e.g. LAX"
              maxLength={3}
            />
          </AutoComplete>

          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            Search
          </Button>
        </Space>
        {searchErr && (
          <div style={{ color: '#ff4d4f', marginTop: 10, fontSize: 13 }}>{searchErr}</div>
        )}
      </Card>

      {/* ── Route Detail ── */}
      {selectedRoute && (
        <>
          {/* KPI strip */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={8} lg={4}>
              <Card style={{ borderRadius: 8, borderLeft: '4px solid #1677ff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RocketOutlined style={{ fontSize: 22, color: '#1677ff' }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>Total Flights</div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#1677ff' }}>
                      {selectedRoute.total_flights.toLocaleString()}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card style={{ borderRadius: 8, borderLeft: `4px solid ${delayColor(selectedRoute.avg_arr_delay_min)}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ClockCircleOutlined style={{ fontSize: 22, color: delayColor(selectedRoute.avg_arr_delay_min) }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>Avg Arr Delay</div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: delayColor(selectedRoute.avg_arr_delay_min) }}>
                      {selectedRoute.avg_arr_delay_min.toFixed(1)} min
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card style={{ borderRadius: 8, borderLeft: `4px solid ${delayColor(selectedRoute.avg_dep_delay_min)}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BarChartOutlined style={{ fontSize: 22, color: delayColor(selectedRoute.avg_dep_delay_min) }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>Avg Dep Delay</div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: delayColor(selectedRoute.avg_dep_delay_min) }}>
                      {selectedRoute.avg_dep_delay_min.toFixed(1)} min
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card style={{ borderRadius: 8, borderLeft: `4px solid ${onTimeColor(selectedRoute.on_time_rate_pct)}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircleOutlined style={{ fontSize: 22, color: onTimeColor(selectedRoute.on_time_rate_pct) }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>On-Time Rate</div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: onTimeColor(selectedRoute.on_time_rate_pct) }}>
                      {selectedRoute.on_time_rate_pct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card style={{ borderRadius: 8, borderLeft: '4px solid #722ed1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CompassOutlined style={{ fontSize: 22, color: '#722ed1' }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>Distance</div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#722ed1' }}>
                      {selectedRoute.avg_distance_miles.toFixed(0)} mi
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {/* Forward vs Reverse bar comparison */}
            <Col xs={24} lg={11}>
              <Card
                style={{ borderRadius: 8 }}
                title={
                  <span style={{ fontWeight: 600 }}>
                    <span style={{ color: '#1677ff' }}>{selectedRoute.route}</span>
                    {reverseRoute && (
                      <> vs <span style={{ color: '#fa8c16' }}>{reverseRoute.route}</span></>
                    )}
                  </span>
                }
                extra={<span style={{ color: '#888', fontSize: 12 }}>delay comparison</span>}
              >
                <ReactECharts
                  option={compareOption(selectedRoute, reverseRoute)}
                  style={{ height: 220 }}
                  notMerge
                />
                {reverseRoute && (() => {
                  const diff = selectedRoute.on_time_rate_pct - reverseRoute.on_time_rate_pct
                  const better = diff > 0 ? 'outbound' : 'return'
                  return (
                    <div style={{
                      marginTop: 10, padding: '8px 12px',
                      background: '#fafafa', borderRadius: 6, fontSize: 12,
                    }}>
                      <span style={{ color: '#888' }}>Return on-time rate: </span>
                      <span style={{ color: onTimeColor(reverseRoute.on_time_rate_pct), fontWeight: 600 }}>
                        {reverseRoute.on_time_rate_pct.toFixed(1)}%
                      </span>
                      <span style={{ color: '#aaa', marginLeft: 12 }}>
                        ({Math.abs(diff).toFixed(1)}% {better === 'outbound' ? '↑ better outbound' : '↑ better return'})
                      </span>
                    </div>
                  )
                })()}
                {!reverseRoute && (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#aaa' }}>
                    No reverse route data available.
                  </div>
                )}
              </Card>
            </Col>

            {/* Top routes from same origin ranked by delay */}
            <Col xs={24} lg={13}>
              <Card
                style={{ borderRadius: 8 }}
                title={
                  <span style={{ fontWeight: 600 }}>
                    Routes from <span style={{ color: '#1677ff' }}>{selectedRoute.Origin}</span> — Avg Arrival Delay
                  </span>
                }
                extra={<span style={{ color: '#888', fontSize: 12 }}>top 10 · highlighted = selected</span>}
              >
                <ReactECharts
                  option={originDelayOption(routesFromOrigin, selectedRoute.route)}
                  style={{ height: 250 }}
                  notMerge
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* ── Full Routes Table ── */}
      <Card
        style={{ borderRadius: 8 }}
        title={
          <span style={{ fontWeight: 600 }}>
            All Routes
            <span style={{ color: '#aaa', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
              ({filteredRows.length.toLocaleString()} routes)
            </span>
          </span>
        }
        extra={
          <Input.Search
            placeholder="Filter by airport code"
            allowClear
            onSearch={v => setTableFilter(v)}
            onChange={e => !e.target.value && setTableFilter('')}
            style={{ width: 200 }}
          />
        }
      >
        <Table
          dataSource={filteredRows}
          columns={COLUMNS}
          rowKey="route"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }}
          scroll={{ x: 760 }}
        />
      </Card>
    </div>
  )
}
