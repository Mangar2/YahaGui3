import type { JSX } from 'react';

interface MessagePathBreadcrumbProps {
  topicChunks: string[];
  onNavigate: (depth: number) => void;
}

/**
 * Renders the current topic path as clickable breadcrumb navigation.
 * @param props Component props.
 * @returns {JSX.Element} Breadcrumb view.
 */
export function MessagePathBreadcrumb(props: MessagePathBreadcrumbProps): JSX.Element {
  const { topicChunks, onNavigate } = props;

  return (
    <nav className="breadcrumb" aria-label="Aktueller Message-Pfad">
      <button
        className="breadcrumb-home"
        type="button"
        onClick={(): void => {
          onNavigate(0);
        }}
        aria-label="Home"
      >
        <svg className="breadcrumb-home-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3 3 10v11h7v-7h4v7h7V10l-9-7z" />
        </svg>
      </button>
      {topicChunks.map((chunk: string, index: number): JSX.Element => {
        const depth = index + 1;
        const isCurrent = depth === topicChunks.length;
        return (
          <div className="breadcrumb-item" key={`${chunk}-${String(depth)}`}>
            <span className="breadcrumb-separator" aria-hidden="true">
              /
            </span>
            <button
              className={isCurrent ? 'breadcrumb-link breadcrumb-link-current' : 'breadcrumb-link'}
              type="button"
              onClick={(): void => {
                onNavigate(depth);
              }}
              aria-current={isCurrent ? 'page' : undefined}
            >
              <span className="breadcrumb-label" title={chunk}>
                {chunk}
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
