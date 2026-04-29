import { useState } from 'react'
import {
  Row, Col, Card, Form, Select, Input, InputNumber,
  Button, Segmented, Typography, Alert, Space,
} from 'antd'
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { predictPre, predictPost } from '../services/api'

const { Title } = Typography

const AIRLINES = [
  { value: 'AA', label: 'American Airlines (AA)' },
  { value: 'DL', label: 'Delta Air Lines (DL)' },
  { value: 'UA', label: 'United Airlines (UA)' },
  { value: 'WN', label: 'Southwest Airlines (WN)' },
  { value: 'B6', label: 'JetBlue Airways (B6)' },
  { value: 'AS', label: 'Alaska Airlines (AS)' },
  { value: 'NK', label: 'Spirit Airlines (NK)' },
  { value: 'F9', label: 'Frontier Airlines (F9)' },
  { value: 'G4', label: 'Allegiant Air (G4)' },
  { value: 'HA', label: 'Hawaiian Airlines (HA)' },
  { value: 'OO', label: 'SkyWest Airlines (OO)' },
  { value: 'YX', label: 'Republic Airways (YX)' },
  { value: '9E', label: 'Endeavor Air (9E)' },
  { value: 'OH', label: 'PSA Airlines (OH)' },
  { value: 'MQ', label: 'Envoy Air (MQ)' },
  { value: 'YV', label: 'Mesa Air (YV)' },
  { value: 'QX', label: 'Horizon Air (QX)' },
  { value: 'EV', label: 'ExpressJet (EV)' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
].map((label, i) => ({ value: i + 1, label }))

const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
].map((label, i) => ({ value: i + 1, label }))

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '00:00 (Midnight)'
       : i === 12 ? '12:00 (Noon)'
       : i < 12  ? `${String(i).padStart(2, '0')}:00 (${i} AM)`
                 : `${String(i).padStart(2, '0')}:00 (${i - 12} PM)`,
}))

function gaugeOption(prob) {
  const pct = Math.round(prob * 100)
  const color = pct >= 70 ? '#ff4d4f' : pct >= 40 ? '#fa8c16' : '#52c41a'
  return {
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      splitNumber: 5,
      radius: '90%',
      center: ['50%', '60%'],
      axisLine: {
        lineStyle: {
          width: 18,
          color: [[0.4, '#52c41a'], [0.7, '#fa8c16'], [1, '#ff4d4f']],
        },
      },
      pointer: { width: 5, length: '65%', itemStyle: { color } },
      axisTick: { show: false },
      splitLine: { length: 10, lineStyle: { color: '#e8e8e8', width: 2 } },
      axisLabel: {
        distance: 22, fontSize: 11,
        formatter: v => `${v}%`, color: '#888',
      },
      detail: {
        valueAnimation: true,
        formatter: v => `${v}%`,
        fontSize: 32, fontWeight: 700, color,
        offsetCenter: [0, '22%'],
      },
      data: [{ value: pct }],
    }],
  }
}

export default function Predict() {
  const [form] = Form.useForm()
  const [mode, setMode] = useState('pre')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleModeChange = (val) => {
    setMode(val)
    setResult(null)
    setError(null)
  }

  const handlePredict = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }

    setLoading(true)
    setError(null)

    const body = {
      Reporting_Airline: values.airline,
      Origin: values.origin.toUpperCase(),
      Dest: values.dest.toUpperCase(),
      Month: values.month,
      DayOfWeek: values.dayOfWeek,
      DepHour: values.depHour,
      CRSDepTime: values.depHour * 100,
      Distance: values.distance,
      ...(mode === 'post' ? { DepDelay: values.depDelay ?? 0 } : {}),
    }

    try {
      const res = mode === 'pre' ? await predictPre(body) : await predictPost(body)
      setResult(res)
    } catch {
      setError('Prediction failed. Make sure the API server is running.')
    } finally {
      setLoading(false)
    }
  }

  const prob = result?.delay_probability ?? 0
  const isDelayed = result?.is_delayed_predicted
  const delayMin = result?.estimated_delay_minutes

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 20, color: '#262626' }}>
        Flight Delay Predictor
      </Title>

      <Row gutter={[24, 24]}>

        {/* ── Form ───────────────────────────────────────────────── */}
        <Col xs={24} lg={14}>
          <Card
            style={{ borderRadius: 8 }}
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#1677ff' }} />
                <span style={{ fontWeight: 600 }}>Flight Details</span>
              </Space>
            }
            extra={
              <Segmented
                options={[
                  { label: 'Pre-Departure', value: 'pre' },
                  { label: 'Post-Departure', value: 'post' },
                ]}
                value={mode}
                onChange={handleModeChange}
              />
            }
          >
            <div style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
              {mode === 'pre'
                ? 'Predict before the flight departs — uses scheduled info only.'
                : 'Predict after departure — add the actual departure delay for a sharper estimate.'}
            </div>

            <Form form={form} layout="vertical" requiredMark={false}>

              <Form.Item label="Airline" name="airline" rules={[{ required: true, message: 'Select an airline' }]}>
                <Select
                  showSearch
                  placeholder="Select airline"
                  options={AIRLINES}
                  filterOption={(input, opt) =>
                    opt.label.toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Origin"
                    name="origin"
                    rules={[
                      { required: true, message: 'Enter origin airport' },
                      { pattern: /^[A-Za-z]{3}$/, message: '3-letter IATA code (e.g. JFK)' },
                    ]}
                  >
                    <Input placeholder="e.g. JFK" maxLength={3} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Destination"
                    name="dest"
                    rules={[
                      { required: true, message: 'Enter destination airport' },
                      { pattern: /^[A-Za-z]{3}$/, message: '3-letter IATA code (e.g. LAX)' },
                    ]}
                  >
                    <Input placeholder="e.g. LAX" maxLength={3} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Month" name="month" rules={[{ required: true, message: 'Select month' }]}>
                    <Select placeholder="Select month" options={MONTHS} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Day of Week" name="dayOfWeek" rules={[{ required: true, message: 'Select day' }]}>
                    <Select placeholder="Select day" options={DAYS} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Departure Hour" name="depHour" rules={[{ required: true, message: 'Select hour' }]}>
                    <Select placeholder="Select departure hour" options={HOURS} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Distance (miles)"
                    name="distance"
                    rules={[{ required: true, message: 'Enter distance' }]}
                  >
                    <InputNumber min={1} max={6000} style={{ width: '100%' }} placeholder="e.g. 2475" />
                  </Form.Item>
                </Col>
              </Row>

              {mode === 'post' && (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="Actual Departure Delay (min)"
                      name="depDelay"
                      rules={[{ required: true, message: 'Required for post-departure mode' }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        placeholder="e.g. 20  (negative = early)"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              )}

              <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  loading={loading}
                  onClick={handlePredict}
                  size="large"
                  block
                >
                  {loading ? 'Predicting…' : 'Predict Delay'}
                </Button>
              </Form.Item>
            </Form>

            {error && (
              <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} />
            )}
          </Card>
        </Col>

        {/* ── Result ─────────────────────────────────────────────── */}
        <Col xs={24} lg={10}>
          <Card
            style={{ borderRadius: 8, height: '100%' }}
            title={<span style={{ fontWeight: 600 }}>Prediction Result</span>}
          >
            {!result ? (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: 360, color: '#d9d9d9', gap: 12,
              }}>
                <ThunderboltOutlined style={{ fontSize: 52 }} />
                <div style={{ fontSize: 14, color: '#bbb' }}>
                  Fill in flight details and click Predict
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>

                {/* Gauge */}
                <ReactECharts
                  option={gaugeOption(prob)}
                  style={{ height: 210, width: '100%' }}
                  notMerge
                />

                {/* Verdict banner — 3 levels based on probability */}
                {(() => {
                  const level = prob >= 0.7 ? 'high' : prob >= 0.4 ? 'mid' : 'low'
                  const cfg = {
                    low:  { bg: '#f6ffed', border: '#b7eb8f', color: '#52c41a', icon: <CheckCircleOutlined />,      text: 'LIKELY ON TIME'    },
                    mid:  { bg: '#fff7e6', border: '#ffd591', color: '#fa8c16', icon: <WarningOutlined />,           text: 'MIGHT BE DELAYED'  },
                    high: { bg: '#fff2f0', border: '#ffccc7', color: '#ff4d4f', icon: <ExclamationCircleOutlined />, text: 'LIKELY DELAYED'    },
                  }[level]
                  return (
                    <div style={{
                      width: '100%',
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      borderRadius: 8,
                      padding: '14px 20px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 22, color: cfg.color, marginBottom: 4 }}>{cfg.icon}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>{cfg.text}</div>
                    </div>
                  )
                })()}

                {/* Stats row */}
                <Row gutter={12} style={{ width: '100%' }}>
                  <Col span={12}>
                    <div style={{
                      background: '#fafafa', borderRadius: 8,
                      padding: '12px 16px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Delay Probability</div>
                      <div style={{
                        fontSize: 24, fontWeight: 700,
                        color: prob >= 0.7 ? '#ff4d4f' : prob >= 0.4 ? '#fa8c16' : '#52c41a',
                      }}>
                        {(prob * 100).toFixed(1)}%
                      </div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{
                      background: '#fafafa', borderRadius: 8,
                      padding: '12px 16px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Est. Delay</div>
                      <div style={{
                        fontSize: 24, fontWeight: 700,
                        color: delayMin > 30 ? '#ff4d4f' : delayMin > 0 ? '#fa8c16' : '#52c41a',
                      }}>
                        {delayMin > 0 ? `+${delayMin} min` : `${delayMin} min`}
                      </div>
                    </div>
                  </Col>
                </Row>

                <div style={{ fontSize: 11, color: '#bbb', width: '100%', textAlign: 'right' }}>
                  Model: {result.model === 'pre_departure' ? 'Pre-departure GBT' : 'Post-departure GBT'}
                </div>

              </div>
            )}
          </Card>
        </Col>

      </Row>
    </div>
  )
}
