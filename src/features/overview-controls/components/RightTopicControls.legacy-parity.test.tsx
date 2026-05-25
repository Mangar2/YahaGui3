/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RightTopicControls } from './RightTopicControls';
import type { TopicControlItem } from '../../../domain/messages/controlElementDecisions';

afterEach((): void => {
  cleanup();
});

/**
 * Creates one default control item with optional overrides.
 * @param overrides Partial field overrides.
 * @returns {TopicControlItem} Control item.
 */
function createItem(overrides: Partial<TopicControlItem> = {}): TopicControlItem {
  return {
    topic: 'home/room/light_main',
    label: 'Light Main',
    valueText: 'on',
    unit: '',
    topicType: 'Switch',
    valueType: 'String',
    enumeration: [],
    isSwitch: true,
    isSwitchOn: true,
    iconAsset: null,
    ...overrides,
  };
}

describe('RightTopicControls legacy parity', (): void => {
  it('renders value text control when item is not switch', (): void => {
    render(
      <RightTopicControls
        controlItems={[createItem({ isSwitch: false, valueText: '23', unit: 'degC' })]}
        pendingPublishTopics={{}}
        onOpenDetail={vi.fn()}
        onPublishSwitchChange={vi.fn()}
      />,
    );

    expect(screen.getByText('23 degC')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('trims long value text like legacy overview cards', (): void => {
    render(
      <RightTopicControls
        controlItems={[
          createItem({
            isSwitch: false,
            valueText: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
            unit: '',
          }),
        ]}
        pendingPublishTopics={{}}
        onOpenDetail={vi.fn()}
        onPublishSwitchChange={vi.fn()}
      />,
    );

    expect(screen.getByText('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO...')).toBeTruthy();
  });

  it('renders switch control and forwards change without opening detail', (): void => {
    const onOpenDetail = vi.fn();
    const onPublishSwitchChange = vi.fn();

    render(
      <RightTopicControls
        controlItems={[createItem({ topic: 'home/room/socket_1', isSwitchOn: true })]}
        pendingPublishTopics={{}}
        onOpenDetail={onOpenDetail}
        onPublishSwitchChange={onPublishSwitchChange}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(onPublishSwitchChange).toHaveBeenCalledTimes(1);
    expect(onPublishSwitchChange).toHaveBeenCalledWith(expect.objectContaining({ topic: 'home/room/socket_1' }), false);
    expect(onOpenDetail).toHaveBeenCalledTimes(0);
  });

  it('opens detail when card itself is clicked', (): void => {
    const onOpenDetail = vi.fn();

    render(
      <RightTopicControls
        controlItems={[createItem({ topic: 'home/room/fan' })]}
        pendingPublishTopics={{}}
        onOpenDetail={onOpenDetail}
        onPublishSwitchChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(onOpenDetail).toHaveBeenCalledWith('home/room/fan');
  });

  it('shows pending spinner while a topic update is running', (): void => {
    render(
      <RightTopicControls
        controlItems={[createItem({ topic: 'home/room/socket_1' })]}
        pendingPublishTopics={{ 'home/room/socket_1': true }}
        onOpenDetail={vi.fn()}
        onPublishSwitchChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Warte auf Rueckmeldung')).toBeTruthy();
  });
});
