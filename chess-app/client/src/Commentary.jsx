import { useEffect, useRef } from "react";

const FALLBACK_TIMEOUT_MS = 10_000;

function fallbackText(moveSan) {
  return `${moveSan} — commentary is taking a moment.`;
}

export default function Commentary({ entries, pendingSan, onFallback }) {
  const scrollAnchorRef = useRef(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, pendingSan]);

  useEffect(() => {
    if (!pendingSan) return;

    const moveSan = pendingSan;
    const timer = setTimeout(() => {
      onFallback(moveSan, fallbackText(moveSan));
    }, FALLBACK_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [pendingSan, onFallback]);

  const showLoading =
    pendingSan && !entries.some((entry) => entry.moveSan === pendingSan);

  return (
    <aside className="commentary-panel" aria-live="polite">
      <h2>AI Commentary</h2>
      {entries.length === 0 && !showLoading ? (
        <p className="commentary-empty">Make a move to hear the commentary.</p>
      ) : (
        <ul className="commentary-list">
          {entries.map((entry) => (
            <li
              key={`${entry.moveSan}-${entry.timestamp}`}
              className="commentary-item"
            >
              <span className="commentary-move">{entry.moveSan}</span>
              <span
                className={
                  entry.fallback
                    ? "commentary-text commentary-fallback"
                    : "commentary-text"
                }
              >
                {entry.text}
              </span>
            </li>
          ))}
          {showLoading && (
            <li className="commentary-item">
              <span className="commentary-move">{pendingSan}</span>
              <span className="commentary-loading">
                <span className="commentary-spinner" aria-hidden="true" />
                Generating commentary…
              </span>
            </li>
          )}
          <li
            ref={scrollAnchorRef}
            className="commentary-scroll-anchor"
            aria-hidden="true"
          />
        </ul>
      )}
    </aside>
  );
}
