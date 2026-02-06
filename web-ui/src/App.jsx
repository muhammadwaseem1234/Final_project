import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import NetworkView from './NetworkView.jsx'

const DEFAULT_CONFIG = {
  gatewayUrl: 'http://localhost:3000',
  authUrl: 'http://localhost:3001',
  behaviorUrl: 'http://localhost:8000'
}

const INITIAL_FORMS = {
  deviceId: 'device_demo_001',
  secret: 'my_super_secret',
  payloadSize: 50,
  metricValue: 12.5
}

function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [forms, setForms] = useState(INITIAL_FORMS)
  const [token, setToken] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState({
    register: false,
    auth: false,
    telemetry: false,
    burst: false
  })

  useEffect(() => {
    const stored = localStorage.getItem('authChainConfig')
    if (stored) {
      try {
        setConfig(JSON.parse(stored))
      } catch {
        setConfig(DEFAULT_CONFIG)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('authChainConfig', JSON.stringify(config))
  }, [config])

  const endpointSummary = useMemo(
    () => [
      { label: 'Gateway', value: config.gatewayUrl },
      { label: 'Auth Service', value: config.authUrl },
      { label: 'Behavior Service', value: config.behaviorUrl }
    ],
    [config]
  )

  const addLog = (entry) => {
    setLogs((prev) => [
      {
        id: crypto.randomUUID(),
        time: new Date().toLocaleTimeString(),
        ...entry
      },
      ...prev
    ].slice(0, 12))
  }

  const updateForm = (key, value) => {
    setForms((prev) => ({ ...prev, [key]: value }))
  }

  const updateConfig = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const resetConfig = () => setConfig(DEFAULT_CONFIG)

  const fetchProof = async (secret) => {
    const res = await fetch(`${config.authUrl}/prove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Proof generation failed')
    return data
  }

  const registerDevice = async () => {
    setLoading((prev) => ({ ...prev, register: true }))
    try {
      const res = await fetch(`${config.authUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: forms.deviceId,
          secret: forms.secret
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      addLog({
        type: 'success',
        title: 'Device registered',
        detail: `Commitment stored for ${forms.deviceId}`,
        payload: data
      })
    } catch (error) {
      addLog({
        type: 'error',
        title: 'Registration failed',
        detail: error.message
      })
    } finally {
      setLoading((prev) => ({ ...prev, register: false }))
    }
  }

  const authenticateDevice = async () => {
    setLoading((prev) => ({ ...prev, auth: true }))
    try {
      const proofData = await fetchProof(forms.secret)
      const res = await fetch(`${config.gatewayUrl}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: forms.deviceId,
          proof: proofData.proof,
          publicSignals: proofData.publicSignals
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Authentication failed')
      setToken(data.token || '')
      addLog({
        type: 'success',
        title: 'Authentication success',
        detail: `Token issued for ${forms.deviceId}`,
        payload: data
      })
    } catch (error) {
      addLog({
        type: 'error',
        title: 'Authentication failed',
        detail: error.message
      })
    } finally {
      setLoading((prev) => ({ ...prev, auth: false }))
    }
  }

  const sendTelemetry = async (payloadSizeOverride) => {
    setLoading((prev) => ({ ...prev, telemetry: true }))
    const payloadSize = payloadSizeOverride ?? Number(forms.payloadSize)
    try {
      const res = await fetch(`${config.gatewayUrl}/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: forms.deviceId,
          payloadSize,
          metricValue: Number(forms.metricValue)
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Telemetry failed')
      addLog({
        type: data.status === 'ANOMALY_DETECTED' ? 'warning' : 'success',
        title: 'Telemetry sent',
        detail: `Status: ${data.status || 'OK'}`,
        payload: data
      })
    } catch (error) {
      addLog({
        type: 'error',
        title: 'Telemetry failed',
        detail: error.message
      })
    } finally {
      setLoading((prev) => ({ ...prev, telemetry: false }))
    }
  }

  const sendBurst = async () => {
    setLoading((prev) => ({ ...prev, burst: true }))
    try {
      for (let i = 0; i < 12; i += 1) {
        await sendTelemetry(Number(forms.payloadSize))
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
    } finally {
      setLoading((prev) => ({ ...prev, burst: false }))
    }
  }

  return (
    <BrowserRouter>
      <div className="app">
        <nav className="topbar">
          <div className="topbar__brand">
            <span className="topbar__logo" aria-hidden="true" />
            <div>
              <div className="topbar__title">AuthChainID</div>
              <div className="topbar__subtitle">Secure device identity orchestration</div>
            </div>
          </div>
          <div className="topbar__links">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `topbar__link ${isActive ? 'topbar__link--active' : ''}`}
            >
              Console
            </NavLink>
            <NavLink
              to="/network"
              className={({ isActive }) => `topbar__link ${isActive ? 'topbar__link--active' : ''}`}
            >
              Network View
            </NavLink>
          </div>
        </nav>

        <Routes>
          <Route
            path="/"
            element={
              <>
                <header className="hero">
                  <div className="hero__content">
                    <p className="eyebrow">AuthChainID Control Console</p>
                    <h1>Introducing AuthChainID.</h1>
                    <p className="lead">
                      Drive registrations, auth handshakes, and telemetry checks through the gateway while
                      watching every response in real time.
                    </p>
                    <div className="hero__actions">
                      <button className="btn btn--primary" onClick={authenticateDevice} disabled={loading.auth}>
                        {loading.auth ? 'Authenticating...' : 'Run Auth Check'}
                      </button>
                      <button className="btn btn--ghost" onClick={sendTelemetry} disabled={loading.telemetry}>
                        {loading.telemetry ? 'Sending...' : 'Send Telemetry'}
                      </button>
                    </div>
                    {token ? (
                      <div className="token">
                        <span>Latest token</span>
                        <code>{token}</code>
                      </div>
                    ) : (
                      <div className="token token--empty">
                        <span>No token yet. Authenticate a device to issue one.</span>
                      </div>
                    )}
                  </div>
                  <div className="hero__panel">
                    <div className="panel">
                      <h3>Endpoint Map</h3>
                      <p className="panel__desc">Adjust service URLs and keep them synced across the console.</p>
                      <div className="panel__list">
                        {endpointSummary.map((item) => (
                          <div className="panel__item" key={item.label}>
                            <span>{item.label}</span>
                            <code>{item.value}</code>
                          </div>
                        ))}
                      </div>
                      <div className="panel__note">
                        Default ports: gateway 3000, auth 3001, behavior 8000.
                      </div>
                    </div>
                  </div>
                </header>

                <section className="grid">
                  <div className="card">
                    <div className="card__header">
                      <div>
                        <h2>Service Configuration</h2>
                        <p>Keep local services aligned before running flows.</p>
                      </div>
                      <button className="btn btn--ghost" onClick={resetConfig}>
                        Reset to Local
                      </button>
                    </div>
                    <div className="form">
                      <label>
                        Gateway URL
                        <input
                          value={config.gatewayUrl}
                          onChange={(e) => updateConfig('gatewayUrl', e.target.value)}
                          placeholder="http://localhost:3000"
                        />
                      </label>
                      <label>
                        Auth Service URL
                        <input
                          value={config.authUrl}
                          onChange={(e) => updateConfig('authUrl', e.target.value)}
                          placeholder="http://localhost:3001"
                        />
                      </label>
                      <label>
                        Behavior Service URL
                        <input
                          value={config.behaviorUrl}
                          onChange={(e) => updateConfig('behaviorUrl', e.target.value)}
                          placeholder="http://localhost:8000"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card__header">
                      <div>
                        <h2>Device Identity</h2>
                        <p>Register once, authenticate many times.</p>
                      </div>
                      <span className="badge">ZKP Groth16</span>
                    </div>
                    <div className="form">
                      <label>
                        Device ID
                        <input
                          value={forms.deviceId}
                          onChange={(e) => updateForm('deviceId', e.target.value)}
                          placeholder="IOT Device"
                        />
                      </label>
                      <label>
                        Secret
                        <input
                          type="password"
                          value={forms.secret}
                          onChange={(e) => updateForm('secret', e.target.value)}
                          placeholder="device secret"
                        />
                      </label>
                    </div>
                    <div className="card__actions">
                      <button className="btn btn--primary" onClick={registerDevice} disabled={loading.register}>
                        {loading.register ? 'Registering...' : 'Register Device'}
                      </button>
                      <button className="btn btn--ghost" onClick={authenticateDevice} disabled={loading.auth}>
                        {loading.auth ? 'Authenticating...' : 'Authenticate'}
                      </button>
                    </div>
                    <p className="hint">
                      Registration calls the auth service directly. Authentication flows through the gateway.
                    </p>
                  </div>

                  <div className="card">
                    <div className="card__header">
                      <div>
                        <h2>Telemetry Stream</h2>
                        <p>Send payloads or simulate an anomaly burst.</p>
                      </div>
                      <span className="badge badge--warn">Behavior Guard</span>
                    </div>
                    <div className="form form--tight">
                      <label>
                        Payload Size
                        <input
                          type="number"
                          min="1"
                          value={forms.payloadSize}
                          onChange={(e) => updateForm('payloadSize', e.target.value)}
                        />
                      </label>
                      <label>
                        Metric Value
                        <input
                          type="number"
                          step="0.1"
                          value={forms.metricValue}
                          onChange={(e) => updateForm('metricValue', e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="card__actions">
                      <button className="btn btn--primary" onClick={() => sendTelemetry()} disabled={loading.telemetry}>
                        {loading.telemetry ? 'Sending...' : 'Send Telemetry'}
                      </button>
                      <button className="btn btn--ghost" onClick={sendBurst} disabled={loading.burst}>
                        {loading.burst ? 'Bursting...' : 'Send Burst'}
                      </button>
                      <button
                        className="btn btn--danger"
                        onClick={() => sendTelemetry(2000)}
                        disabled={loading.telemetry}
                      >
                        Trigger Anomaly
                      </button>
                    </div>
                    <p className="hint">
                      A payload size over 1000 or more than 10 requests per minute triggers a revocation.
                    </p>
                  </div>

                  <div className="card card--log">
                    <div className="card__header">
                      <div>
                        <h2>Live Activity</h2>
                        <p>Most recent events from the gateway and services.</p>
                      </div>
                      <span className="badge badge--cool">Last 12</span>
                    </div>
                    <div className="log">
                      {logs.length === 0 ? (
                        <div className="log__empty">No activity yet. Run a registration or auth request.</div>
                      ) : (
                        logs.map((entry) => (
                          <div className={`log__item log__item--${entry.type}`} key={entry.id}>
                            <div>
                              <div className="log__title">{entry.title}</div>
                              <div className="log__detail">{entry.detail}</div>
                            </div>
                            <div className="log__meta">
                              <span>{entry.time}</span>
                              {entry.payload ? <code>{JSON.stringify(entry.payload)}</code> : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </>
            }
          />
          <Route
            path="/network"
            element={
              <NetworkView
                logs={logs}
                endpointSummary={endpointSummary}
                token={token}
                forms={forms}
                config={config}
              />
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
