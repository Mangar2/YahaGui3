import type { ChangeEvent, JSX, MouseEvent } from 'react';
import type { ControlIconAsset, TopicControlItem } from '../../../domain/messages/controlElementDecisions';

interface RightTopicControlsProps {
  controlItems: TopicControlItem[];
  pendingPublishTopics: Record<string, boolean>;
  onOpenDetail: (topic: string) => void;
  onPublishSwitchChange: (item: TopicControlItem, checked: boolean) => void;
}

/**
 * Renders the overview controls cards on the right side.
 * @param props Component props.
 * @returns {JSX.Element} Controls card grid.
 */
export function RightTopicControls(props: RightTopicControlsProps): JSX.Element {
  const { controlItems, pendingPublishTopics, onOpenDetail, onPublishSwitchChange } = props;

  return (
    <section className="controls-grid" aria-label="Kontrollelemente">
      {controlItems.map((item: TopicControlItem): JSX.Element => {
        const isPending = pendingPublishTopics[item.topic] === true;
        return (
          <button
            key={item.topic}
            className="control-card"
            type="button"
            onClick={(): void => {
              onOpenDetail(item.topic);
            }}
          >
            <div className="control-card-main">
              <span className="control-card-icon" aria-hidden="true">
                <ControlIcon iconAsset={item.iconAsset} />
              </span>
              <span className="control-card-text">
                <span className="control-card-topic" title={item.label}>
                  {item.label}
                </span>
                {item.isSwitch ? (
                  <label
                    className="control-card-switch"
                    onClick={(event: MouseEvent<HTMLLabelElement>): void => {
                      event.stopPropagation();
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.isSwitchOn}
                      disabled={isPending}
                      onChange={(event: ChangeEvent<HTMLInputElement>): void => {
                        onPublishSwitchChange(item, event.currentTarget.checked);
                      }}
                    />
                    <span aria-hidden="true" className="control-card-slider" />
                  </label>
                ) : (
                  <span className="control-card-value" title={`${item.valueText} ${item.unit}`.trim()}>
                    {item.valueText}
                    {item.unit.length > 0 ? ` ${item.unit}` : ''}
                  </span>
                )}
              </span>
            </div>
            {isPending ? <span className="control-card-spinner" aria-label="Warte auf Rueckmeldung" /> : null}
          </button>
        );
      })}
    </section>
  );
}

/**
 * Renders an icon glyph for one control item.
 * @param props Icon props.
 * @param props.iconAsset Icon asset file name.
 * @returns {JSX.Element | null} Icon image node.
 */
function ControlIcon(props: { iconAsset: ControlIconAsset }): JSX.Element | null {
  const { iconAsset } = props;
  if (iconAsset === null || iconAsset.length === 0) {
    return null;
  }

  return <img src={`/assets/${iconAsset}`} alt="" loading="lazy" decoding="async" />;
}
