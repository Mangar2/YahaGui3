import type { JSX } from 'react';
import type { RulePath } from '../../../domain/rules/interfaces';

interface RulesBreadcrumbProps {
  path: RulePath;
  onNavigateToDepth: (depth: number) => void;
}

/**
 * Breadcrumb for the Rules hierarchy.
 * Mirrors the standard breadcrumb layout but uses a rules icon.
 * @param props Component props.
 * @returns {JSX.Element} Rules breadcrumb.
 */
export function RulesBreadcrumb(props: RulesBreadcrumbProps): JSX.Element {
  const { path, onNavigateToDepth } = props;
  const segments = path.chunks;

  return (
    <nav className="rules-breadcrumb breadcrumb" aria-label="Rules Struktur">
      <button
        className="rules-breadcrumb-home breadcrumb-home"
        type="button"
        aria-label="Rules root"
        onClick={(): void => {
          onNavigateToDepth(0);
        }}
      >
        <svg className="rules-breadcrumb-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z" />
          <path d="M18 6.5 20.5 9 18 11.5 16.5 10l1-1-1-1 1-1z" />
        </svg>
      </button>

      {segments.map((segment: string, index: number): JSX.Element => {
        const depth = index + 1;
        const isCurrent = depth === segments.length && path.name === null;
        return (
          <div className="breadcrumb-item" key={`${segment}-${String(depth)}`}>
            <span className="breadcrumb-separator" aria-hidden="true">
              /
            </span>
            <button
              className={isCurrent ? 'breadcrumb-link breadcrumb-link-current' : 'breadcrumb-link'}
              type="button"
              onClick={(): void => {
                onNavigateToDepth(depth);
              }}
            >
              <span className="breadcrumb-label" title={segment}>
                {segment}
              </span>
            </button>
          </div>
        );
      })}

      {path.name !== null ? (
        <div className="breadcrumb-item">
          <span className="breadcrumb-separator" aria-hidden="true">
            /
          </span>
          <span className="rules-breadcrumb-current breadcrumb-link breadcrumb-link-current" title={path.name}>
            {path.name}
          </span>
        </div>
      ) : null}
    </nav>
  );
}
