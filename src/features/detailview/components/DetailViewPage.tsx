import { useMemo, type JSX } from 'react';
import { splitTopic } from '../../../domain/messages/topicPath';
import { useDetailTopicController } from '../hooks/useDetailTopicController';
import { DetailValueTable } from './DetailValueTable';

interface DetailViewPageProps {
  topic: string;
  onBackToOverview: () => void;
}

/**
 * Renders the detail page shell with original-like layout.
 * Content-wise only the value table is implemented for now.
 * @param props Component props.
 * @returns {JSX.Element} Detail page.
 */
export function DetailViewPage(props: DetailViewPageProps): JSX.Element {
  const { topic, onBackToOverview } = props;
  const { activeNode, isLoading, error } = useDetailTopicController(topic);

  const topicName = useMemo((): string => {
    return splitTopic(topic).at(-1) ?? topic;
  }, [topic]);

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

      <main className="detail-layout-root">
        <aside className="detail-settings-panel" aria-label="Node settings panel">
          <h3>Node Settings</h3>
          <p>Layout analog zum Original vorbereitet.</p>
        </aside>

        <div className="detail-main-panel">
          <div className="detail-top-row">
            <section className="detail-status-panel" aria-label="Status panel">
              <h3>Status</h3>
              <p>Name: {topicName.length > 0 ? topicName : 'unknown'}</p>
              <p>Thema: {topic.length > 0 ? topic : 'unknown'}</p>
              {isLoading ? <span className="detail-loader" aria-label="Detaildaten werden geladen" /> : null}
              {error ? <p className="error-text">{error}</p> : null}
            </section>

            <section className="detail-chart-panel" aria-label="Line chart panel">
              <h3>Line Chart</h3>
              <p>Layout analog zum Original vorbereitet.</p>
            </section>
          </div>

          <section className="detail-history-panel" aria-label="History panel">
            <DetailValueTable activeNode={activeNode} />
          </section>
        </div>
      </main>
    </section>
  );
}
