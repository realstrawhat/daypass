export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-label="Loading">
      <span className="sk sk-line" style={{ height: 56, width: '60%' }} />
      <span className="sk sk-card" />
      <span className="sk sk-card" style={{ height: 112 }} />
      <span className="sk sk-card" style={{ height: 112 }} />
    </div>
  );
}
