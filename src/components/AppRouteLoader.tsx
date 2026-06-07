export default function AppRouteLoader() {
  return (
    <div className="app-loader" role="status" aria-live="polite" aria-label="Грузим колоду">
      <div className="app-loader-deck nav-shuffling" aria-hidden="true">
        <span className="app-loader-card" />
        <span className="app-loader-card" />
        <span className="app-loader-card" />
        <span className="app-loader-card" />
      </div>
      <div className="app-loader-copy">
        <div className="app-loader-text">
          <span className="app-loader-label">Грузим колоду</span>
          <span className="app-loader-dots" aria-hidden="true">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      </div>
    </div>
  )
}
