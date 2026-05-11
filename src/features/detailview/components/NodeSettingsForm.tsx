import { useEffect, useMemo, useState, type ChangeEvent, type JSX } from 'react';
import {
  TOPIC_ICON_OPTIONS,
  TOPIC_RANK_OPTIONS,
  TOPIC_TYPE_OPTIONS,
  VALUE_TYPE_OPTIONS,
} from '../../../config/nodeSettingsOptions';
import { splitTopic } from '../../../domain/messages/topicPath';
import type { TopicNavSettings, TopicSettingsStore } from '../../../domain/settings/interfaces';

interface NodeSettingsFormProps {
  topic: string;
  settingsStore: TopicSettingsStore;
}

interface NodeSettingViewState {
  topicType: string;
  topicRank: string;
  topicIcon: string;
  valueType: string;
  enumInput: string;
  enumList: string[];
}

/**
 * Renders and manages node settings for one detail topic.
 * Every setting mutation is written to local store immediately, matching legacy behavior.
 * @param props Component props.
 * @returns {JSX.Element} Node settings form.
 */
export function NodeSettingsForm(props: NodeSettingsFormProps): JSX.Element {
  const { topic, settingsStore } = props;

  const navSettings = useMemo((): TopicNavSettings => {
    return settingsStore.getNavSettings(splitTopic(topic));
  }, [settingsStore, topic]);

  const [viewState, setViewState] = useState<NodeSettingViewState>(() => {
    return readViewState(navSettings);
  });

  useEffect((): void => {
    setViewState(readViewState(navSettings));
  }, [navSettings]);

  /**
   * Handles topic type changes.
   * @param event Select change event.
   */
  function handleTopicTypeChange(event: ChangeEvent<HTMLSelectElement>): void {
    const nextTopicType = event.currentTarget.value;
    navSettings.setTopicType(nextTopicType);
    settingsStore.writeToLocalStore();
    setViewState(readViewState(navSettings));
  }

  /**
   * Handles topic rank changes.
   * @param event Select change event.
   */
  function handleTopicRankChange(event: ChangeEvent<HTMLSelectElement>): void {
    const nextRank = event.currentTarget.value;
    navSettings.setTopicRank(nextRank);
    settingsStore.writeToLocalStore();
    setViewState(readViewState(navSettings));
  }

  /**
   * Handles icon name changes.
   * @param event Select change event.
   */
  function handleTopicIconChange(event: ChangeEvent<HTMLSelectElement>): void {
    const nextIcon = event.currentTarget.value;
    navSettings.setIconName(nextIcon);
    settingsStore.writeToLocalStore();
    setViewState(readViewState(navSettings));
  }

  /**
   * Handles value type changes.
   * @param event Select change event.
   */
  function handleValueTypeChange(event: ChangeEvent<HTMLSelectElement>): void {
    const nextValueType = event.currentTarget.value;
    navSettings.setValueType(nextValueType);
    settingsStore.writeToLocalStore();
    setViewState(readViewState(navSettings));
  }

  /**
   * Handles enumeration input changes.
   * @param event Input change event.
   */
  function handleEnumInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextInput = event.currentTarget.value;
    setViewState((currentState: NodeSettingViewState): NodeSettingViewState => {
      return {
        ...currentState,
        enumInput: nextInput,
      };
    });
  }

  /**
   * Adds a value to enumeration list.
   */
  function addEnumValue(): void {
    const nextValue = viewState.enumInput.trim();
    if (nextValue.length === 0) {
      return;
    }

    const nextList = [...navSettings.getEnumList(), nextValue];
    navSettings.setEnumList(nextList);
    settingsStore.writeToLocalStore();
    setViewState(readViewState(navSettings));
  }

  /**
   * Removes first matching value from enumeration list.
   * @param value Value to remove.
   */
  function removeEnumValue(value: string): void {
    const currentList = [...navSettings.getEnumList()];
    const index = currentList.indexOf(value);
    if (index < 0) {
      return;
    }

    currentList.splice(index, 1);
    navSettings.setEnumList(currentList);
    settingsStore.writeToLocalStore();
    setViewState(readViewState(navSettings));
  }

  const showParameterSettings = viewState.topicType === 'Parameter';
  const showEnumSettings = showParameterSettings && viewState.valueType === 'Enumeration';

  return (
    <div className="node-settings-form" aria-label="Node settings editor">
      <div className="node-settings-group">
        <label className="node-settings-label" htmlFor="node-settings-topic-type">
          Select topic type
        </label>
        <select
          id="node-settings-topic-type"
          className="node-settings-select"
          value={viewState.topicType}
          onChange={handleTopicTypeChange}
        >
          {TOPIC_TYPE_OPTIONS.map((option: string): JSX.Element => {
            return (
              <option key={option} value={option}>
                {option}
              </option>
            );
          })}
        </select>

        <label className="node-settings-label" htmlFor="node-settings-topic-rank">
          Select topic rank
        </label>
        <select
          id="node-settings-topic-rank"
          className="node-settings-select"
          value={viewState.topicRank}
          onChange={handleTopicRankChange}
        >
          {TOPIC_RANK_OPTIONS.map((option: string): JSX.Element => {
            return (
              <option key={option} value={option}>
                {option}
              </option>
            );
          })}
        </select>

        <label className="node-settings-label" htmlFor="node-settings-topic-icon">
          Select icon
        </label>
        <select
          id="node-settings-topic-icon"
          className="node-settings-select"
          value={viewState.topicIcon}
          onChange={handleTopicIconChange}
        >
          {TOPIC_ICON_OPTIONS.map((option: string): JSX.Element => {
            return (
              <option key={option} value={option}>
                {option}
              </option>
            );
          })}
        </select>
      </div>

      {showParameterSettings ? (
        <div className="node-settings-group" aria-label="Parameter settings">
          <label className="node-settings-label" htmlFor="node-settings-value-type">
            Select value type
          </label>
          <select
            id="node-settings-value-type"
            className="node-settings-select"
            value={viewState.valueType}
            onChange={handleValueTypeChange}
          >
            {VALUE_TYPE_OPTIONS.map((option: string): JSX.Element => {
              return (
                <option key={option} value={option}>
                  {option}
                </option>
              );
            })}
          </select>

          {showEnumSettings ? (
            <>
              <ul className="node-settings-enum-list" aria-label="Enumeration list">
                {viewState.enumList.map((entry: string, index: number): JSX.Element => {
                  const key = `${entry}-${String(index)}`;
                  return (
                    <li key={key} className="node-settings-enum-item">
                      <span>{entry}</span>
                      <button
                        type="button"
                        className="node-settings-enum-remove"
                        onClick={(): void => {
                          removeEnumValue(entry);
                        }}
                      >
                        Delete
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="node-settings-enum-add-row">
                <label className="node-settings-label" htmlFor="node-settings-enum-input">
                  Add to enumeration
                </label>
                <div className="node-settings-enum-add-control">
                  <input
                    id="node-settings-enum-input"
                    className="node-settings-input"
                    value={viewState.enumInput}
                    onChange={handleEnumInputChange}
                  />
                  <button
                    type="button"
                    className="node-settings-enum-add"
                    onClick={addEnumValue}
                    disabled={viewState.enumInput.trim().length === 0}
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Reads the node settings into view state.
 * @param settings Node settings model.
 * @returns {NodeSettingViewState} Mapped view state.
 */
function readViewState(settings: TopicNavSettings): NodeSettingViewState {
  return {
    topicType: settings.getTopicType(),
    topicRank: String(settings.getTopicRank()),
    topicIcon: settings.getIconName(),
    valueType: settings.getValueType(),
    enumInput: '',
    enumList: settings.getEnumList(),
  };
}