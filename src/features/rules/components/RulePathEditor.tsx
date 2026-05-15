import { useMemo, useState, type ChangeEvent, type JSX, type SyntheticEvent } from 'react';
import type { RuleEditorField, RuleEditorState } from '../hooks/useRulesController';

interface RulePathEditorProps {
  editorState: RuleEditorState | null;
  hasSelection: boolean;
  isSaving: boolean;
  saveError: string | null;
  saveSuccessMessage: string | null;
  onFieldChange: (field: RuleEditorField, value: string | boolean | string[]) => void;
  onSave: () => void;
  onDelete: () => void;
  onReload: () => void;
  onCopy: () => void;
  onTrace: () => void;
}

interface RulePathRowProps {
  editorState: RuleEditorState | null;
  onFieldChange: (field: RuleEditorField, value: string | boolean | string[]) => void;
}

interface RuleChecksRowProps {
  editorState: RuleEditorState | null;
  onFieldChange: (field: RuleEditorField, value: string | boolean | string[]) => void;
}

interface RuleTimeRowProps {
  editorState: RuleEditorState | null;
  weekdaySummary: string;
  onFieldChange: (field: RuleEditorField, value: string | boolean | string[]) => void;
}

interface RuleTimingRowProps {
  editorState: RuleEditorState | null;
  onFieldChange: (field: RuleEditorField, value: string | boolean | string[]) => void;
}

interface RuleTextareasProps {
  editorState: RuleEditorState | null;
  fields: RfdTextareaField[];
  onFieldChange: (field: RuleEditorField, value: string | boolean | string[]) => void;
}

/**
 * Rules detail editor with full rule field binding.
 * @param props Component props.
 * @returns {JSX.Element} Rules detail editor.
 */
export function RulePathEditor(props: RulePathEditorProps): JSX.Element {
  const {
    editorState,
    hasSelection,
    isSaving,
    saveError,
    saveSuccessMessage,
    onFieldChange,
    onSave,
    onDelete,
    onReload,
    onCopy,
    onTrace,
  } = props;
  const [isFolded, setIsFolded] = useState<boolean>(true);

  const weekdaySummary = useMemo((): string => {
    const selectedWeekdays = editorState?.weekdays ?? [];
    return selectedWeekdays.length > 0 ? selectedWeekdays.join(', ') : 'Bitte waehlen';
  }, [editorState?.weekdays]);

  const visibleTextareaFields = useMemo((): RfdTextareaField[] => {
    if (!isFolded) {
      return RFD_TEXTAREA_FIELDS;
    }

    return RFD_TEXTAREA_FIELDS.filter((field: RfdTextareaField): boolean => {
      return hasTextareaValue(editorState?.[field.name] ?? '');
    });
  }, [editorState, isFolded]);

  if (!hasSelection) {
    return (
      <section className="rfd-editor" aria-label="Rule Detail Editor">
        <p className="rfd-placeholder">Waehle links eine Rule oder fuege &ldquo;add rule&rdquo; hinzu.</p>
      </section>
    );
  }

  return (
    <section className="rfd-editor" aria-label="Rule Detail Editor">
      <form className="rfd-form" onSubmit={preventSubmit}>
        <RuleHeader
          isSaving={isSaving}
          isFolded={isFolded}
          onSave={onSave}
          onDelete={onDelete}
          onReload={onReload}
          onCopy={onCopy}
          onTrace={onTrace}
          onToggleFold={(): void => {
            setIsFolded((current: boolean): boolean => !current);
          }}
        />
        <RulePathRow editorState={editorState} onFieldChange={onFieldChange} />
        <RuleChecksRow editorState={editorState} onFieldChange={onFieldChange} />
        <RuleTimeRow editorState={editorState} weekdaySummary={weekdaySummary} onFieldChange={onFieldChange} />
        <RuleTimingRow editorState={editorState} onFieldChange={onFieldChange} />
        <RuleTextareas editorState={editorState} fields={visibleTextareaFields} onFieldChange={onFieldChange} />
        {saveError ? <p className="rfd-message rfd-message-error">{saveError}</p> : null}
        {saveSuccessMessage ? <p className="rfd-message rfd-message-success">{saveSuccessMessage}</p> : null}
      </form>
    </section>
  );
}

/**
 * Renders action buttons for rule actions.
 * @param props Header properties.
 * @param props.isSaving Indicates pending save state.
 * @param props.isFolded Indicates whether textarea section is folded.
 * @param props.onSave Save callback.
 * @param props.onDelete Delete callback.
 * @param props.onReload Reload callback.
 * @param props.onCopy Copy callback.
 * @param props.onToggleFold Fold state toggle callback.
 * @returns {JSX.Element} Header row.
 */
function RuleHeader(props: {
  isSaving: boolean;
  isFolded: boolean;
  onSave: () => void;
  onDelete: () => void;
  onReload: () => void;
  onCopy: () => void;
  onTrace: () => void;
  onToggleFold: () => void;
}): JSX.Element {
  const { isSaving, isFolded, onSave, onDelete, onReload, onCopy, onTrace, onToggleFold } = props;

  return (
    <div className="rfd-header">
      <button className="rfd-btn" type="button" onClick={onSave} disabled={isSaving}>
        <svg className="rfd-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H5C3.89 3 3 3.9 3 5v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
        save
      </button>
      <button className="rfd-btn" type="button" onClick={onDelete} disabled={isSaving}>
        <svg className="rfd-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        delete
      </button>
      <button className="rfd-btn" type="button" onClick={onReload} disabled={isSaving}>
        <svg className="rfd-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
        reload
      </button>
      <button className="rfd-btn" type="button" onClick={onCopy} disabled={isSaving}>
        <svg className="rfd-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        copy
      </button>
      <button className="rfd-btn" type="button" onClick={onTrace} disabled={isSaving}>
        <svg className="rfd-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
        trace
      </button>
      <button className="rfd-btn" type="button" aria-pressed={!isFolded} onClick={onToggleFold}>
        <svg className="rfd-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>
        {isFolded ? 'unfold' : 'fold'}
      </button>
    </div>
  );
}

/**
 * Renders path fields.
 * @param props Row properties.
 * @returns {JSX.Element} Path row.
 */
function RulePathRow(props: RulePathRowProps): JSX.Element {
  const { editorState, onFieldChange } = props;

  return (
    <div className="rfd-row">
      <div className="rfd-field rfd-field-small">
        <label className="rfd-label" htmlFor="rfd-path">rule path</label>
        <input
          id="rfd-path"
          className="rfd-input"
          type="text"
          value={editorState?.prefix ?? ''}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => {
            onFieldChange('prefix', event.currentTarget.value);
          }}
        />
      </div>
      <div className="rfd-field rfd-field-small">
        <label className="rfd-label" htmlFor="rfd-name">rule name</label>
        <input
          id="rfd-name"
          className="rfd-input"
          type="text"
          value={editorState?.name ?? ''}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => {
            onFieldChange('name', event.currentTarget.value);
          }}
        />
      </div>
    </div>
  );
}

/**
 * Renders enabled/logging/valid checkboxes.
 * @param props Row properties.
 * @returns {JSX.Element} Checkbox row.
 */
function RuleChecksRow(props: RuleChecksRowProps): JSX.Element {
  const { editorState, onFieldChange } = props;

  return (
    <div className="rfd-row rfd-row-checks">
      <label className="rfd-check">
        <input
          type="checkbox"
          checked={editorState?.active ?? true}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => {
            onFieldChange('active', event.currentTarget.checked);
          }}
        />
        <span>Enabled</span>
      </label>
      <label className="rfd-check">
        <input
          type="checkbox"
          checked={editorState?.doLog ?? false}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => {
            onFieldChange('doLog', event.currentTarget.checked);
          }}
        />
        <span>Logging</span>
      </label>
      <label className="rfd-check rfd-check-disabled">
        <input type="checkbox" checked={editorState?.isValid ?? false} disabled readOnly />
        <span>Is Valid</span>
      </label>
    </div>
  );
}

/**
 * Renders time, weekdays and qos fields.
 * @param props Row properties.
 * @returns {JSX.Element} Time row.
 */
function RuleTimeRow(props: RuleTimeRowProps): JSX.Element {
  const { editorState, weekdaySummary, onFieldChange } = props;
  const selectedWeekdays = editorState?.weekdays ?? [];

  return (
    <div className="rfd-row">
      <div className="rfd-field rfd-field-large">
        <label className="rfd-label" htmlFor="rfd-time">Time</label>
        <textarea
          id="rfd-time"
          className="rfd-textarea rfd-textarea-time"
          rows={3}
          value={editorState?.time ?? ''}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => {
            onFieldChange('time', event.currentTarget.value);
          }}
        />
      </div>
      <div className="rfd-field rfd-field-small">
        <span className="rfd-label" id="rfd-weekdays-label">Day of Week</span>
        <details className="rfd-multi" role="group" aria-labelledby="rfd-weekdays-label">
          <summary className="rfd-multi-summary">{weekdaySummary}</summary>
          <div className="rfd-multi-menu" role="listbox" aria-multiselectable="true">
            {RFD_WEEKDAY_OPTIONS.map((weekday: string): JSX.Element => {
              const isChecked = selectedWeekdays.includes(weekday);
              return (
                <label key={weekday} className="rfd-multi-option">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(event: ChangeEvent<HTMLInputElement>): void => {
                      const nextSelection = event.currentTarget.checked
                        ? appendWeekday(selectedWeekdays, weekday)
                        : selectedWeekdays.filter((entry: string): boolean => entry !== weekday);
                      onFieldChange('weekdays', nextSelection);
                    }}
                  />
                  <span>{weekday}</span>
                </label>
              );
            })}
          </div>
        </details>
      </div>
      <div className="rfd-field rfd-field-qos">
        <label className="rfd-label" htmlFor="rfd-qos">Quality of Service</label>
        <select
          id="rfd-qos"
          className="rfd-select"
          value={editorState?.qos ?? '0'}
          onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
            onFieldChange('qos', event.currentTarget.value);
          }}
        >
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
      </div>
    </div>
  );
}

/**
 * Renders numeric timing fields.
 * @param props Row properties.
 * @returns {JSX.Element} Timing row.
 */
function RuleTimingRow(props: RuleTimingRowProps): JSX.Element {
  const { editorState, onFieldChange } = props;

  return (
    <div className="rfd-row">
      <RuleInputField
        id="rfd-duration"
        label="Duration"
        value={editorState?.duration ?? ''}
        onChange={(value: string): void => {
          onFieldChange('duration', value);
        }}
      />
      <RuleInputField
        id="rfd-cooldown"
        label="Cooldown (s)"
        value={editorState?.cooldownInSeconds ?? ''}
        inputType="number"
        onChange={(value: string): void => {
          onFieldChange('cooldownInSeconds', value);
        }}
      />
      <RuleInputField
        id="rfd-delay"
        label="Delay (s)"
        value={editorState?.delayInSeconds ?? ''}
        inputType="number"
        onChange={(value: string): void => {
          onFieldChange('delayInSeconds', value);
        }}
      />
      <RuleInputField
        id="rfd-mov-dur"
        label="Duration w.o. mov. in min."
        value={editorState?.durationWithoutMovementInMinutes ?? ''}
        inputType="number"
        onChange={(value: string): void => {
          onFieldChange('durationWithoutMovementInMinutes', value);
        }}
      />
    </div>
  );
}

/**
 * Renders textarea fields.
 * @param props Section properties.
 * @returns {JSX.Element} Textarea section.
 */
function RuleTextareas(props: RuleTextareasProps): JSX.Element {
  const { editorState, fields, onFieldChange } = props;

  return (
    <>
      {fields.map((field: RfdTextareaField): JSX.Element => (
        <div key={field.name} className="rfd-field rfd-field-full">
          <label className="rfd-label" htmlFor={`rfd-${field.name}`}>{field.label}</label>
          <textarea
            id={`rfd-${field.name}`}
            className="rfd-textarea"
            rows={3}
            readOnly={field.readonly === true}
            value={editorState?.[field.name] ?? ''}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => {
              onFieldChange(field.name, event.currentTarget.value);
            }}
          />
        </div>
      ))}
    </>
  );
}

interface RuleInputFieldProps {
  id: string;
  label: string;
  value: string;
  inputType?: 'text' | 'number';
  onChange: (value: string) => void;
}

/**
 * Renders one text/number input field in the timing row.
 * @param props Input field properties.
 * @returns {JSX.Element} Input field.
 */
function RuleInputField(props: RuleInputFieldProps): JSX.Element {
  const { id, label, value, inputType = 'text', onChange } = props;

  return (
    <div className="rfd-field rfd-field-small">
      <label className="rfd-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="rfd-input"
        type={inputType}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>): void => {
          onChange(event.currentTarget.value);
        }}
      />
    </div>
  );
}

interface RfdTextareaField {
  name: 'allOf' | 'anyOf' | 'allow' | 'noneOf' | 'check' | 'value' | 'topic' | 'errors';
  label: string;
  readonly?: boolean;
}

const RFD_TEXTAREA_FIELDS: RfdTextareaField[] = [
  { name: 'allOf', label: 'All Of' },
  { name: 'anyOf', label: 'Any Of' },
  { name: 'allow', label: 'Allow' },
  { name: 'noneOf', label: 'None Of' },
  { name: 'check', label: 'Check' },
  { name: 'value', label: 'Value' },
  { name: 'topic', label: 'Topic' },
  { name: 'errors', label: 'Errors', readonly: true },
];

const RFD_WEEKDAY_OPTIONS: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Prevents duplicate weekday insertion while preserving ordering.
 * @param weekdays Current weekdays.
 * @param weekday Weekday to add.
 * @returns {string[]} Updated weekday list.
 */
function appendWeekday(weekdays: string[], weekday: string): string[] {
  if (weekdays.includes(weekday)) {
    return weekdays;
  }
  return [...weekdays, weekday];
}

/**
 * Checks whether one textarea value should be visible in folded mode.
 * @param value Textarea value.
 * @returns {boolean} True when value is non-empty.
 */
function hasTextareaValue(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Prevents browser form-submit navigation.
 * @param event Native form event.
 */
function preventSubmit(event: SyntheticEvent<HTMLFormElement>): void {
  event.preventDefault();
}
