import type { JSX } from 'react';

interface MessagePathBreadcrumbProps {
  topicChunks: string[];
  onNavigate: (depth: number) => void;
}

/**
 * Renders the current topic path as clickable breadcrumb navigation.
 * @param props Component props.
 * @returns Breadcrumb view.
 */
export function MessagePathBreadcrumb(props: MessagePathBreadcrumbProps): JSX.Element {
  const { topicChunks, onNavigate } = props;

  return (
    <nav className="breadcrumb" aria-label="Aktueller Message-Pfad">
      <button className="breadcrumb-home" type="button" onClick={(): void => onNavigate(0)}>
        home
      </button>
      {topicChunks.map((chunk: string, index: number): JSX.Element => {
        const depth = index + 1;
        return (
          <div className="breadcrumb-item" key={`${chunk}-${depth}`}>
            <span aria-hidden="true">/</span>
            <button className="breadcrumb-link" type="button" onClick={(): void => onNavigate(depth)}>
              {chunk}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
