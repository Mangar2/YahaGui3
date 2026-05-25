/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeSettingsForm } from './NodeSettingsForm';
import { TopicNavSettings, TopicSettingsStore } from '../../../domain/settings/interfaces';

afterEach((): void => {
  cleanup();
});

interface SettingsStoreMock extends TopicSettingsStore {
  __writes: number;
}

/**
 * Creates a settings-store mock with write tracking.
 * @returns {SettingsStoreMock} Store-like object.
 */
function createSettingsStoreMock(): SettingsStoreMock {
  const settingsByTopic: Record<string, TopicNavSettings> = {};
  const storeLike = {
    __writes: 0,
    getNavSettings(topicChunks: string[]): TopicNavSettings {
      const topic = topicChunks.join('/');
      const existing = settingsByTopic[topic];
      if (existing) {
        return existing;
      }

      const created = new TopicNavSettings();
      settingsByTopic[topic] = created;
      return created;
    },
    writeToLocalStore(): void {
      storeLike.__writes += 1;
    },
  };

  return storeLike as SettingsStoreMock;
}

describe('NodeSettingsForm legacy parity', (): void => {
  it('shows Parameter value-type controls only when topic type is Parameter', (): void => {
    const settingsStore = createSettingsStoreMock();

    render(<NodeSettingsForm topic="home/room/topic" settingsStore={settingsStore} />);

    expect(screen.queryByLabelText('Select value type')).toBeNull();

    fireEvent.change(screen.getByLabelText('Select topic type'), { target: { value: 'Parameter' } });

    expect(screen.getByLabelText('Select value type')).toBeTruthy();
  });

  it('persists topic/value type changes and notifies parent', (): void => {
    const settingsStore = createSettingsStoreMock();
    const onSettingsChange = vi.fn();

    render(<NodeSettingsForm topic="home/room/topic" settingsStore={settingsStore} onSettingsChange={onSettingsChange} />);

    fireEvent.change(screen.getByLabelText('Select topic type'), { target: { value: 'Parameter' } });
    fireEvent.change(screen.getByLabelText('Select value type'), { target: { value: 'Enumeration' } });

    expect(settingsStore.__writes).toBeGreaterThanOrEqual(2);
    expect(onSettingsChange).toHaveBeenCalledTimes(2);
  });

  it('adds and removes enumeration entries with immediate persistence', (): void => {
    const settingsStore = createSettingsStoreMock();

    render(<NodeSettingsForm topic="home/room/topic" settingsStore={settingsStore} onSettingsChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Select topic type'), { target: { value: 'Parameter' } });
    fireEvent.change(screen.getByLabelText('Select value type'), { target: { value: 'Enumeration' } });

    fireEvent.change(screen.getByLabelText('Add to enumeration'), { target: { value: 'auto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('auto')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.queryByText('auto')).toBeNull();
    expect(settingsStore.__writes).toBeGreaterThanOrEqual(4);
  });
});
