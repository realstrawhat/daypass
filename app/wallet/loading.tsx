export default function Loading() {
  return (
    <div className="route-loading is-narrow" role="status" aria-label="Loading your wallet">
      <span className="sk" style={{ width: 44, height: 44, borderRadius: '50%' }} />
      <span className="sk" style={{ height: 58, width: '40%' }} />
      <span className="sk" style={{ height: 214, borderRadius: 24 }} />
    </div>
  );
}
