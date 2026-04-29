import { useEffect, useState, useMemo, useRef } from 'react'
import { Row, Col, Card, Statistic, Spin, Alert, Typography, Table, Input, Select, Button, Space } from 'antd'
import {
  EnvironmentOutlined,
  WarningOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { getAirports } from '../services/api'

const { Title } = Typography
const { Search } = Input

// ── helpers ──────────────────────────────────────────────────────────────────

const delayColor = (v) => {
  if (v >= 15) return '#ff4d4f'
  if (v >= 8)  return '#fa8c16'
  if (v >= 3)  return '#fadb14'
  return '#52c41a'
}

// ── scatter "map" chart ───────────────────────────────────────────────────────

function mapOption(airports, geoReady) {
  const pts = airports.filter(
    a => a.lat && a.lon && a.lon > -128 && a.lon < -65 && a.lat > 24 && a.lat < 50
  )
  const data = [...pts]
    .sort((a, b) => b.total_departures - a.total_departures)
    .map(a => ({
      value: [a.lon, a.lat, a.total_departures, a.avg_arr_delay_min],
      name: `${a.airport_code} · ${a.city || ''}`,
      airport_code: a.airport_code,
    }))

  const tooltip = {
    trigger: 'item',
    formatter: ({ data: d }) => {
      const [lon, lat, dep, delay] = d.value
      return [
        `<b>${d.name}</b>`,
        `Departures: ${dep.toLocaleString()}`,
        `Avg Arrival Delay: <b style="color:${delayColor(delay)}">${delay.toFixed(1)} min</b>`,
        `Coordinates: ${lat.toFixed(2)}°N, ${Math.abs(lon).toFixed(2)}°W`,
      ].join('<br/>')
    },
  }

  const visualMap = {
    min: 0, max: 20,
    dimension: 3,
    calculable: true,
    orient: 'vertical',
    right: 8,
    top: 'middle',
    itemHeight: 100,
    text: ['High', 'Low'],
    textStyle: { fontSize: 11 },
    inRange: { color: ['#52c41a', '#fadb14', '#fa8c16', '#ff4d4f'] },
  }

  const series = {
    type: 'scatter',
    symbol: 'rect',
    data,
    symbolSize: d => Math.round(6 + Math.log1p(d[2] / 8000) * 2.8),
    itemStyle: { opacity: 0.88, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
    emphasis: {
      itemStyle: { opacity: 1 },
      label: {
        show: true,
        formatter: p => p.data.airport_code,
        fontSize: 11, fontWeight: 600, color: '#262626',
        textBorderColor: '#fff', textBorderWidth: 2,
      },
    },
  }

  // ── geo mode: state boundaries as background ──────────────────────────────
  if (geoReady) {
    return {
      backgroundColor: '#f8faff',
      tooltip,
      visualMap,
      geo: BASE_GEO,
      series: [{ ...series, coordinateSystem: 'geo' }],
    }
  }

  // ── fallback cartesian mode (geo JSON not yet loaded) ─────────────────────
  return {
    backgroundColor: '#f8faff',
    tooltip,
    visualMap,
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, minSpan: 20, maxSpan: 100, zoomOnMouseWheel: true, moveOnMouseMove: true },
      { type: 'inside', yAxisIndex: 0, minSpan: 20, maxSpan: 100, zoomOnMouseWheel: true, moveOnMouseMove: true },
    ],
    grid: { left: 40, right: 60, top: 20, bottom: 48 },
    xAxis: {
      type: 'value', min: -128, max: -65,
      axisLabel: { formatter: v => `${Math.abs(v)}°W`, fontSize: 10 },
      splitLine: { lineStyle: { color: '#e8eef6' } },
      name: 'Longitude', nameTextStyle: { fontSize: 11, color: '#888' },
    },
    yAxis: {
      type: 'value', min: 24, max: 50,
      axisLabel: { formatter: v => `${v}°N`, fontSize: 10 },
      splitLine: { lineStyle: { color: '#e8eef6' } },
      name: 'Latitude', nameTextStyle: { fontSize: 11, color: '#888' },
    },
    series: [series],
  }
}

// ── top-5 bar chart ───────────────────────────────────────────────────────────

function rankOption(airports, metric) {
  const sorted = [...airports]
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 5)
  const labels = sorted.map(a => a.airport_code)
  const values = sorted.map(a => +a[metric].toFixed(1))
  const isDelay = metric.includes('delay')

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: ps => {
        const p = ps[0]
        const a = sorted[p.dataIndex]
        return [
          `<b>${a.airport_code}</b> — ${a.city || ''}`,
          `${p.seriesName}: <b>${p.value}${isDelay ? ' min' : '%'}</b>`,
        ].join('<br/>')
      },
    },
    grid: { left: 48, right: 16, top: 16, bottom: 16 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { fontSize: 12, fontWeight: 600 },
    },
    yAxis: {
      type: 'value',
      name: isDelay ? 'min' : '%',
      nameTextStyle: { fontSize: 10 },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    series: [{
      name: metric === 'avg_arr_delay_min'  ? 'Avg Arrival Delay'
          : metric === 'arr_delay_rate_pct' ? 'Delay Rate'
          : 'Avg Dep Delay',
      type: 'bar',
      data: values,
      barMaxWidth: 48,
      label: { show: true, position: 'top', fontSize: 11,
        formatter: p => `${p.value}${isDelay ? 'm' : '%'}` },
      itemStyle: {
        color: p => {
          const v = p.value
          if (v >= 15 || (metric.includes('rate') && v >= 30)) return '#ff4d4f'
          if (v >= 8  || (metric.includes('rate') && v >= 20)) return '#fa8c16'
          return '#1677ff'
        },
        borderRadius: [4, 4, 0, 0],
      },
    }],
  }
}

// ── table columns ─────────────────────────────────────────────────────────────

const COLUMNS = [
  { title: 'Rank', key: 'rank', width: 60,
    render: (_, __, i) => <span style={{ color: '#888', fontSize: 12 }}>{i + 1}</span> },
  { title: 'Code', dataIndex: 'airport_code', width: 70,
    render: v => <b style={{ color: '#1677ff' }}>{v}</b> },
  { title: 'City', dataIndex: 'city', ellipsis: true, render: v => v || '—' },
  { title: 'Departures', dataIndex: 'total_departures',
    sorter: (a, b) => a.total_departures - b.total_departures,
    render: v => v.toLocaleString(), align: 'right', width: 120 },
  { title: 'Avg Dep Delay', dataIndex: 'avg_dep_delay_min',
    sorter: (a, b) => a.avg_dep_delay_min - b.avg_dep_delay_min,
    defaultSortOrder: 'descend',
    render: v => <span style={{ color: delayColor(v), fontWeight: 500 }}>{v.toFixed(1)} min</span>,
    align: 'right', width: 130 },
  { title: 'Dep Delay Rate', dataIndex: 'dep_delay_rate_pct',
    sorter: (a, b) => a.dep_delay_rate_pct - b.dep_delay_rate_pct,
    render: v => `${v.toFixed(1)}%`, align: 'right', width: 120 },
  { title: 'Avg Arr Delay', dataIndex: 'avg_arr_delay_min',
    sorter: (a, b) => a.avg_arr_delay_min - b.avg_arr_delay_min,
    render: v => <span style={{ color: delayColor(v), fontWeight: 500 }}>{v.toFixed(1)} min</span>,
    align: 'right', width: 130 },
  { title: 'Arr Delay Rate', dataIndex: 'arr_delay_rate_pct',
    sorter: (a, b) => a.arr_delay_rate_pct - b.arr_delay_rate_pct,
    render: v => `${v.toFixed(1)}%`, align: 'right', width: 120 },
]

const METRIC_OPTIONS = [
  { value: 'avg_arr_delay_min',  label: 'Avg Arrival Delay' },
  { value: 'arr_delay_rate_pct', label: 'Arrival Delay Rate' },
  { value: 'avg_dep_delay_min',  label: 'Avg Dep Delay' },
]

const MIN_ZOOM = 1.15   // initial zoom so US fills the container

// Shared geo config — used in mapOption, resetView, and roam-limit corrections.
// Defined at module level so closures inside useEffect never go stale.
const BASE_GEO = {
  map: 'USA',
  roam: true,
  zoom: MIN_ZOOM,
  aspectScale: 1,
  itemStyle: { areaColor: '#eef2fa', borderColor: '#b8c8e0', borderWidth: 0.8 },
  emphasis: { itemStyle: { areaColor: '#dde8ff' }, label: { show: false } },
  label: { show: false },
  silent: true,
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Airports() {
  const [airports,  setAirports]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [search,    setSearch]    = useState('')
  const [metric,    setMetric]    = useState('avg_arr_delay_min')
  const [geoReady,  setGeoReady]  = useState(false)
  const chartRef    = useRef(null)
  const zoomLevelRef = useRef(MIN_ZOOM)

  useEffect(() => {
    getAirports({ limit: 500, min_flights: 0 })
      .then(setAirports)
      .catch(() => setError('Failed to load airport data'))
      .finally(() => setLoading(false))
  }, [])

  // 加载美国各州 GeoJSON（本地 public/usa.json），过滤掉非大陆州后注册
  useEffect(() => {
    // FIPS 02=Alaska 15=Hawaii 72=PR 78=VI 66=Guam 60=AS 69=CNMI
    const NON_CONTINENTAL = new Set(['02', '15', '72', '78', '66', '60', '69'])
    fetch('/usa.json')
      .then(r => r.json())
      .then(data => {
        const continental = {
          ...data,
          features: data.features.filter(f => !NON_CONTINENTAL.has(String(f.id))),
        }
        echarts.registerMap('USA', continental)
        setGeoReady(true)
      })
      .catch(() => { /* fail silently; cartesian fallback stays */ })
  }, [])

  // geo 模式切换时重置缩放层级
  useEffect(() => { zoomLevelRef.current = MIN_ZOOM }, [geoReady])

  // 用绝对 zoom 值更新 geo 组件（不用 geoRoam dispatch，ECharts6 里 geoRoam 会丢失 scatter）
  const applyGeoZoom = (chart, newLevel) => {
    chart.setOption({ geo: [{ zoom: newLevel }] })
  }

  // 重置地图视图（回到初始大陆全图）
  const resetView = () => {
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) return
    chart.setOption({ geo: [BASE_GEO] }, { replaceMerge: ['geo'] })
    zoomLevelRef.current = MIN_ZOOM
  }

  // georoam 事件：统一处理缩放限制 [1x,5x] 和拖拽边界（不能拖出大陆US范围）
  useEffect(() => {
    if (!geoReady) return
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) return

    const handleRoam = (params) => {
      // ── 缩放限制 ──────────────────────────────────────────────────────────────
      // geo[0].zoom in getOption() IS accurate after scroll-zoom in ECharts 6
      // (unlike center, which uses an internal pixel-offset that getOption doesn't expose)
      if (params.zoom != null) {
        const currentZoom = chart.getOption()?.geo?.[0]?.zoom ?? zoomLevelRef.current
        if (currentZoom < MIN_ZOOM) {
          chart.setOption({ geo: [{ zoom: MIN_ZOOM }] })
          zoomLevelRef.current = MIN_ZOOM
        } else if (currentZoom > 5) {
          chart.setOption({ geo: [{ zoom: 5 }] })
          zoomLevelRef.current = 5
        } else {
          zoomLevelRef.current = currentZoom
        }
        return
      }

      // ── 拖拽边界 ──────────────────────────────────────────────────────────────
      // ECharts 6 stores pan as a pixel-delta from the option's base center.
      // setOption({ geo: [{ center }] }) in merge mode only changes the base —
      // the pixel-delta is still applied on top, so the map doesn't actually snap back.
      // Fix: replaceMerge clears roam internal state; we re-position at the clamped center.
      if (params.dx != null || params.dy != null) {
        const dom = chart.getDom()
        const px = chart.convertFromPixel(
          { geoIndex: 0 }, [dom.offsetWidth / 2, dom.offsetHeight / 2]
        )
        if (!px) return
        const [lon, lat] = px
        const zoom = zoomLevelRef.current
        const m = 3 / zoom   // margin shrinks as you zoom in
        const clon = Math.max(-124.8 - m, Math.min(-66.9 + m, lon))
        const clat = Math.max(24.5  - m, Math.min(49.4  + m, lat))
        if (Math.abs(clon - lon) > 0.1 || Math.abs(clat - lat) > 0.1) {
          chart.setOption(
            { geo: [{ ...BASE_GEO, zoom, center: [clon, clat] }] },
            { replaceMerge: ['geo'] }
          )
        }
      }
    }

    chart.on('georoam', handleRoam)
    return () => chart.off('georoam', handleRoam)
  }, [geoReady])

  const handleZoom = (direction) => {
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) return

    if (geoReady) {
      if (direction === 'in') {
        if (zoomLevelRef.current >= 5) return
        zoomLevelRef.current = Math.min(5, zoomLevelRef.current * 1.5)
        applyGeoZoom(chart, zoomLevelRef.current)
      } else {
        if (zoomLevelRef.current <= MIN_ZOOM) { resetView(); return }
        zoomLevelRef.current = Math.max(MIN_ZOOM, zoomLevelRef.current / 1.5)
        if (zoomLevelRef.current <= MIN_ZOOM) { resetView(); return }
        applyGeoZoom(chart, zoomLevelRef.current)
      }
    } else {
      const opt = chart.getOption()
      const factor = direction === 'in' ? 0.6 : 1 / 0.6
      ;[0, 1].forEach(idx => {
        const dz = opt.dataZoom[idx]
        const s = dz.start ?? 0
        const e = dz.end   ?? 100
        const center  = (s + e) / 2
        const newHalf = Math.min(50, Math.max(10, ((e - s) / 2) * factor))
        chart.dispatchAction({
          type: 'dataZoom', dataZoomIndex: idx,
          start: Math.max(0,   center - newHalf),
          end:   Math.min(100, center + newHalf),
        })
      })
    }
  }

  const filtered = useMemo(() => {
    if (!search) return airports
    const q = search.toLowerCase()
    return airports.filter(
      a => a.airport_code?.toLowerCase().includes(q) || a.city?.toLowerCase().includes(q)
    )
  }, [airports, search])

  const busiest = useMemo(() =>
    airports.reduce((a, b) => (b.total_departures > (a?.total_departures ?? 0) ? b : a), null),
  [airports])
  const mostDelayed = useMemo(() => {
    const c = airports.filter(a => a.total_departures >= 10000)
    return c.reduce((a, b) => (b.avg_arr_delay_min > (a?.avg_arr_delay_min ?? 0) ? b : a), null)
  }, [airports])
  const avgDelay = useMemo(() => {
    const big = airports.filter(a => a.total_departures >= 10000)
    return big.length ? big.reduce((s, a) => s + a.avg_arr_delay_min, 0) / big.length : 0
  }, [airports])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 20 }} />}

      <Title level={4} style={{ marginBottom: 20, color: '#262626' }}>
        Airport Delay Analysis · 2019 – 2024
      </Title>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: '#e6f4ff', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#1677ff' }}>
                <EnvironmentOutlined />
              </div>
              <Statistic
                title={<span style={{ fontSize: 13, color: '#888' }}>Airports Analyzed</span>}
                value={airports.length}
                valueStyle={{ color: '#1677ff', fontSize: 26, fontWeight: 600 }}
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: '#e6f4ff', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#1677ff' }}>
                <RocketOutlined />
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#888' }}>Busiest Airport</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: '#1677ff', lineHeight: 1.2 }}>
                  {busiest?.airport_code ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  {busiest ? `${(busiest.total_departures / 1e6).toFixed(2)}M departures` : ''}
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: '#fff1f0', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#ff4d4f' }}>
                <WarningOutlined />
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#888' }}>Most Delayed (≥10k flights)</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: '#ff4d4f', lineHeight: 1.2 }}>
                  {mostDelayed?.airport_code ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  {mostDelayed ? `${mostDelayed.avg_arr_delay_min.toFixed(1)} min avg arrival delay` : ''}
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: '#fff7e6', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fa8c16' }}>
                <ClockCircleOutlined />
              </div>
              <Statistic
                title={<span style={{ fontSize: 13, color: '#888' }}>Avg Arrival Delay (major)</span>}
                value={avgDelay.toFixed(2)}
                suffix=" min"
                valueStyle={{ color: '#fa8c16', fontSize: 26, fontWeight: 600 }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Map (wide) + Top 5 Bar (narrow) */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={17}>
          <Card
            style={{ borderRadius: 8 }}
            styles={{ body: { padding: 4 } }}
            title={<span style={{ fontWeight: 600 }}>Geographic Distribution — Continental US</span>}
            extra={
              <Space size={6}>
                <Button size="small" icon={<ZoomInOutlined />}  onClick={() => handleZoom('in')}>Zoom In</Button>
                <Button size="small" icon={<ZoomOutOutlined />} onClick={() => handleZoom('out')}>Zoom Out</Button>
                {geoReady && <Button size="small" icon={<ReloadOutlined />} onClick={resetView}>Reset</Button>}
                <span style={{ fontSize: 11, color: '#aaa' }}>scroll · drag to pan</span>
              </Space>
            }
          >
            {/* paddingBottom = 43% matches ~58°lon × ~25°lat of continental US at aspectScale:1 */}
            <div style={{ position: 'relative', width: '100%', paddingBottom: '43%' }}>
              <ReactECharts
                ref={chartRef}
                option={mapOption(airports, geoReady)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                notMerge
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={7}>
          <Card
            style={{ borderRadius: 8 }}
            title={<span style={{ fontWeight: 600 }}>Top 5 Airports by</span>}
            extra={
              <Select
                value={metric}
                onChange={setMetric}
                options={METRIC_OPTIONS}
                size="small"
                style={{ width: 150 }}
              />
            }
          >
            <ReactECharts
              option={rankOption(airports.filter(a => a.total_departures >= 10000), metric)}
              style={{ height: 300 }}
              notMerge
            />
          </Card>
        </Col>
      </Row>

      {/* Full Ranking Table */}
      <Card
        style={{ borderRadius: 8, marginTop: 16 }}
        title={<span style={{ fontWeight: 600 }}>All Airports</span>}
        extra={
          <Search
            placeholder="Search code or city"
            allowClear
            onSearch={setSearch}
            onChange={e => !e.target.value && setSearch('')}
            style={{ width: 220 }}
          />
        }
      >
        <Table
          dataSource={filtered}
          columns={COLUMNS}
          rowKey="airport_code"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  )
}
