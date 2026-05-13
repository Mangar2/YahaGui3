import { useEffect, useRef, useState, type JSX } from 'react';
import type { RulesLoadResult } from '../../../domain/rules/interfaces';
import { RulesConfigClient } from '../../../infrastructure/rules/rulesConfigClient';
import '../styles/rules.css';

interface RulesPageProps {
  baseUrl: string;
  configPath: string;
}

/**
 * Rules page for managing automation rules.
 * Displays loaded rules and provides editing capabilities.
 * @param props Component props with configuration endpoints.
 * @returns {JSX.Element} Rules management page.
 */
export function RulesPage(props: RulesPageProps): JSX.Element {
  const { baseUrl, configPath } = props;
  const rulesClientRef = useRef<RulesConfigClient>(new RulesConfigClient(baseUrl, configPath));
  const [loadResult, setLoadResult] = useState<RulesLoadResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect((): void => {
    /**
     * Loads rules when component mounts.
     */
    async function loadRules(): Promise<void> {
      setIsLoading(true);
      const result = await rulesClientRef.current.loadRules();
      setLoadResult(result);
      setIsLoading(false);
    }

    void loadRules();
  }, []);

  return (
    <section className="rules-page">
      <div className="rules-container">
        <h1>Automation Rules</h1>

        {isLoading ? (
          <div className="rules-loading">
            <span className="rules-loader" aria-label="Rules werden geladen" />
            <p>Laden...</p>
          </div>
        ) : loadResult?.success && loadResult.ruleCount >= 0 ? (
          <div className="rules-summary">
            <p className="rules-count">
              <strong>{loadResult.ruleCount}</strong> Regel{loadResult.ruleCount !== 1 ? 'n' : ''} geladen
            </p>
          </div>
        ) : (
          <div className="rules-error">
            <p className="error-text">{loadResult?.error ?? 'Fehler beim Laden der Rules'}</p>
          </div>
        )}
      </div>
    </section>
  );
}
