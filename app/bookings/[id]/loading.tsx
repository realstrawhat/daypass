export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-label="Loading your pass">
      <span className="sk" style={{ width: 44, height: 44, borderRadius: '50%' }} />
      <span className="sk" style={{ width: '100%', maxWidth: 400, aspectRatio: '0.66', borderRadius: 34, margin: '0 auto' }} />
    </div>
  );
}
