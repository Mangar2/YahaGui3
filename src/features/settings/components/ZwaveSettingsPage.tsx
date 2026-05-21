import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import type { ZwaveDeviceMapping, ZwaveSettingsPayload } from '../../../domain/zwave/interfaces';
import { ZwaveSettingsClientError, type ZwaveSettingsClient } from '../../../infrastructure/zwave/zwaveSettingsClient';

type ZwaveRequestState = 'idle' | 'loading' | 'saving';

const ZWAVE_TEXT_COLLATOR = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

interface ZwaveSettingsRow {
  id: string;
  topic: string;
  nodeIdText: string;
  classIdText: string;
  instanceText: string;
  type: string;
  initialTopic: string;
  initialNodeIdText: string;
  initialClassIdText: string;
  initialInstanceText: string;
  initialType: string;
}

interface ZwaveSettingsPageProps {
  zwaveClient: ZwaveSettingsClient;
}

type RowValidationErrors = Record<string, string>;

/**
 * Zwave settings editor for managing device-topic mapping entries in file-store.
 * Empty filter fields are interpreted as wildcard/fallback ("all").
 * @param props Component props.
 * @returns {JSX.Element} Zwave settings view.
 */
export function ZwaveSettingsPage(props: ZwaveSettingsPageProps): JSX.Element {
  const { zwaveClient } = props;

  const [rows, setRows] = useState<ZwaveSettingsRow[]>([createEmptyRow()]);
  const [rowValidationErrors, setRowValidationErrors] = useState<RowValidationErrors>({});
  const [requestState, setRequestState] = useState<ZwaveRequestState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isLoading = requestState === 'loading';
  const isSaving = requestState === 'saving';
  const isBusy = isLoading || isSaving;

  const configuredRowCount = useMemo<number>(() => {
    return rows.filter((row: ZwaveSettingsRow): boolean => row.topic.trim().length > 0).length;
  }, [rows]);

  /**
   * Loads zwave settings from backend file-store and maps them into editable rows.
   * @returns {Promise<void>} Resolves when load flow is complete.
   */
  const loadSettings = useCallback(async (): Promise<void> => {
    setRequestState('loading');
    setStatusMessage('');
    setErrorMessage('');
    setRowValidationErrors({});

    try {
      const payload = await zwaveClient.readSettings();
      const parsedRows = mapPayloadToRows(payload);
      setRows(ensureRowsHaveTrailingEmptyRow(parsedRows));
      setStatusMessage(`Zwave Konfiguration geladen (${String(parsedRows.length)} Eintraege).`);
    } catch (error: unknown) {
      setErrorMessage(formatZwaveError(error));
    } finally {
      setRequestState('idle');
    }
  }, [zwaveClient]);

  useEffect((): void => {
    void loadSettings();
  }, [loadSettings]);

  /**
   * Validates and stores current rows as zwave settings payload.
   * @returns {Promise<void>} Resolves when save flow is complete.
   */
  async function saveSettings(): Promise<void> {
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
      await zwaveClient.storeSettings(payload);
      setRows((currentRows: ZwaveSettingsRow[]): ZwaveSettingsRow[] => {
        return ensureRowsHaveTrailingEmptyRow(markRowsAsSynced(currentRows));
      });
      setRowValidationErrors({});
      setStatusMessage(`Zwave Konfiguration gespeichert (${String(payload.devices.length)} Eintraege).`);
    } catch (error: unknown) {
      setErrorMessage(formatZwaveError(error));
    } finally {
      setRequestState('idle');
    }
  }

  /**
   * Removes one row by id, then persists the updated zwave settings payload.
   * @param rowId Row identifier.
   * @returns {Promise<void>} Resolves when remove and store flow is complete.
   */
  async function removeRow(rowId: string): Promise<void> {
    setRequestState('saving');
    setStatusMessage('');
    setErrorMessage('');

    const remainingRows = ensureRowsHaveTrailingEmptyRow(
      rows.filter((row: ZwaveSettingsRow): boolean => row.id !== rowId),
    );

    const nextValidationErrors = Object.fromEntries(
      Object.entries(validateRows(remainingRows)).filter(([currentRowId]): boolean => currentRowId !== rowId),
    );

    setRowValidationErrors(nextValidationErrors);
    setRows(remainingRows);

    try {
      const payload = buildPayloadFromRows(remainingRows);
      await zwaveClient.storeSettings(payload);
      setRows(ensureRowsHaveTrailingEmptyRow(markRowsAsSynced(remainingRows)));
      setStatusMessage(`Eintrag entfernt und gespeichert (${String(payload.devices.length)} Eintraege).`);
    } catch (error: unknown) {
      setErrorMessage(formatZwaveError(error));
    } finally {
      setRequestState('idle');
    }
  }

  /**
   * Updates one row field.
   * @param rowId Row identifier.
   * @param field Field name.
   * @param nextValue Updated value.
   */
  function updateRowField(
    rowId: string,
    field: 'topic' | 'nodeIdText' | 'classIdText' | 'instanceText' | 'type',
    nextValue: string,
  ): void {
    clearRowValidationError(rowId);

    setRows((currentRows: ZwaveSettingsRow[]): ZwaveSettingsRow[] => {
      const updatedRows = currentRows.map((row: ZwaveSettingsRow): ZwaveSettingsRow => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          [field]: nextValue,
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
      <div className="settings-card values-store-card zwave-settings-card">
        <h2>Zwave</h2>

        <div className="settings-action-row">
          <button
            className="settings-button settings-button-primary"
            type="button"
            onClick={(): void => {
              void loadSettings();
            }}
            disabled={isBusy}
          >
            {isLoading ? 'Laedt...' : 'Load'}
          </button>
        </div>

        <p className="settings-meta">Aktive Eintraege: {String(configuredRowCount)}</p>
        <p className="settings-description">
          Leere Felder fuer Node/Class/Instance/Type bedeuten "alle" (Fallback) und werden leer gespeichert.
        </p>

        <div className="zwave-store-grid" role="group" aria-label="Zwave Einstellungen">
          <div className="zwave-store-grid-head" aria-hidden="true">
            <div className="values-store-header zwave-store-col-topic">Topic</div>
            <div className="values-store-header zwave-store-col-node">Node Id</div>
            <div className="values-store-header zwave-store-col-class">Class Id</div>
            <div className="values-store-header zwave-store-col-instance">Instance</div>
            <div className="values-store-header zwave-store-col-type">Type</div>
            <div className="values-store-header values-store-col-actions" />
          </div>

          {rows.map((row: ZwaveSettingsRow): JSX.Element => {
            const rowErrorMessage = rowValidationErrors[row.id];
            const rowIsEmpty = isRowEmpty(row);
            const rowIsChanged = isRowChanged(row);

            return (
              <div className="values-store-row-block" key={row.id}>
                <div className="zwave-store-row">
                  <label className="values-store-cell zwave-store-col-topic">
                    <span className="values-store-cell-label">Topic</span>
                    <input
                      className="values-store-input"
                      type="text"
                      value={row.topic}
                      onChange={(event): void => {
                        updateRowField(row.id, 'topic', event.currentTarget.value);
                      }}
                      disabled={isBusy}
                      placeholder="ground/livingroom/zwave/switch/light"
                    />
                  </label>

                  <label className="values-store-cell zwave-store-col-node">
                    <span className="values-store-cell-label">Node Id</span>
                    <input
                      className="values-store-input"
                      type="text"
                      value={row.nodeIdText}
                      onChange={(event): void => {
                        updateRowField(row.id, 'nodeIdText', event.currentTarget.value);
                      }}
                      disabled={isBusy}
                      placeholder="alle"
                    />
                  </label>

                  <label className="values-store-cell zwave-store-col-class">
                    <span className="values-store-cell-label">Class Id</span>
                    <input
                      className="values-store-input"
                      type="text"
                      value={row.classIdText}
                      onChange={(event): void => {
                        updateRowField(row.id, 'classIdText', event.currentTarget.value);
                      }}
                      disabled={isBusy}
                      placeholder="alle"
                    />
                  </label>

                  <label className="values-store-cell zwave-store-col-instance">
                    <span className="values-store-cell-label">Instance</span>
                    <input
                      className="values-store-input"
                      type="text"
                      value={row.instanceText}
                      onChange={(event): void => {
                        updateRowField(row.id, 'instanceText', event.currentTarget.value);
                      }}
                      disabled={isBusy}
                      placeholder="alle"
                    />
                  </label>

                  <label className="values-store-cell zwave-store-col-type">
                    <span className="values-store-cell-label">Type</span>
                    <input
                      className="values-store-input"
                      type="text"
                      value={row.type}
                      onChange={(event): void => {
                        updateRowField(row.id, 'type', event.currentTarget.value);
                      }}
                      disabled={isBusy}
                      placeholder="alle"
                    />
                  </label>

                  <div className="values-store-cell values-store-col-actions values-store-action-cell">
                    <div className="values-store-actions">
                      <button
                        className="values-store-icon-button values-store-icon-button-save"
                        type="button"
                        onClick={(): void => {
                          void saveSettings();
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
 * Creates one empty zwave-settings row.
 * @returns {ZwaveSettingsRow} Empty row object.
 */
function createEmptyRow(): ZwaveSettingsRow {
  return {
    id: createRowId(),
    topic: '',
    nodeIdText: '',
    classIdText: '',
    instanceText: '',
    type: '',
    initialTopic: '',
    initialNodeIdText: '',
    initialClassIdText: '',
    initialInstanceText: '',
    initialType: '',
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
 * Maps payload array into editable rows.
 * @param payload Zwave settings payload.
 * @returns {ZwaveSettingsRow[]} Row list.
 */
function mapPayloadToRows(payload: ZwaveSettingsPayload): ZwaveSettingsRow[] {
  const sortedDevices = [...payload.devices].sort(compareZwaveDeviceMappings);

  return sortedDevices.map((device: ZwaveDeviceMapping): ZwaveSettingsRow => {
    const nodeIdText = typeof device.nodeId === 'number' ? String(device.nodeId) : '';
    const classIdText = typeof device.classId === 'number' ? String(device.classId) : '';
    const instanceText = typeof device.instance === 'number' ? String(device.instance) : '';
    const type = typeof device.type === 'string' ? device.type : '';

    return {
      id: createRowId(),
      topic: device.topic,
      nodeIdText,
      classIdText,
      instanceText,
      type,
      initialTopic: device.topic,
      initialNodeIdText: nodeIdText,
      initialClassIdText: classIdText,
      initialInstanceText: instanceText,
      initialType: type,
    };
  });
}

/**
 * Sorts zwave mappings for stable menu display.
 * Priority: node id, class id, instance, type. Empty values are ordered before concrete values.
 * @param left Left mapping.
 * @param right Right mapping.
 * @returns {number} Sort comparison result.
 */
function compareZwaveDeviceMappings(left: ZwaveDeviceMapping, right: ZwaveDeviceMapping): number {
  const byNode = compareOptionalNumber(left.nodeId, right.nodeId);
  if (byNode !== 0) {
    return byNode;
  }

  const byClass = compareOptionalNumber(left.classId, right.classId);
  if (byClass !== 0) {
    return byClass;
  }

  const byInstance = compareOptionalNumber(left.instance, right.instance);
  if (byInstance !== 0) {
    return byInstance;
  }

  const byType = compareOptionalText(left.type, right.type);
  if (byType !== 0) {
    return byType;
  }

  return ZWAVE_TEXT_COLLATOR.compare(left.topic, right.topic);
}

/**
 * Compares optional numeric values with empty-first behavior.
 * @param left Left value.
 * @param right Right value.
 * @returns {number} Sort comparison result.
 */
function compareOptionalNumber(left: number | undefined, right: number | undefined): number {
  if (typeof left !== 'number' && typeof right !== 'number') {
    return 0;
  }

  if (typeof left !== 'number') {
    return -1;
  }

  if (typeof right !== 'number') {
    return 1;
  }

  return left - right;
}

/**
 * Compares optional text values with empty-first behavior.
 * @param left Left value.
 * @param right Right value.
 * @returns {number} Sort comparison result.
 */
function compareOptionalText(left: string | undefined, right: string | undefined): number {
  const leftTrimmed = typeof left === 'string' ? left.trim() : '';
  const rightTrimmed = typeof right === 'string' ? right.trim() : '';

  const leftEmpty = leftTrimmed.length === 0;
  const rightEmpty = rightTrimmed.length === 0;

  if (leftEmpty && rightEmpty) {
    return 0;
  }

  if (leftEmpty) {
    return -1;
  }

  if (rightEmpty) {
    return 1;
  }

  return ZWAVE_TEXT_COLLATOR.compare(leftTrimmed, rightTrimmed);
}

/**
 * Updates row snapshots after a successful save operation.
 * @param rows Current row list.
 * @returns {ZwaveSettingsRow[]} Rows with synchronized initial snapshots.
 */
function markRowsAsSynced(rows: ZwaveSettingsRow[]): ZwaveSettingsRow[] {
  return rows.map((row: ZwaveSettingsRow): ZwaveSettingsRow => {
    return {
      ...row,
      initialTopic: row.topic,
      initialNodeIdText: row.nodeIdText,
      initialClassIdText: row.classIdText,
      initialInstanceText: row.instanceText,
      initialType: row.type,
    };
  });
}

/**
 * Ensures editor rows keep exactly one empty row at the end.
 * @param rows Candidate row list.
 * @returns {ZwaveSettingsRow[]} Normalized row list.
 */
function ensureRowsHaveTrailingEmptyRow(rows: ZwaveSettingsRow[]): ZwaveSettingsRow[] {
  if (rows.length === 0) {
    return [createEmptyRow()];
  }

  const withoutTrailingEmptyRows = removeTrailingEmptyRows(rows);
  return [...withoutTrailingEmptyRows, createEmptyRow()];
}

/**
 * Removes trailing empty rows while preserving non-empty rows.
 * @param rows Candidate row list.
 * @returns {ZwaveSettingsRow[]} Row list without trailing empty rows.
 */
function removeTrailingEmptyRows(rows: ZwaveSettingsRow[]): ZwaveSettingsRow[] {
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
function isRowEmpty(row: ZwaveSettingsRow): boolean {
  return (
    row.topic.trim().length === 0 &&
    row.nodeIdText.trim().length === 0 &&
    row.classIdText.trim().length === 0 &&
    row.instanceText.trim().length === 0 &&
    row.type.trim().length === 0
  );
}

/**
 * Checks whether a row differs from its last loaded/saved snapshot.
 * @param row Candidate row.
 * @returns {boolean} True when row content has changed.
 */
function isRowChanged(row: ZwaveSettingsRow): boolean {
  return (
    row.topic !== row.initialTopic ||
    row.nodeIdText !== row.initialNodeIdText ||
    row.classIdText !== row.initialClassIdText ||
    row.instanceText !== row.initialInstanceText ||
    row.type !== row.initialType
  );
}

/**
 * Validates editor rows and returns row-specific error messages.
 * @param rows Row list to validate.
 * @returns {RowValidationErrors} Validation errors by row id.
 */
function validateRows(rows: ZwaveSettingsRow[]): RowValidationErrors {
  const validationErrors: RowValidationErrors = {};

  for (const row of rows) {
    const topic = row.topic.trim();
    const hasAnyFilter =
      row.nodeIdText.trim().length > 0 ||
      row.classIdText.trim().length > 0 ||
      row.instanceText.trim().length > 0 ||
      row.type.trim().length > 0;

    if (topic.length === 0) {
      if (hasAnyFilter) {
        validationErrors[row.id] = 'Topic fehlt: Bitte Topic eintragen oder alle Felder leeren.';
      }
      continue;
    }

    try {
      void parseDeviceFromRow(row);
    } catch (error: unknown) {
      if (error instanceof ZwaveSettingsClientError) {
        validationErrors[row.id] = error.message;
      } else if (error instanceof Error) {
        validationErrors[row.id] = error.message;
      } else {
        validationErrors[row.id] = 'Ungueltiger Wert in dieser Zeile.';
      }
    }
  }

  return validationErrors;
}

/**
 * Builds validated payload from editable rows.
 * @param rows Editable rows.
 * @returns {ZwaveSettingsPayload} Validated zwave settings payload.
 */
function buildPayloadFromRows(rows: ZwaveSettingsRow[]): ZwaveSettingsPayload {
  const devices: ZwaveDeviceMapping[] = [];

  for (const row of rows) {
    const topic = row.topic.trim();
    if (topic.length === 0) {
      continue;
    }

    devices.push(parseDeviceFromRow(row));
  }

  return { devices };
}

/**
 * Converts one editor row into a validated device mapping.
 * Empty optional fields are omitted and therefore behave like wildcard fallback.
 * @param row Editor row.
 * @returns {ZwaveDeviceMapping} Parsed mapping.
 */
function parseDeviceFromRow(row: ZwaveSettingsRow): ZwaveDeviceMapping {
  const topic = row.topic.trim();
  if (topic.length === 0) {
    throw new ZwaveSettingsClientError('Topic darf nicht leer sein.', 'zwave-settings-editor', 0);
  }

  const result: ZwaveDeviceMapping = {
    topic,
  };

  const nodeId = parseOptionalIntegerText(row.nodeIdText, `Node Id (Topic: ${topic})`);
  if (typeof nodeId === 'number') {
    result.nodeId = nodeId;
  }

  const classId = parseOptionalIntegerText(row.classIdText, `Class Id (Topic: ${topic})`);
  if (typeof classId === 'number') {
    result.classId = classId;
  }

  const instance = parseOptionalIntegerText(row.instanceText, `Instance (Topic: ${topic})`);
  if (typeof instance === 'number') {
    result.instance = instance;
  }

  const type = row.type.trim();
  if (type.length > 0) {
    result.type = type;
  }

  return result;
}

/**
 * Parses optional integer text values.
 * @param rawValue Raw input value.
 * @param fieldLabel Field label used for precise error output.
 * @returns {number | undefined} Parsed integer value or undefined when empty.
 */
function parseOptionalIntegerText(rawValue: string, fieldLabel: string): number | undefined {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsedValue = Number(trimmed);
  if (!Number.isInteger(parsedValue)) {
    throw new ZwaveSettingsClientError(`${fieldLabel} muss eine ganze Zahl sein.`, 'zwave-settings-editor', 0);
  }

  if (parsedValue < 0) {
    throw new ZwaveSettingsClientError(`${fieldLabel} muss >= 0 sein.`, 'zwave-settings-editor', 0);
  }

  return parsedValue;
}

/**
 * Formats zwave-settings errors into user-facing text.
 * @param error Unknown thrown value.
 * @returns {string} Readable error text.
 */
function formatZwaveError(error: unknown): string {
  if (error instanceof ZwaveSettingsClientError) {
    return `Zwave API Fehler (${String(error.status)}): ${error.message}`;
  }

  if (error instanceof Error) {
    return `Zwave Fehler: ${error.message}`;
  }

  return 'Zwave Fehler: Unbekannter Fehler';
}
