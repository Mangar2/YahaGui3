import { useState, type JSX } from 'react';
import type { TopicSettingsPayload } from '../../../domain/settings/interfaces';
import { SettingsConfigClientError } from '../../../infrastructure/settings/settingsConfigClient';
import type { TopicSettingsStore } from '../../../domain/settings/interfaces';
import type { SettingsConfigClient } from '../../../infrastructure/settings/settingsConfigClient';

const CONFIG_TYPES = ['General', 'Phone', 'Tablet', 'Computer'] as const;

type ConfigType = (typeof CONFIG_TYPES)[number];

type SettingsRequestState = 'idle' | 'loading' | 'saving';

interface SettingsPageProps {
  settingsStore: TopicSettingsStore;
  settingsClient: SettingsConfigClient;
}

/**
 * Settings view for loading and storing named device configurations.
 * @param props Component props.
 * @returns {JSX.Element} Settings view.
 */
export function SettingsPage(props: SettingsPageProps): JSX.Element {
  const { settingsStore, settingsClient } = props;
  const [configType, setConfigType] = useState<ConfigType>('General');
  const [requestState, setRequestState] = useState<SettingsRequestState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [storedTopicCount, setStoredTopicCount] = useState<number>(settingsStore.getStoredTopicCount());

  /**
   * Loads settings for one selected config type and writes them to local storage.
   * @returns {Promise<void>} Resolves when operation is finished.
   */
  async function loadSettings(): Promise<void> {
    setRequestState('loading');
    setStatusMessage('');
    setErrorMessage('');

    try {
      const loadedSettings = await settingsClient.readConfig(configType);
      settingsStore.setAllSettings(loadedSettings);
      setStoredTopicCount(settingsStore.getStoredTopicCount());
      const loadedAmount = Object.keys(loadedSettings).length;
      setStatusMessage(`Konfiguration ${configType} geladen (${String(loadedAmount)} Topics).`);
    } catch (error: unknown) {
      setErrorMessage(formatSettingsError(error));
    } finally {
      setRequestState('idle');
    }
  }

  /**
   * Stores current in-browser settings to selected config type endpoint.
   * @returns {Promise<void>} Resolves when operation is finished.
   */
  async function saveSettings(): Promise<void> {
    setRequestState('saving');
    setStatusMessage('');
    setErrorMessage('');

    try {
      const payload: TopicSettingsPayload = settingsStore.getAllSettings();
      await settingsClient.storeConfig(configType, payload);
      setStoredTopicCount(settingsStore.getStoredTopicCount());
      setStatusMessage(`Konfiguration ${configType} gespeichert (${String(Object.keys(payload).length)} Topics).`);
    } catch (error: unknown) {
      setErrorMessage(formatSettingsError(error));
    } finally {
      setRequestState('idle');
    }
  }

  const isLoading = requestState === 'loading';
  const isSaving = requestState === 'saving';

  return (
    <section className="settings-page" aria-live="polite">
      <div className="settings-card">
        <h2>Settings</h2>
        <p className="settings-description">
          Konfiguration analog zum Original laden und speichern: General, Phone, Tablet, Computer.
        </p>

        <div className="settings-control-row">
          <label className="settings-label" htmlFor="settings-config-type">
            Device Profile
          </label>
          <select
            id="settings-config-type"
            className="settings-select"
            value={configType}
            onChange={(event): void => {
              setConfigType(event.currentTarget.value as ConfigType);
            }}
            disabled={isLoading || isSaving}
          >
            {CONFIG_TYPES.map((entry: ConfigType): JSX.Element => {
              return (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              );
            })}
          </select>
        </div>

        <div className="settings-action-row">
          <button
            className="settings-button"
            type="button"
            onClick={(): void => {
              void saveSettings();
            }}
            disabled={isLoading || isSaving}
          >
            {isSaving ? 'Speichert...' : 'Save'}
          </button>
          <button
            className="settings-button settings-button-primary"
            type="button"
            onClick={(): void => {
              void loadSettings();
            }}
            disabled={isLoading || isSaving}
          >
            {isLoading ? 'Laedt...' : 'Load'}
          </button>
        </div>

        <p className="settings-meta">Lokal gespeicherte Topics: {String(storedTopicCount)}</p>

        {statusMessage.length > 0 ? <p className="settings-status">{statusMessage}</p> : null}
        {errorMessage.length > 0 ? <p className="settings-error">{errorMessage}</p> : null}
      </div>
    </section>
  );
}

/**
 * Formats settings errors into user-facing text.
 * @param error Unknown thrown value.
 * @returns {string} Readable error text.
 */
function formatSettingsError(error: unknown): string {
  if (error instanceof SettingsConfigClientError) {
    return `Settings API Fehler (${String(error.status)}): ${error.message}`;
  }

  if (error instanceof Error) {
    return `Settings Fehler: ${error.message}`;
  }

  return 'Settings Fehler: Unbekannter Fehler';
}
