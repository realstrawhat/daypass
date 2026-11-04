export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-label="Loading your passes">
      <span className="sk" style={{ height: 58, width: '44%' }} />
      <span className="sk" style={{ height: 30, width: '32%' }} />
      <div className="sk-tickets">
        <span className="sk sk-ticket" />
        <span className="sk sk-ticket" />
        <span className="sk sk-ticket" />
      </div>
    </div>
  );
}
