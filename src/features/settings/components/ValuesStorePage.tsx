import { useMemo, useState, type JSX } from 'react';
import type { ValueStorePayload, ValueStoreScalar } from '../../../domain/values/interfaces';
import { ValuesStoreClientError, type ValuesStoreClient } from '../../../infrastructure/values/valuesStoreClient';

type ValuesRequestState = 'idle' | 'loading' | 'saving';

type ValueTypeOption = 'string' | 'number' | 'boolean' | 'null';

interface ValuesStoreRow {
  id: string;
  key: string;
  valueText: string;
  valueType: ValueTypeOption;
}

interface ValuesStorePageProps {
  valuesClient: ValuesStoreClient;
}

/**
 * Values-store editor for managing key/value pairs in file-store.
 * @param props Component props.
 * @returns {JSX.Element} Values-store view.
 */
export function ValuesStorePage(props: ValuesStorePageProps): JSX.Element {
  const { valuesClient } = props;

  const [rows, setRows] = useState<ValuesStoreRow[]>([createEmptyRow()]);
  const [requestState, setRequestState] = useState<ValuesRequestState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isLoading = requestState === 'loading';
  const isSaving = requestState === 'saving';
  const isBusy = isLoading || isSaving;

  const nonEmptyRowCount = useMemo<number>(() => {
    return rows.filter((row: ValuesStoreRow): boolean => row.key.trim().length > 0).length;
  }, [rows]);

  /**
   * Loads values from backend file-store and maps them into editable rows.
   * @returns {Promise<void>} Resolves when load flow is complete.
   */
  async function loadValues(): Promise<void> {
    setRequestState('loading');
    setStatusMessage('');
    setErrorMessage('');

    try {
      const payload = await valuesClient.readValues();
      const parsedRows = mapPayloadToRows(payload);
      setRows(parsedRows.length > 0 ? parsedRows : [createEmptyRow()]);
      setStatusMessage(`Values geladen (${String(parsedRows.length)} Eintraege).`);
    } catch (error: unknown) {
      setErrorMessage(formatValuesError(error));
    } finally {
      setRequestState('idle');
    }
  }

  /**
   * Validates and stores current rows as values-store payload.
   * @returns {Promise<void>} Resolves when save flow is complete.
   */
  async function saveValues(): Promise<void> {
    setRequestState('saving');
    setStatusMessage('');
    setErrorMessage('');

    try {
      const payload = buildPayloadFromRows(rows);
      await valuesClient.storeValues(payload);
      setStatusMessage(`Values gespeichert (${String(Object.keys(payload).length)} Eintraege).`);
    } catch (error: unknown) {
      setErrorMessage(formatValuesError(error));
    } finally {
      setRequestState('idle');
    }
  }

  /**
   * Adds one new empty row to the editor.
   */
  function addRow(): void {
    setRows((currentRows: ValuesStoreRow[]): ValuesStoreRow[] => [...currentRows, createEmptyRow()]);
  }

  /**
   * Removes one row by id while keeping at least one editable row.
   * @param rowId Row identifier.
   */
  function removeRow(rowId: string): void {
    setRows((currentRows: ValuesStoreRow[]): ValuesStoreRow[] => {
      const remainingRows = currentRows.filter((row: ValuesStoreRow): boolean => row.id !== rowId);
      return remainingRows.length > 0 ? remainingRows : [createEmptyRow()];
    });
  }

  /**
   * Updates one row key value.
   * @param rowId Row identifier.
   * @param nextKey Updated key.
   */
  function updateRowKey(rowId: string, nextKey: string): void {
    setRows((currentRows: ValuesStoreRow[]): ValuesStoreRow[] => {
      return currentRows.map((row: ValuesStoreRow): ValuesStoreRow => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          key: nextKey,
        };
      });
    });
  }

  /**
   * Updates one row value text.
   * @param rowId Row identifier.
   * @param nextValueText Updated raw value text.
   */
  function updateRowValueText(rowId: string, nextValueText: string): void {
    setRows((currentRows: ValuesStoreRow[]): ValuesStoreRow[] => {
      return currentRows.map((row: ValuesStoreRow): ValuesStoreRow => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          valueText: nextValueText,
        };
      });
    });
  }

  /**
   * Updates one row value type.
   * @param rowId Row identifier.
   * @param nextType Updated value type.
   */
  function updateRowValueType(rowId: string, nextType: ValueTypeOption): void {
    setRows((currentRows: ValuesStoreRow[]): ValuesStoreRow[] => {
      return currentRows.map((row: ValuesStoreRow): ValuesStoreRow => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          valueType: nextType,
          valueText: normalizeRowValueTextForType(nextType, row.valueText),
        };
      });
    });
  }

  return (
    <section className="settings-page" aria-live="polite">
      <div className="settings-card values-store-card">
        <h2>Values Store</h2>
        <p className="settings-description">
          Bearbeite Key/Value-Paare fuer die Datei /valueservice/values und speichere sie direkt im FileStore.
        </p>

        <div className="settings-action-row">
          <button
            className="settings-button"
            type="button"
            onClick={(): void => {
              void saveValues();
            }}
            disabled={isBusy}
          >
            {isSaving ? 'Speichert...' : 'Save'}
          </button>
          <button
            className="settings-button settings-button-primary"
            type="button"
            onClick={(): void => {
              void loadValues();
            }}
            disabled={isBusy}
          >
            {isLoading ? 'Laedt...' : 'Load'}
          </button>
          <button className="settings-button" type="button" onClick={addRow} disabled={isBusy}>
            Add Row
          </button>
        </div>

        <p className="settings-meta">Aktive Eintraege: {String(nonEmptyRowCount)}</p>

        <div className="values-store-grid" role="group" aria-label="Values Store Eintraege">
          <div className="values-store-header values-store-col-key">Key</div>
          <div className="values-store-header values-store-col-type">Type</div>
          <div className="values-store-header values-store-col-value">Value</div>
          <div className="values-store-header values-store-col-actions">Action</div>

          {rows.map((row: ValuesStoreRow): JSX.Element => {
            return (
              <div className="values-store-row" key={row.id}>
                <label className="values-store-cell values-store-col-key">
                  <span className="values-store-cell-label">Key</span>
                  <input
                    className="values-store-input"
                    type="text"
                    value={row.key}
                    onChange={(event): void => {
                      updateRowKey(row.id, event.currentTarget.value);
                    }}
                    disabled={isBusy}
                    placeholder="house/light"
                  />
                </label>

                <label className="values-store-cell values-store-col-type">
                  <span className="values-store-cell-label">Type</span>
                  <select
                    className="values-store-select"
                    value={row.valueType}
                    onChange={(event): void => {
                      updateRowValueType(row.id, parseValueTypeOption(event.currentTarget.value));
                    }}
                    disabled={isBusy}
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="null">null</option>
                  </select>
                </label>

                <label className="values-store-cell values-store-col-value">
                  <span className="values-store-cell-label">Value</span>
                  <input
                    className="values-store-input"
                    type="text"
                    value={row.valueText}
                    onChange={(event): void => {
                      updateRowValueText(row.id, event.currentTarget.value);
                    }}
                    disabled={isBusy || row.valueType === 'null'}
                    placeholder={getValuePlaceholder(row.valueType)}
                  />
                </label>

                <div className="values-store-cell values-store-col-actions values-store-action-cell">
                  <span className="values-store-cell-label">Action</span>
                  <button
                    className="values-store-remove"
                    type="button"
                    onClick={(): void => {
                      removeRow(row.id);
                    }}
                    disabled={isBusy || rows.length === 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {statusMessage.length > 0 ? <p className="settings-status">{statusMessage}</p> : null}
        {errorMessage.length > 0 ? <p className="settings-error">{errorMessage}</p> : null}
      </div>
    </section>
  );
}

/**
 * Creates one empty values-store row.
 * @returns {ValuesStoreRow} Empty row object.
 */
function createEmptyRow(): ValuesStoreRow {
  return {
    id: createRowId(),
    key: '',
    valueText: '',
    valueType: 'string',
  };
}

/**
 * Creates one row identifier.
 * @returns {string} Unique row id.
 */
function createRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${String(Date.now())}-${String(Math.random())}`;
}

/**
 * Parses select value into typed value option.
 * @param option Raw option value.
 * @returns {ValueTypeOption} Typed option.
 */
function parseValueTypeOption(option: string): ValueTypeOption {
  if (option === 'number' || option === 'boolean' || option === 'null') {
    return option;
  }
  return 'string';
}

/**
 * Maps payload record into editable rows.
 * @param payload Values-store payload.
 * @returns {ValuesStoreRow[]} Row list.
 */
function mapPayloadToRows(payload: ValueStorePayload): ValuesStoreRow[] {
  const result: ValuesStoreRow[] = [];
  for (const [key, value] of Object.entries(payload)) {
    result.push({
      id: createRowId(),
      key,
      valueType: getValueTypeFromScalar(value),
      valueText: scalarToEditorValue(value),
    });
  }
  return result;
}

/**
 * Builds validated payload from editable rows.
 * @param rows Editable rows.
 * @returns {ValueStorePayload} Validated values payload.
 */
function buildPayloadFromRows(rows: ValuesStoreRow[]): ValueStorePayload {
  const payload: ValueStorePayload = {};

  for (const row of rows) {
    const key = row.key.trim();
    if (key.length === 0) {
      continue;
    }

    if (key in payload) {
      throw new ValuesStoreClientError(`Doppelter Key ist nicht erlaubt: ${key}`, 'values-store-editor', 0);
    }

    payload[key] = parseValueFromRow(row);
  }

  return payload;
}

/**
 * Converts one editor row into scalar value.
 * @param row Editor row.
 * @returns {ValueStoreScalar} Parsed scalar value.
 */
function parseValueFromRow(row: ValuesStoreRow): ValueStoreScalar {
  if (row.valueType === 'null') {
    return null;
  }

  if (row.valueType === 'boolean') {
    const normalizedValueText = row.valueText.trim().toLowerCase();
    if (normalizedValueText === 'true') {
      return true;
    }
    if (normalizedValueText === 'false') {
      return false;
    }
    throw new ValuesStoreClientError(`Boolean-Wert muss true oder false sein (Key: ${row.key})`, 'values-store-editor', 0);
  }

  if (row.valueType === 'number') {
    const normalizedValueText = row.valueText.trim();
    if (normalizedValueText.length === 0) {
      throw new ValuesStoreClientError(`Number-Wert darf nicht leer sein (Key: ${row.key})`, 'values-store-editor', 0);
    }

    const parsedNumber = Number(normalizedValueText);
    if (!Number.isFinite(parsedNumber)) {
      throw new ValuesStoreClientError(`Number-Wert ist ungueltig (Key: ${row.key})`, 'values-store-editor', 0);
    }

    return parsedNumber;
  }

  return row.valueText;
}

/**
 * Converts a scalar value into one editor value type.
 * @param value Scalar payload value.
 * @returns {ValueTypeOption} Editor value type.
 */
function getValueTypeFromScalar(value: ValueStoreScalar): ValueTypeOption {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  return 'string';
}

/**
 * Converts scalar payload value into editable text.
 * @param value Scalar payload value.
 * @returns {string} Text representation for input fields.
 */
function scalarToEditorValue(value: ValueStoreScalar): string {
  if (value === null) {
    return '';
  }
  return String(value);
}

/**
 * Normalizes input value text when type changes.
 * @param valueType Updated value type.
 * @param valueText Current value text.
 * @returns {string} Normalized value text.
 */
function normalizeRowValueTextForType(valueType: ValueTypeOption, valueText: string): string {
  if (valueType === 'null') {
    return '';
  }

  if (valueType === 'boolean') {
    const normalizedValueText = valueText.trim().toLowerCase();
    if (normalizedValueText === 'true' || normalizedValueText === 'false') {
      return normalizedValueText;
    }
    return 'false';
  }

  return valueText;
}

/**
 * Returns input placeholder text for one value type.
 * @param valueType Selected value type.
 * @returns {string} Placeholder text.
 */
function getValuePlaceholder(valueType: ValueTypeOption): string {
  if (valueType === 'number') {
    return '21';
  }

  if (valueType === 'boolean') {
    return 'true oder false';
  }

  if (valueType === 'null') {
    return 'null';
  }

  return 'on';
}

/**
 * Formats values-store errors into user-facing text.
 * @param error Unknown thrown value.
 * @returns {string} Readable error text.
 */
function formatValuesError(error: unknown): string {
  if (error instanceof ValuesStoreClientError) {
    return `Values API Fehler (${String(error.status)}): ${error.message}`;
  }

  if (error instanceof Error) {
    return `Values Fehler: ${error.message}`;
  }

  return 'Values Fehler: Unbekannter Fehler';
}
