import type { ChangeEvent, JSX, SyntheticEvent } from 'react';

interface RulePathEditorProps {
  value: string;
  hasSelection: boolean;
  onChange: (value: string) => void;
}

/**
 * Rules detail editor. Mirrors the original rule-form layout with flex rows and Material-style fields.
 * Action buttons are rendered but not yet wired to logic.
 * @param props Component props.
 * @returns {JSX.Element} Rules detail editor.
 */
export function RulePathEditor(props: RulePathEditorProps): JSX.Element {
  const { value, hasSelection, onChange } = props;
  const ruleName = extractRuleName(value);
  const rulePrefix = extractRulePrefix(value);

  return (
    <section className="rfd-editor" aria-label="Rule Detail Editor">
      {hasSelection ? (
        <form className="rfd-form" onSubmit={preventSubmit}>

          {/* Header bar – grey row with icon+text action buttons */}
          <div className="rfd-header">
            <button className="rfd-btn" type="button">
              <svg className="rfd-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H5C3.89 3 3 3.9 3 5v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
              save
            </button>
            <button className="rfd-btn" type="button">
              <svg className="rfd-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              delete
            </button>
            <button className="rfd-btn" type="button">
              <svg className="rfd-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
              reload
            </button>
            <button className="rfd-btn" type="button">
              <svg className="rfd-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
              copy
            </button>
            <button className="rfd-btn" type="button" aria-pressed="false">
              <svg className="rfd-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>
              unfold
            </button>
          </div>

          {/* Row 1: rule path + rule name */}
          <div className="rfd-row">
            <div className="rfd-field rfd-field-small">
              <label className="rfd-label" htmlFor="rfd-path">rule path</label>
              <input
                id="rfd-path"
                className="rfd-input"
                type="text"
                value={rulePrefix}
                onChange={(event: ChangeEvent<HTMLInputElement>): void => {
                  const name = extractRuleName(value);
                  const sep = event.currentTarget.value.length > 0 && name.length > 0 ? '/' : '';
                  onChange(`${event.currentTarget.value}${sep}${name}`);
                }}
              />
            </div>
            <div className="rfd-field rfd-field-small">
              <label className="rfd-label" htmlFor="rfd-name">rule name</label>
              <input
                id="rfd-name"
                className="rfd-input"
                type="text"
                value={ruleName}
                onChange={(event: ChangeEvent<HTMLInputElement>): void => {
                  const sep = rulePrefix.length > 0 && event.currentTarget.value.length > 0 ? '/' : '';
                  onChange(`${rulePrefix}${sep}${event.currentTarget.value}`);
                }}
              />
            </div>
          </div>

          {/* Row 2: Checkboxes */}
          <div className="rfd-row rfd-row-checks">
            <label className="rfd-check">
              <input type="checkbox" defaultChecked />
              <span>Enabled</span>
            </label>
            <label className="rfd-check">
              <input type="checkbox" />
              <span>Logging</span>
            </label>
            <label className="rfd-check rfd-check-disabled">
              <input type="checkbox" disabled />
              <span>Is Valid</span>
            </label>
          </div>

          {/* Row 3: Time (large) + Day of Week */}
          <div className="rfd-row">
            <div className="rfd-field rfd-field-large">
              <label className="rfd-label" htmlFor="rfd-time">Time</label>
              <textarea id="rfd-time" className="rfd-textarea" rows={3} placeholder="z.B. 06:30-08:30" />
            </div>
            <div className="rfd-field rfd-field-small">
              <label className="rfd-label" htmlFor="rfd-weekdays">Day of Week</label>
              <select id="rfd-weekdays" className="rfd-select-multi" multiple size={7} defaultValue={[] as string[]}>
                <option value="Mon">Mon</option>
                <option value="Tue">Tue</option>
                <option value="Wed">Wed</option>
                <option value="Thu">Thu</option>
                <option value="Fri">Fri</option>
                <option value="Sat">Sat</option>
                <option value="Sun">Sun</option>
              </select>
            </div>
          </div>

          {/* Row 4: Timing small inputs + QoS */}
          <div className="rfd-row">
            <div className="rfd-field rfd-field-small">
              <label className="rfd-label" htmlFor="rfd-duration">Duration</label>
              <input id="rfd-duration" className="rfd-input" type="text" />
            </div>
            <div className="rfd-field rfd-field-small">
              <label className="rfd-label" htmlFor="rfd-cooldown">Cooldown (s)</label>
              <input id="rfd-cooldown" className="rfd-input" type="text" />
            </div>
            <div className="rfd-field rfd-field-small">
              <label className="rfd-label" htmlFor="rfd-delay">Delay (s)</label>
              <input id="rfd-delay" className="rfd-input" type="text" />
            </div>
            <div className="rfd-field rfd-field-small">
              <label className="rfd-label" htmlFor="rfd-mov-dur">Duration w.o. mov. in min.</label>
              <input id="rfd-mov-dur" className="rfd-input" type="text" />
            </div>
            <div className="rfd-field rfd-field-small">
              <label className="rfd-label" htmlFor="rfd-qos">Quality of Service</label>
              <select id="rfd-qos" className="rfd-select" defaultValue="0">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>
          </div>

          {/* Full-width textareas */}
          {RFD_TEXTAREA_FIELDS.map((field: RfdTextareaField): JSX.Element => (
            <div key={field.name} className="rfd-field rfd-field-full">
              <label className="rfd-label" htmlFor={`rfd-${field.name}`}>{field.label}</label>
              <textarea
                id={`rfd-${field.name}`}
                className="rfd-textarea"
                rows={3}
                readOnly={field.readonly === true}
              />
            </div>
          ))}

        </form>
      ) : (
        <p className="rfd-placeholder">Waehle links eine Rule oder fuege &ldquo;add rule&rdquo; hinzu.</p>
      )}
    </section>
  );
}

interface RfdTextareaField {
  name: string;
  label: string;
  readonly?: boolean;
}

const RFD_TEXTAREA_FIELDS: RfdTextareaField[] = [
  { name: 'allOf',   label: 'All Of' },
  { name: 'anyOf',   label: 'Any Of' },
  { name: 'allow',   label: 'Allow' },
  { name: 'noneOf',  label: 'None Of' },
  { name: 'check',   label: 'Check' },
  { name: 'value',   label: 'Value' },
  { name: 'topic',   label: 'Topic' },
  { name: 'errors',  label: 'Errors', readonly: true },
];

/**
 * Prevents browser form-submit navigation.
 * @param event Native form event.
 */
function preventSubmit(event: SyntheticEvent<HTMLFormElement>): void {
  event.preventDefault();
}

/**
 * Returns the last path segment as rule name.
 * @param pathValue Full rule path.
 * @returns {string} Rule name (last segment).
 */
function extractRuleName(pathValue: string): string {
  const chunks = splitPath(pathValue);
  return chunks.at(-1) ?? '';
}

/**
 * Returns all segments except the last as prefix path.
 * @param pathValue Full rule path.
 * @returns {string} Prefix (all segments except last).
 */
function extractRulePrefix(pathValue: string): string {
  const chunks = splitPath(pathValue);
  return chunks.slice(0, -1).join('/');
}

/**
 * Splits a rule path string into non-empty segments.
 * @param pathValue Raw path value.
 * @returns {string[]} Non-empty path segments.
 */
function splitPath(pathValue: string): string[] {
  return pathValue
    .split('/')
    .map((s: string): string => s.trim())
    .filter((s: string): boolean => s.length > 0);
}
