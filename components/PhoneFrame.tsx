// Cosmetic device shell — status bar, dynamic island, rounded bezel. Purely
// presentational; it just frames the messaging + keyboard UI as a phone.

export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="stage">
      <div className="phone">
        <div className="island" />
        <div className="status-bar">
          <span>9:41</span>
          <span className="status-right">
            <span aria-hidden>5G</span>
            <span className="battery" aria-label="battery">
              <span />
            </span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
