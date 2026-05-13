import type { ChangeEvent, JSX } from 'react';

interface RulePathEditorProps {
  value: string;
  hasSelection: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
}

/**
 * Reduced detail editor for rule path only.
 * @param props Component props.
 * @returns {JSX.Element} Rule path editor.
 */
export function RulePathEditor(props: RulePathEditorProps): JSX.Element {
  const { value, hasSelection, isSaving, error, successMessage, onChange, onSave } = props;

  return (
    <section className="rules-editor" aria-label="Rule Path Editor">
      <h2>Rule Detail</h2>
      <p className="rules-editor-description">Bearbeiten und speichern ist aktuell auf den Rule Path beschraenkt.</p>

      {hasSelection ? (
        <>
          <label className="rules-input-label" htmlFor="rules-path-input">
            Rule Path
          </label>
          <input
            id="rules-path-input"
            className="rules-path-input"
            type="text"
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>): void => {
              onChange(event.currentTarget.value);
            }}
            placeholder="z.B. ground/kitchen/dishwasher/onMorning"
          />

          <button className="rules-save-button" type="button" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Speichere...' : 'Save'}
          </button>
        </>
      ) : (
        <p className="rules-editor-placeholder">Waehle links eine Rule oder fuege "add rule" hinzu.</p>
      )}

      {error ? <p className="rules-editor-error">{error}</p> : null}
      {successMessage ? <p className="rules-editor-success">{successMessage}</p> : null}
    </section>
  );
}
