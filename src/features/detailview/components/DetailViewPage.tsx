import type { JSX } from 'react';

interface DetailViewPageProps {
  topic: string;
  onBackToOverview: () => void;
}

/**
 * Placeholder detail page that will be filled in later iterations.
 * @param props Component props.
 * @returns {JSX.Element} Empty detail page shell.
 */
export function DetailViewPage(props: DetailViewPageProps): JSX.Element {
  const { topic, onBackToOverview } = props;

  return (
    <section className="detail-page" aria-live="polite">
      <header className="detail-page-header">
        <button
          type="button"
          className="detail-page-back"
          onClick={(): void => {
            onBackToOverview();
          }}
        >
          Zurueck
        </button>
        <h2>Detailansicht</h2>
      </header>
      <div className="detail-page-empty" aria-label="Leere Detailseite">
        <p>Thema: {topic.length > 0 ? topic : 'unbekannt'}</p>
      </div>
    </section>
  );
}
