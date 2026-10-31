export default function Loading() {
  return (
    <div className="container" aria-busy="true" aria-live="polite">
      <div className="stack">
        <div
          style={{
            height: 28,
            width: 220,
            borderRadius: 8,
            background: "var(--surface-3)",
          }}
        />
        <div
          style={{
            height: 14,
            width: 360,
            maxWidth: "100%",
            borderRadius: 6,
            background: "var(--surface-3)",
          }}
        />
        <div className="resource-grid" style={{ marginTop: 16 }}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="card"
              style={{
                height: 260,
                background: "var(--surface-2)",
                borderStyle: "dashed",
              }}
            />
          ))}
        </div>
      </div>
      <span className="small muted" style={{ display: "block", marginTop: 16 }}>
        Loading…
      </span>
    </div>
  );
}
