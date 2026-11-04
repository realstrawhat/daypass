export default function Loading() {
  return (
    <div className="route-loading is-narrow" role="status" aria-label="Loading your inbox">
      <span className="sk" style={{ width: 44, height: 44, borderRadius: '50%' }} />
      <span className="sk" style={{ height: 58, width: '40%' }} />
      {Array.from({ length: 5 }, (_, i) => <span key={i} className="sk" style={{ height: 84, borderRadius: 22 }} />)}
    </div>
  );
}
