export type TopicParameterMap = Record<string, string>;

export interface TopicNodeSettingsPayload {
  disabled?: string[];
  parameter?: TopicParameterMap;
}

export type TopicSettingsPayload = Record<string, TopicNodeSettingsPayload>;

interface TopicNodeSettingsState {
  disabled: string[];
  parameter: TopicParameterMap;
}

const LOCAL_STORAGE_KEY = 'yaha_configuration';

/**
 * Checks whether a value is an object-like record.
 * @param value Candidate value.
 * @returns {value is Record<string, unknown>} True when value can be treated as record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Class representing one topic-specific navigation setting.
 */
export class TopicNavSettings {
  private disabled: string[];
  private parameter: TopicParameterMap;

  /**
   * Creates one topic settings model.
   * @param state Initial state.
   */
  public constructor(state: TopicNodeSettingsState = { disabled: [], parameter: {} }) {
    this.disabled = [...state.disabled];
    this.parameter = { ...state.parameter };
  }

  /**
   * Creates a class instance from API/localStorage payload.
   * @param payload Serialized payload.
   * @returns {TopicNavSettings} Parsed settings model.
   */
  public static fromPayload(payload: TopicNodeSettingsPayload): TopicNavSettings {
    const disabled = Array.isArray(payload.disabled)
      ? payload.disabled.filter((entry: unknown): entry is string => typeof entry === 'string')
      : [];

    const parameter: TopicParameterMap = {};
    if (isRecord(payload.parameter)) {
      for (const [name, value] of Object.entries(payload.parameter)) {
        if (typeof value === 'string') {
          parameter[name] = value;
        }
      }
    }

    return new TopicNavSettings({ disabled, parameter });
  }

  /**
   * Sets an item to disabled state.
   * @param name Item name.
   */
  public disable(name: string): void {
    if (!this.disabled.includes(name)) {
      this.disabled.push(name);
    }
  }

  /**
   * Sets an item to enabled state.
   * @param name Item name.
   */
  public enable(name: string): void {
    const disabledIndex = this.disabled.indexOf(name);
    if (disabledIndex >= 0) {
      this.disabled.splice(disabledIndex, 1);
    }
  }

  /**
   * Enables or disables one named item.
   * @param name Item name.
   * @param value True when item should be enabled.
   */
  public setEnabled(name: string, value: boolean): void {
    if (value) {
      this.enable(name);
      return;
    }
    this.disable(name);
  }

  /**
   * Checks whether one item is enabled.
   * @param name Item name.
   * @returns {boolean} True when item is visible/enabled.
   */
  public isEnabled(name: string): boolean {
    return !this.disabled.includes(name) && name !== 'set';
  }

  /**
   * Indicates whether all items are enabled.
   * @returns {boolean} True when no disabled entries exist.
   */
  public allEnabled(): boolean {
    return this.disabled.length === 0;
  }

  /**
   * Returns number of disabled entries.
   * @returns {number} Disabled count.
   */
  public countDisabled(): number {
    return this.disabled.length;
  }

  /**
   * Sets one named parameter value.
   * @param name Parameter name.
   * @param value Parameter value or null to remove.
   */
  private setParameter(name: string, value: string | null): void {
    if (name.length === 0) {
      return;
    }

    if (value === null) {
      this.parameter = Object.fromEntries(
        Object.entries(this.parameter).filter(([parameterName]): boolean => parameterName !== name),
      );
      return;
    }

    this.parameter[name] = value;
  }

  /**
   * Reads one named parameter value.
   * @param name Parameter name.
   * @returns {string | null} Parameter value or null.
   */
  private getParameter(name: string): string | null {
    if (name.length === 0) {
      return null;
    }
    return this.parameter[name] ?? null;
  }

  /**
   * Sets configured topic type.
   * @param topicType Topic type.
   */
  public setTopicType(topicType: string): void {
    this.setParameter('topicType', topicType === 'Automatic' ? null : topicType);
  }

  /**
   * Returns configured topic type.
   * @returns {string} Topic type value.
   */
  public getTopicType(): string {
    return this.getParameter('topicType') ?? 'Automatic';
  }

  /**
   * Sets configured value type.
   * @param valueType Value type.
   */
  public setValueType(valueType: string): void {
    this.setParameter('valueType', valueType === 'Automatic' ? null : valueType);
  }

  /**
   * Returns configured value type.
   * @returns {string} Value type value.
   */
  public getValueType(): string {
    return this.getParameter('valueType') ?? 'Automatic';
  }

  /**
   * Sets enumeration list as serialized JSON array.
   * @param enumList Enumeration options.
   */
  public setEnumList(enumList: string[]): void {
    this.setParameter('enumList', enumList.length === 0 ? null : JSON.stringify(enumList));
  }

  /**
   * Returns configured enumeration list.
   * @returns {string[]} Enumeration option list.
   */
  public getEnumList(): string[] {
    const encodedList = this.getParameter('enumList');
    if (encodedList === null) {
      return [];
    }

    try {
      const parsedList: unknown = JSON.parse(encodedList);
      if (!Array.isArray(parsedList)) {
        return [];
      }
      return parsedList.filter((entry: unknown): entry is string => typeof entry === 'string');
    } catch {
      return [];
    }
  }

  /**
   * Sets topic rank value.
   * @param rank Rank value.
   */
  public setTopicRank(rank: string): void {
    this.setParameter('topicRank', rank === 'Automatic' ? null : rank);
  }

  /**
   * Returns topic rank value.
   * @returns {number} Rank or legacy fallback value.
   */
  public getTopicRank(): number {
    const rankValue = this.getParameter('topicRank');
    if (rankValue === null || rankValue === 'Automatic') {
      return 6;
    }
    const numericRank = Number(rankValue);
    return Number.isFinite(numericRank) ? numericRank : 6;
  }

  /**
   * Sets icon name.
   * @param iconName Icon name.
   */
  public setIconName(iconName: string): void {
    this.setParameter('icon', iconName === 'Automatic' ? null : iconName);
  }

  /**
   * Returns icon name.
   * @returns {string} Icon name.
   */
  public getIconName(): string {
    return this.getParameter('icon') ?? 'Automatic';
  }

  /**
   * Sets history type.
   * @param historyType History type.
   */
  public setHistoryType(historyType: string): void {
    this.setParameter('history', historyType === 'Automatic' ? null : historyType);
  }

  /**
   * Returns history type.
   * @returns {string} History type.
   */
  public getHistoryType(): string {
    return this.getParameter('history') ?? 'Automatic';
  }

  /**
   * Sets chart type.
   * @param chartType Chart type.
   */
  public setChartType(chartType: string): void {
    this.setParameter('chart', chartType === 'Automatic' ? null : chartType);
  }

  /**
   * Returns chart type.
   * @returns {string} Chart type.
   */
  public getChartType(): string {
    return this.getParameter('chart') ?? 'Automatic';
  }

  /**
   * Creates an independent copy.
   * @returns {TopicNavSettings} Cloned settings.
   */
  public copy(): TopicNavSettings {
    return new TopicNavSettings({
      disabled: [...this.disabled],
      parameter: { ...this.parameter },
    });
  }

  /**
   * Serializes this node for API transport.
   * @returns {TopicNodeSettingsPayload} Full payload including empty collections.
   */
  public toTransportPayload(): TopicNodeSettingsPayload {
    return {
      disabled: [...this.disabled],
      parameter: { ...this.parameter },
    };
  }

  /**
   * Serializes this node for localStorage, omitting empty branches.
   * @returns {TopicNodeSettingsPayload | null} Reduced payload or null when empty.
   */
  public toLocalStorePayload(): TopicNodeSettingsPayload | null {
    const localPayload: TopicNodeSettingsPayload = {};
    if (!this.allEnabled()) {
      localPayload.disabled = [...this.disabled];
    }

    if (Object.keys(this.parameter).length > 0) {
      localPayload.parameter = { ...this.parameter };
    }

    return Object.keys(localPayload).length > 0 ? localPayload : null;
  }
}

/**
 * Settings store with legacy-compatible localStorage persistence.
 */
export class TopicSettingsStore {
  private navSettingsStore: Record<string, TopicNavSettings>;
  private readonly storeName: string;

  /**
   * Creates a settings store service.
   * @param storeName Browser localStorage key.
   */
  public constructor(storeName: string = LOCAL_STORAGE_KEY) {
    this.navSettingsStore = {};
    this.storeName = storeName;
    this.getFromLocalStore();
  }

  /**
   * Returns all settings as transport payload.
   * @returns {TopicSettingsPayload} Topic settings map.
   */
  public getAllSettings(): TopicSettingsPayload {
    const result: TopicSettingsPayload = {};
    for (const [topic, settings] of Object.entries(this.navSettingsStore)) {
      result[topic] = settings.toTransportPayload();
    }
    return result;
  }

  /**
   * Overwrites store content with one payload map.
   * @param settings Complete settings payload.
   */
  public setAllSettings(settings: TopicSettingsPayload): void {
    this.navSettingsStore = {};

    for (const [topic, payload] of Object.entries(settings)) {
      this.navSettingsStore[topic] = TopicNavSettings.fromPayload(payload);
    }

    this.writeToLocalStore();
  }

  /**
   * Gets settings for one topic path and creates defaults when missing.
   * @param topicChunks Topic chunks.
   * @returns {TopicNavSettings} Topic settings model.
   */
  public getNavSettings(topicChunks: string[]): TopicNavSettings {
    const topic = this.getTopic(topicChunks);
    const existingSettings = this.navSettingsStore[topic];
    if (existingSettings) {
      return existingSettings;
    }

    const defaultSettings = new TopicNavSettings();
    this.navSettingsStore[topic] = defaultSettings;
    return defaultSettings;
  }

  /**
   * Sets or replaces one topic settings entry.
   * @param topic Topic path.
   * @param settings Settings model.
   */
  public setNavSettings(topic: string, settings: TopicNavSettings): void {
    this.navSettingsStore[topic] = settings.copy();
    this.writeToLocalStore();
  }

  /**
   * Removes one topic settings entry.
   * @param topic Topic path.
   */
  public removeNavSettings(topic: string): void {
    this.navSettingsStore = Object.fromEntries(
      Object.entries(this.navSettingsStore).filter(([currentTopic]): boolean => currentTopic !== topic),
    );
    this.writeToLocalStore();
  }

  /**
   * Returns amount of currently stored topics.
   * @returns {number} Topic count.
   */
  public getStoredTopicCount(): number {
    return Object.keys(this.navSettingsStore).length;
  }

  /**
   * Writes reduced settings payload into localStorage.
   */
  public writeToLocalStore(): void {
    const dataToStore: TopicSettingsPayload = {};

    for (const [topic, settings] of Object.entries(this.navSettingsStore)) {
      const localPayload = settings.toLocalStorePayload();
      if (localPayload !== null) {
        dataToStore[topic] = localPayload;
      }
    }

    localStorage.setItem(this.storeName, JSON.stringify(dataToStore));
  }

  /**
   * Creates topic string from topic chunks.
   * @param topicChunks Topic chunks.
   * @returns {string} Joined topic string.
   */
  private getTopic(topicChunks: string[]): string {
    return topicChunks.join('/');
  }

  /**
   * Loads settings from localStorage and validates payload shape.
   */
  private getFromLocalStore(): void {
    const storedData = localStorage.getItem(this.storeName);
    if (storedData === null) {
      return;
    }

    try {
      const parsedPayload: unknown = JSON.parse(storedData);
      if (!isRecord(parsedPayload)) {
        return;
      }

      for (const [topic, payload] of Object.entries(parsedPayload)) {
        if (typeof topic !== 'string' || !isRecord(payload)) {
          continue;
        }
        this.navSettingsStore[topic] = TopicNavSettings.fromPayload(payload);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`local settings parsing failed: ${error.message}`);
      }
    }
  }
}
