import { useEffect, useMemo, useState, type ChangeEvent, type JSX } from 'react';
import { splitTopic } from '../../../domain/messages/topicPath';
import type { MessageTreeNode } from '../../../domain/messages/interfaces';
import type { TopicSettingsStore } from '../../../domain/settings/interfaces';

interface DetailStatusPanelProps {
  topic: string;
  topicNode: MessageTreeNode | null;
  settingsStore: TopicSettingsStore;
  settingsRevision: number;
  isUpdatingTopic: boolean;
  onPublishValueChange: (newValue: string) => Promise<void>;
}

interface StatusViewModel {
  topicName: string;
  beautifiedTopicName: string;
  topicType: string;
  valueType: string;
  unit: string;
  currentValueText: string;
  enumList: string[];
  switchControl: boolean;
  switchOn: boolean;
}

const SWITCHING_TYPES: ReadonlySet<string> = new Set<string>(['Roller', 'Light', 'Switch']);

const TYPE_IDENTIFIER: Record<string, string> = {
  window: 'Window',
  temperature: 'Temperature',
  humidity: 'Humidity',
  'roller shutter': 'Roller',
  pressure: 'Air Pressure',
};

const UNIT_IDENTIFIER: Record<string, string> = {
  Temperature: 'degC',
  Humidity: '%rH',
  'Air Pressure': 'hPa',
};

/**
 * Displays topic status and provides legacy-equivalent value editing controls.
 * @param props Component props.
 * @returns {JSX.Element} Status section for detail view.
 */
export function DetailStatusPanel(props: DetailStatusPanelProps): JSX.Element {
  const { topic, topicNode, settingsStore, settingsRevision, isUpdatingTopic, onPublishValueChange } = props;

  const statusModel = useMemo((): StatusViewModel => {
    return buildStatusViewModel(topic, topicNode, settingsStore, settingsRevision);
  }, [topic, topicNode, settingsStore, settingsRevision]);

  const [editableValue, setEditableValue] = useState<string>(statusModel.currentValueText);

  useEffect((): void => {
    setEditableValue(statusModel.currentValueText);
  }, [statusModel.currentValueText]);

  /**
   * Handles switch changes.
   * @param event Input change event.
   */
  function handleSwitchChange(event: ChangeEvent<HTMLInputElement>): void {
    if (isUpdatingTopic) {
      return;
    }

    const nextValue = event.currentTarget.checked ? 'on' : 'off';
    void onPublishValueChange(nextValue);
  }

  /**
   * Handles parameter update requests.
   */
  function handleParameterUpdate(): void {
    if (isUpdatingTopic) {
      return;
    }
    void onPublishValueChange(editableValue);
  }

  return (
    <section className="detail-status-panel" aria-label="Status panel">
      <h3>{statusModel.beautifiedTopicName}</h3>
      <p>{statusModel.topicName} (Type: {statusModel.topicType})</p>

      {statusModel.topicType !== 'Parameter' && !statusModel.switchControl ? (
        <p className="detail-status-value">
          {statusModel.currentValueText}
          {statusModel.unit.length > 0 ? ` ${statusModel.unit}` : ''}
        </p>
      ) : null}

      {statusModel.topicType === 'Parameter' ? (
        <div className="detail-status-edit-box">
          <label className="detail-status-label" htmlFor="detail-status-value-input">
            Value
          </label>
          {statusModel.valueType === 'Enumeration' ? (
            <select
              id="detail-status-value-input"
              className="detail-status-select"
              value={editableValue}
              onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
                setEditableValue(event.currentTarget.value);
              }}
              disabled={isUpdatingTopic}
            >
              {statusModel.enumList.map((entry: string): JSX.Element => {
                return (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              id="detail-status-value-input"
              className="detail-status-input"
              value={editableValue}
              onChange={(event: ChangeEvent<HTMLInputElement>): void => {
                setEditableValue(event.currentTarget.value);
              }}
              disabled={isUpdatingTopic}
            />
          )}

          <button
            type="button"
            className="detail-status-update"
            onClick={handleParameterUpdate}
            disabled={isUpdatingTopic}
          >
            Update
          </button>
        </div>
      ) : null}

      {statusModel.switchControl ? (
        <div className="detail-status-switch-row">
          <label className="detail-status-switch">
            <input type="checkbox" checked={statusModel.switchOn} onChange={handleSwitchChange} disabled={isUpdatingTopic} />
            <span aria-hidden="true" className="detail-status-slider" />
          </label>
          <span className="detail-status-value">{statusModel.currentValueText}</span>
        </div>
      ) : null}

      {isUpdatingTopic ? <span className="detail-loader" aria-label="Detailwert wird aktualisiert" /> : null}
    </section>
  );
}

/**
 * Builds a status model from topic node and settings.
 * @param topic Requested detail topic.
 * @param topicNode Current topic node.
 * @param settingsStore Shared settings store.
 * @param settingsRevision Revision token to include node-settings updates.
 * @returns {StatusViewModel} View model for rendering.
 */
function buildStatusViewModel(
  topic: string,
  topicNode: MessageTreeNode | null,
  settingsStore: TopicSettingsStore,
  settingsRevision: number,
): StatusViewModel {
  void settingsRevision;

  const effectiveTopic = topicNode?.topic ?? topic;
  const topicChunks = splitTopic(effectiveTopic);
  const topicName = topicChunks.at(-1) ?? 'unknown';
  const currentValueText = String(topicNode?.value ?? '');
  const navSettings = settingsStore.getNavSettings(topicChunks);

  let topicType = decideTopicType(navSettings.getTopicType(), topicName, currentValueText);
  const updatable = isTopicUpdatable(topicNode);
  if (navSettings.getTopicType() === 'Automatic' && topicType === 'Information' && updatable) {
    topicType = 'Parameter';
  }

  const valueType = decideValueType(navSettings.getValueType());
  const enumList = navSettings.getEnumList();

  return {
    topicName,
    beautifiedTopicName: beautifyTopicName(topicName, topicType),
    topicType,
    valueType,
    unit: UNIT_IDENTIFIER[topicType] ?? '',
    currentValueText,
    enumList,
    switchControl: isSwitch(currentValueText, topicType),
    switchOn: isSwitchOn(currentValueText, topicType, valueType, enumList),
  };
}

/**
 * Decides topic type with legacy-compatible automatic behavior.
 * @param configuredType Configured topic type.
 * @param topicChunk Last topic chunk.
 * @param topicValue Current value as string.
 * @returns {string} Decided topic type.
 */
function decideTopicType(configuredType: string, topicChunk: string, topicValue: string): string {
  if (configuredType !== 'Automatic') {
    return configuredType.length > 0 ? configuredType : 'Information';
  }

  const loweredChunk = topicChunk.toLowerCase();
  for (const [identifier, mappedType] of Object.entries(TYPE_IDENTIFIER)) {
    if (loweredChunk.includes(identifier)) {
      return mappedType;
    }
  }

  if (isSwitch(topicValue, configuredType)) {
    return 'Switch';
  }

  return 'Information';
}

/**
 * Decides value type with legacy-compatible automatic fallback.
 * @param configuredValueType Configured value type.
 * @returns {string} Decided value type.
 */
function decideValueType(configuredValueType: string): string {
  if (configuredValueType === 'Automatic' || configuredValueType.length === 0) {
    return 'String';
  }
  return configuredValueType;
}

/**
 * Checks if a topic should render as switch control.
 * @param topicValue Current topic value.
 * @param topicType Decided topic type.
 * @returns {boolean} True when switch control should be shown.
 */
function isSwitch(topicValue: string, topicType: string): boolean {
  if (SWITCHING_TYPES.has(topicType)) {
    return true;
  }

  if (topicType === 'Automatic') {
    const loweredValue = topicValue.toLowerCase();
    return loweredValue === 'on' || loweredValue === 'off';
  }

  return false;
}

/**
 * Checks whether switch is currently in "on" state.
 * @param topicValue Current topic value.
 * @param topicType Decided topic type.
 * @param valueType Decided value type.
 * @param enumList Enumeration list for parameter mode.
 * @returns {boolean} True when switch is interpreted as on.
 */
function isSwitchOn(topicValue: string, topicType: string, valueType: string, enumList: string[]): boolean {
  if (topicValue.length === 0) {
    return false;
  }

  const loweredValue = topicValue.toLowerCase();
  switch (topicType) {
    case 'Light':
    case 'Switch':
      return loweredValue !== 'off' && loweredValue !== '0' && loweredValue !== 'false';
    case 'Roller':
      return loweredValue !== 'down' && loweredValue !== '0';
    case 'Parameter': {
      if (valueType !== 'Enumeration') {
        return loweredValue.length > 0;
      }
      for (let index = 1; index < enumList.length; index += 1) {
        if (loweredValue === enumList[index].toLowerCase()) {
          return false;
        }
      }
      return true;
    }
    default:
      return false;
  }
}

/**
 * Checks whether the node has a set child and is therefore directly updatable.
 * @param topicNode Topic node.
 * @returns {boolean} True when set child exists.
 */
function isTopicUpdatable(topicNode: MessageTreeNode | null): boolean {
  if (!topicNode?.childs) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(topicNode.childs, 'set');
}

/**
 * Formats a display title for status panel.
 * @param topicName Raw topic name.
 * @param topicType Decided topic type.
 * @returns {string} Beautified title.
 */
function beautifyTopicName(topicName: string, topicType: string): string {
  const nameBase = topicType !== 'Information' ? topicType : topicName;
  const normalized = nameBase.replaceAll('_', ' ').replaceAll('-', ' ').trim();
  if (normalized.length === 0) {
    return 'Unknown';
  }

  return normalized
    .split(' ')
    .filter((chunk: string): boolean => chunk.length > 0)
    .map((chunk: string): string => {
      return `${chunk.charAt(0).toUpperCase()}${chunk.slice(1).toLowerCase()}`;
    })
    .join(' ');
}