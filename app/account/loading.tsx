export default function Loading() {
  return (
    <div className="route-loading is-narrow" role="status" aria-label="Loading your account">
      <div className="sk-row">
        <span className="sk" style={{ width: 72, height: 72, borderRadius: '50%', flex: 'none' }} />
        <span className="sk" style={{ height: 44, width: '60%' }} />
      </div>
      <div className="sk-stats"><span className="sk" /><span className="sk" /><span className="sk" /></div>
      <span className="sk sk-card" />
      <span className="sk" style={{ height: 180, borderRadius: 22 }} />
    </div>
  );
}
