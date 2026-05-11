import { useEffect, useRef, useState, type JSX } from 'react';
import type { TopicSettingsStore } from '../../../domain/settings/interfaces';
import { useDetailTopicController } from '../hooks/useDetailTopicController';
import { DetailValueTable } from './DetailValueTable';
import { DetailLineChart } from './DetailLineChart';
import { DetailStatusPanel } from './DetailStatusPanel';
import { NodeSettingsForm } from './NodeSettingsForm';

interface DetailViewPageProps {
  topic: string;
  settingsStore: TopicSettingsStore;
  onBackToOverview: () => void;
  onDeferredError: (errorMessage: string) => void;
}

/**
 * Renders the detail page shell with legacy-equivalent node settings and status editing controls.
 * @param props Component props.
 * @returns {JSX.Element} Detail page.
 */
export function DetailViewPage(props: DetailViewPageProps): JSX.Element {
  const { topic, settingsStore, onBackToOverview, onDeferredError } = props;
  const { activeNode, isLoading, isUpdatingTopic, error, publishValueChange } = useDetailTopicController(topic);
  const [settingsRevision, setSettingsRevision] = useState<number>(0);
  const lastNotifiedErrorRef = useRef<string>('');

  useEffect((): void => {
    if (typeof error !== 'string' || error.length === 0) {
      lastNotifiedErrorRef.current = '';
      return;
    }

    if (lastNotifiedErrorRef.current === error) {
      return;
    }

    lastNotifiedErrorRef.current = error;
    onDeferredError(error);
  }, [error, onDeferredError]);

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
          <NodeSettingsForm
            topic={topic}
            settingsStore={settingsStore}
            onSettingsChange={(): void => {
              setSettingsRevision((currentRevision: number): number => currentRevision + 1);
            }}
          />
        </aside>

        <div className="detail-main-panel">
          <div className="detail-top-row">
            <DetailStatusPanel
              topic={topic}
              topicNode={activeNode}
              settingsStore={settingsStore}
              settingsRevision={settingsRevision}
              isUpdatingTopic={isUpdatingTopic}
              onPublishValueChange={publishValueChange}
            />

            <section className="detail-chart-panel" aria-label="Line chart panel">
              <DetailLineChart activeNode={activeNode} />
            </section>
          </div>

          <section className="detail-history-panel" aria-label="History panel">
            {isLoading ? <span className="detail-loader" aria-label="Detaildaten werden geladen" /> : null}
            {error ? <p className="error-text">{error}</p> : null}
            <DetailValueTable activeNode={activeNode} />
          </section>
        </div>
      </main>
    </section>
  );
}
