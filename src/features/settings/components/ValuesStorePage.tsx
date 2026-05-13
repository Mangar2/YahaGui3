import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import type { ValueStorePayload, ValueStoreScalar } from '../../../domain/values/interfaces';
import { ValuesStoreClientError, type ValuesStoreClient } from '../../../infrastructure/values/valuesStoreClient';

type ValuesRequestState = 'idle' | 'loading' | 'saving';

type ValueTypeOption = 'string' | 'number' | 'boolean' | 'null';

interface ValuesStoreRow {
  id: string;
  key: string;
  valueText: string;
  valueType: ValueTypeOption;
  initialKey: string;
  initialValueText: string;
  initialValueType: ValueTypeOption;
}

interface ValuesStorePageProps {
  valuesClient: ValuesStoreClient;
}

type RowValidationErrors = Record<string, string>;

/**
 * Values-store editor for managing key/value pairs in file-store.
 * @param props Component props.
 * @returns {JSX.Element} Values-store view.
 */
export function ValuesStorePage(props: ValuesStorePageProps): JSX.Element {
  const { valuesClient } = props;

  const [rows, setRows] = useState<ValuesStoreRow[]>([createEmptyRow()]);
  const [rowValidationErrors, setRowValidationErrors] = useState<RowValidationErrors>({});
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
  const loadValues = useCallback(async (): Promise<void> => {
    setRequestState('loading');
    setStatusMessage('');
    setErrorMessage('');
    setRowValidationErrors({});

    try {
      const payload = await valuesClient.readValues();
      const parsedRows = mapPayloadToRows(payload);
      setRows(ensureRowsHaveTrailingEmptyRow(parsedRows));
      setStatusMessage(`Values geladen (${String(parsedRows.length)} Eintraege).`);
    } catch (error: unknown) {
      setErrorMessage(formatValuesError(error));
    } finally {
      setRequestState('idle');
    }
  }, [valuesClient]);

  useEffect((): void => {
    void loadValues();
  }, [loadValues]);

  /**
   * Validates and stores current rows as values-store payload.
   * @returns {Promise<void>} Resolves when save flow is complete.
   */
  async function saveValues(): Promise<void> {
    setRequestState('saving');
    setStatusMessage('');
    setErrorMessage('');

    const validationErrors = validateRows(rows);
    if (Object.keys(validationErrors).length > 0) {
      setRowValidationErrors(validationErrors);
      setRequestState('idle');
      return;
    }

    try {
      const payload = buildPayloadFromRows(rows);
      await valuesClient.storeValues(payload);
      setRows((currentRows: ValuesStoreRow[]): ValuesStoreRow[] => {
        return ensureRowsHaveTrailingEmptyRow(markRowsAsSynced(currentRows));
      });
      setRowValidationErrors({});
      setStatusMessage(`Values gespeichert (${String(Object.keys(payload).length)} Eintraege).`);
    } catch (error: unknown) {
      setErrorMessage(formatValuesError(error));
    } finally {
      setRequestState('idle');
    }
  }

  /**
   * Removes one row by id, then persists the updated values-store payload.
   * @param rowId Row identifier.
   * @returns {Promise<void>} Resolves when remove and store flow is complete.
   */
  async function removeRow(rowId: string): Promise<void> {
    setRequestState('saving');
    setStatusMessage('');
    setErrorMessage('');

    const remainingRows = ensureRowsHaveTrailingEmptyRow(
      rows.filter((row: ValuesStoreRow): boolean => row.id !== rowId),
    );

    const nextValidationErrors = Object.fromEntries(
      Object.entries(validateRows(remainingRows)).filter(([currentRowId]): boolean => currentRowId !== rowId),
    );

    setRowValidationErrors(nextValidationErrors);
    setRows(remainingRows);

    try {
      const payload = buildPayloadFromRows(remainingRows);
      await valuesClient.storeValues(payload);
      setRows(ensureRowsHaveTrailingEmptyRow(markRowsAsSynced(remainingRows)));
      setStatusMessage(`Eintrag entfernt und gespeichert (${String(Object.keys(payload).length)} Eintraege).`);
    } catch (error: unknown) {
      setErrorMessage(formatValuesError(error));
    } finally {
      setRequestState('idle');
    }
  }

  /**
   * Updates one row key value.
   * @param rowId Row identifier.
   * @param nextKey Updated key.
   */
  function updateRowKey(rowId: string, nextKey: string): void {
    clearRowValidationError(rowId);

    setRows((currentRows: ValuesStoreRow[]): ValuesStoreRow[] => {
      const updatedRows = currentRows.map((row: ValuesStoreRow): ValuesStoreRow => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          key: nextKey,
        };
      });

      return ensureRowsHaveTrailingEmptyRow(updatedRows);
    });
  }

  /**
   * Updates one row value text.
   * @param rowId Row identifier.
   * @param nextValueText Updated raw value text.
   */
  function updateRowValueText(rowId: string, nextValueText: string): void {
    clearRowValidationError(rowId);

    setRows((currentRows: ValuesStoreRow[]): ValuesStoreRow[] => {
      const updatedRows = currentRows.map((row: ValuesStoreRow): ValuesStoreRow => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          valueText: nextValueText,
        };
      });

      return ensureRowsHaveTrailingEmptyRow(updatedRows);
    });
  }

  /**
   * Updates one row value type.
   * @param rowId Row identifier.
   * @param nextType Updated value type.
   */
  function updateRowValueType(rowId: string, nextType: ValueTypeOption): void {
    clearRowValidationError(rowId);

    setRows((currentRows: ValuesStoreRow[]): ValuesStoreRow[] => {
      const updatedRows = currentRows.map((row: ValuesStoreRow): ValuesStoreRow => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          valueType: nextType,
          valueText: normalizeRowValueTextForType(nextType, row.valueText),
        };
      });

      return ensureRowsHaveTrailingEmptyRow(updatedRows);
    });
  }

  /**
   * Clears one row-level validation error.
   * @param rowId Row identifier.
   */
  function clearRowValidationError(rowId: string): void {
    setRowValidationErrors((currentErrors: RowValidationErrors): RowValidationErrors => {
      if (!(rowId in currentErrors)) {
        return currentErrors;
      }

      return Object.fromEntries(
        Object.entries(currentErrors).filter(([currentRowId]): boolean => currentRowId !== rowId),
      );
    });
  }

  return (
    <section className="settings-page" aria-live="polite">
      <div className="settings-card values-store-card">
        <h2>Globale Werte</h2>

        <div className="settings-action-row">
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
        </div>

        <p className="settings-meta">Aktive Eintraege: {String(nonEmptyRowCount)}</p>

        <div className="values-store-grid" role="group" aria-label="Values Store Eintraege">
          <div className="values-store-grid-head" aria-hidden="true">
            <div className="values-store-header values-store-col-key">Key</div>
            <div className="values-store-header values-store-col-type">Type</div>
            <div className="values-store-header values-store-col-value">Value</div>
            <div className="values-store-header values-store-col-actions" />
          </div>

          {rows.map((row: ValuesStoreRow): JSX.Element => {
            const rowErrorMessage = rowValidationErrors[row.id];
            const rowIsEmpty = isRowEmpty(row);
            const rowIsChanged = isRowChanged(row);

            return (
              <div className="values-store-row-block" key={row.id}>
                <div className="values-store-row">
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
                    <div className="values-store-actions">
                      <button
                        className="values-store-icon-button values-store-icon-button-save"
                        type="button"
                        onClick={(): void => {
                          void saveValues();
                        }}
                        disabled={isBusy || !rowIsChanged}
                        aria-label="Save row changes"
                        title="Save"
                      >
                        {isSaving ? (
                          <span className="values-store-icon" aria-hidden="true">
                            ...
                          </span>
                        ) : (
                          <svg className="values-store-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                            <path d="M13.2 3.2a1 1 0 0 0-1.4 0L6.7 8.3 4.2 5.8a1 1 0 0 0-1.4 1.4l3.2 3.2a1 1 0 0 0 1.4 0l5.8-5.8a1 1 0 0 0 0-1.4Z" />
                          </svg>
                        )}
                      </button>
                      {!rowIsEmpty ? (
                        <button
                          className="values-store-icon-button values-store-icon-button-remove"
                          type="button"
                          onClick={(): void => {
                            void removeRow(row.id);
                          }}
                          disabled={isBusy || rows.length === 1}
                          aria-label="Remove row"
                          title="Remove"
                        >
                          <svg className="values-store-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                            <path d="M6 1.5h4a1 1 0 0 1 1 1V3h2.5a1 1 0 1 1 0 2h-.6l-.8 8.2a1.6 1.6 0 0 1-1.6 1.4H5.5a1.6 1.6 0 0 1-1.6-1.4L3.1 5H2.5a1 1 0 1 1 0-2H5v-.5a1 1 0 0 1 1-1Zm1 1.5v-.5h2V3H7Zm-1.4 2 .7 7.6h3.4l.7-7.6H5.6Z" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {rowErrorMessage ? <p className="values-store-row-error">{rowErrorMessage}</p> : null}
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
    initialKey: '',
    initialValueText: '',
    initialValueType: 'string',
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
      initialKey: key,
      initialValueText: scalarToEditorValue(value),
      initialValueType: getValueTypeFromScalar(value),
    });
  }
  return result;
}

/**
 * Updates row snapshots after a successful save operation.
 * @param rows Current row list.
 * @returns {ValuesStoreRow[]} Rows with synchronized initial snapshots.
 */
function markRowsAsSynced(rows: ValuesStoreRow[]): ValuesStoreRow[] {
  return rows.map((row: ValuesStoreRow): ValuesStoreRow => {
    return {
      ...row,
      initialKey: row.key,
      initialValueText: row.valueText,
      initialValueType: row.valueType,
    };
  });
}

/**
 * Ensures editor rows keep exactly one empty row at the end.
 * @param rows Candidate row list.
 * @returns {ValuesStoreRow[]} Normalized row list.
 */
function ensureRowsHaveTrailingEmptyRow(rows: ValuesStoreRow[]): ValuesStoreRow[] {
  if (rows.length === 0) {
    return [createEmptyRow()];
  }

  const withoutTrailingEmptyRows = removeTrailingEmptyRows(rows);
  return [...withoutTrailingEmptyRows, createEmptyRow()];
}

/**
 * Removes trailing empty rows while preserving non-empty rows.
 * @param rows Candidate row list.
 * @returns {ValuesStoreRow[]} Row list without trailing empty rows.
 */
function removeTrailingEmptyRows(rows: ValuesStoreRow[]): ValuesStoreRow[] {
  const clonedRows = [...rows];
  while (clonedRows.length > 0 && isRowEmpty(clonedRows.at(-1) ?? createEmptyRow())) {
    clonedRows.pop();
  }
  return clonedRows;
}

/**
 * Checks whether one row contains no effective user input.
 * @param row Candidate row.
 * @returns {boolean} True when row is empty.
 */
function isRowEmpty(row: ValuesStoreRow): boolean {
  const hasKey = row.key.trim().length > 0;
  const hasValueText = row.valueText.trim().length > 0;
  return !hasKey && !hasValueText;
}

/**
 * Checks whether a row differs from its last loaded/saved snapshot.
 * @param row Candidate row.
 * @returns {boolean} True when row content has changed.
 */
function isRowChanged(row: ValuesStoreRow): boolean {
  return (
    row.key !== row.initialKey ||
    row.valueText !== row.initialValueText ||
    row.valueType !== row.initialValueType
  );
}

/**
 * Validates editor rows and returns row-specific error messages.
 * @param rows Row list to validate.
 * @returns {RowValidationErrors} Validation errors by row id.
 */
function validateRows(rows: ValuesStoreRow[]): RowValidationErrors {
  const validationErrors: RowValidationErrors = {};
  const keyToRowIds = new Map<string, string[]>();

  for (const row of rows) {
    const key = row.key.trim();
    const hasValueInput = row.valueText.trim().length > 0;

    if (key.length === 0) {
      if (hasValueInput) {
        validationErrors[row.id] = 'Key fehlt: Bitte Key eintragen oder Value leeren.';
      }
      continue;
    }

    const existingRowIdsForKey = keyToRowIds.get(key) ?? [];
    keyToRowIds.set(key, [...existingRowIdsForKey, row.id]);

    try {
      void parseValueFromRow(row);
    } catch (error: unknown) {
      if (error instanceof ValuesStoreClientError) {
        validationErrors[row.id] = error.message;
      } else if (error instanceof Error) {
        validationErrors[row.id] = error.message;
      } else {
        validationErrors[row.id] = 'Ungueltiger Wert in dieser Zeile.';
      }
    }
  }

  for (const rowIds of keyToRowIds.values()) {
    if (rowIds.length < 2) {
      continue;
    }

    for (const rowId of rowIds) {
      validationErrors[rowId] = 'Doppelter Key ist nicht erlaubt.';
    }
  }

  return validationErrors;
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
