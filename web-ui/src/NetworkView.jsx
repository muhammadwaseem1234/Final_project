import { useMemo } from 'react'

const resolveActivity = (logs) => {
  const latest = logs[0]
  if (!latest) {
    return { flow: 'idle', label: 'Awaiting activity', time: '--:--' }
  }

  const title = latest.title?.toLowerCase() ?? ''
  const detail = latest.detail?.toLowerCase() ?? ''
  const isAnomaly = latest.type === 'warning' || detail.includes('anomaly')
  const isAuth = title.includes('authentication')
  const isAuthError = isAuth && (latest.type === 'error' || detail.includes('failed') || detail.includes('revoked'))

  if (title.includes('register')) {
    return { flow: 'register', label: 'Registration commitment stored', time: latest.time }
  }

  if (isAuth) {
    if (detail.includes('revoked')) {
      return { flow: 'revoked', label: 'Authentication blocked: device revoked', time: latest.time }
    }
    if (isAuthError) {
      return { flow: 'auth-fail', label: 'Authentication rejected', time: latest.time }
    }
    return { flow: 'auth', label: 'Authentication handshake completed', time: latest.time }
  }

  if (title.includes('telemetry')) {
    return {
      flow: isAnomaly ? 'anomaly' : 'telemetry',
      label: isAnomaly ? 'Anomaly flagged in telemetry stream' : 'Telemetry accepted by gateway',
      time: latest.time
    }
  }

  return { flow: 'idle', label: 'Monitoring network', time: latest.time }
}

const NetworkView = ({ logs, endpointSummary, token, forms, config }) => {
  const activity = useMemo(() => resolveActivity(logs), [logs])
  const recent = logs.slice(0, 6)
  const status = useMemo(() => {
    const revoked = logs.find(
      (entry) =>
        entry?.detail?.toLowerCase().includes('revoked') ||
        entry?.title?.toLowerCase().includes('revoke')
    )
    if (revoked) return 'REVOKED'
    const authSuccess = logs.find(
      (entry) => entry?.title?.toLowerCase().includes('authentication success') && entry?.type === 'success'
    )
    if (authSuccess) return 'ACTIVE'
    const registered = logs.find((entry) => entry?.title?.toLowerCase().includes('device registered'))
    if (registered) return 'REGISTERED'
    return 'UNKNOWN'
  }, [logs])

  const activeNodes = useMemo(() => {
    switch (activity.flow) {
      case 'register':
        return ['device', 'auth', 'ledger']
      case 'auth':
        return ['device', 'gateway', 'auth']
      case 'auth-fail':
        return ['device', 'gateway', 'auth']
      case 'revoked':
        return ['device', 'gateway', 'auth', 'ledger']
      case 'telemetry':
        return ['device', 'gateway', 'behavior']
      case 'anomaly':
        return ['device', 'gateway', 'behavior', 'ledger']
      default:
        return []
    }
  }, [activity.flow])

  const activeLines = useMemo(() => {
    switch (activity.flow) {
      case 'register':
        return ['device-auth', 'auth-ledger']
      case 'auth':
        return ['device-gateway', 'gateway-auth']
      case 'auth-fail':
        return ['device-gateway', 'gateway-auth']
      case 'revoked':
        return ['device-gateway', 'gateway-auth', 'auth-ledger']
      case 'telemetry':
        return ['device-gateway', 'gateway-behavior']
      case 'anomaly':
        return ['device-gateway', 'gateway-behavior', 'behavior-ledger']
      default:
        return []
    }
  }, [activity.flow])

  const lastToken = token ? `${token.slice(0, 28)}...` : 'No token issued yet'

  return (
    <section className="network">
      <header className="network__hero">
        <div>
          <p className="eyebrow">Network Visualization</p>
          <h1>Live trust graph for every device interaction.</h1>
          <p className="lead">
            Watch the gateway coordinate identity checks, behavior analytics, and ledger commitments in real time.
            Run actions from the Console to see the flow light up here.
          </p>
        </div>
        <div className="network__stats">
          <div className="stat">
            <span className="stat__label">Current flow</span>
            <span className="stat__value">{activity.label}</span>
            <span className="stat__meta">{activity.time}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Active device</span>
            <span className="stat__value">{forms.deviceId}</span>
            <span className="stat__meta">Gateway: {config.gatewayUrl}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Device status</span>
            <span className={`stat__value stat__value--${status.toLowerCase()}`}>{status}</span>
            <span className="stat__meta">Auth service: {config.authUrl}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Latest token</span>
            <span className="stat__value">{lastToken}</span>
            <span className="stat__meta">Behavior: {config.behaviorUrl}</span>
          </div>
        </div>
      </header>

      <div className="network__layout">
        <div className="network__canvas">
          <svg className="network__lines" viewBox="0 0 800 420" aria-hidden="true">
            <line
              className={`network__line ${activeLines.includes('device-gateway') ? 'network__line--active' : ''}`}
              x1="140"
              y1="240"
              x2="360"
              y2="140"
            />
            <line
              className={`network__line ${activeLines.includes('gateway-auth') ? 'network__line--active' : ''}`}
              x1="360"
              y1="140"
              x2="560"
              y2="120"
            />
            <line
              className={`network__line ${activeLines.includes('gateway-behavior') ? 'network__line--active' : ''}`}
              x1="360"
              y1="140"
              x2="560"
              y2="260"
            />
            <line
              className={`network__line ${activeLines.includes('auth-ledger') ? 'network__line--active' : ''}`}
              x1="560"
              y1="120"
              x2="680"
              y2="190"
            />
            <line
              className={`network__line ${activeLines.includes('behavior-ledger') ? 'network__line--active' : ''}`}
              x1="560"
              y1="260"
              x2="680"
              y2="190"
            />
          </svg>

          <div
            className={`node node--device ${activeNodes.includes('device') ? 'node--active' : ''} ${
              status === 'REVOKED' ? 'node--revoked' : ''
            }`}
          >
            <span className="node__title">Device</span>
            <span className="node__subtitle">Edge sensor</span>
          </div>
          <div className={`node node--gateway ${activeNodes.includes('gateway') ? 'node--active' : ''}`}>
            <span className="node__title">Gateway</span>
            <span className="node__subtitle">Request broker</span>
          </div>
          <div className={`node node--auth ${activeNodes.includes('auth') ? 'node--active' : ''}`}>
            <span className="node__title">Auth Service</span>
            <span className="node__subtitle">ZKP verifier</span>
          </div>
          <div className={`node node--behavior ${activeNodes.includes('behavior') ? 'node--active' : ''}`}>
            <span className="node__title">Behavior AI</span>
            <span className="node__subtitle">Anomaly guard</span>
          </div>
          <div className={`node node--ledger ${activeNodes.includes('ledger') ? 'node--active' : ''}`}>
            <span className="node__title">Ledger</span>
            <span className="node__subtitle">Commitments</span>
          </div>
        </div>

        <aside className="network__side">
          <div className="panel panel--light">
            <h3>Service Endpoints</h3>
            <p className="panel__desc">Synced from the console configuration.</p>
            <div className="panel__list">
              {endpointSummary.map((item) => (
                <div className="panel__item" key={item.label}>
                  <span>{item.label}</span>
                  <code>{item.value}</code>
                </div>
              ))}
            </div>
          </div>

          <div className="card card--activity">
            <div className="card__header">
              <div>
                <h2>Activity Pulse</h2>
                <p>Last six events across the network.</p>
              </div>
              <span className="badge badge--cool">{recent.length}</span>
            </div>
            <div className="activity">
              {recent.length === 0 ? (
                <div className="log__empty">No activity yet. Trigger a flow from the Console.</div>
              ) : (
                recent.map((entry) => (
                  <div className={`activity__item activity__item--${entry.type}`} key={entry.id}>
                    <div>
                      <div className="activity__title">{entry.title}</div>
                      <div className="activity__detail">{entry.detail}</div>
                    </div>
                    <span className="activity__time">{entry.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default NetworkView
