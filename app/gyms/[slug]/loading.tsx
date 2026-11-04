export default function Loading() {
  return (
    <div className="gym-loading" role="status" aria-label="Loading this gym">
      <span className="sk gym-loading-hero" />
      <div className="gym-loading-sheet">
        <span className="sk" style={{ height: 22, width: '56%' }} />
        <span className="sk" style={{ height: 300, borderRadius: 32 }} />
      </div>
    </div>
  );
}
