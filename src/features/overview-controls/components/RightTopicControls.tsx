import type { ChangeEvent, JSX, MouseEvent } from 'react';
import type { ControlIconKind, TopicControlItem } from '../../../domain/messages/controlElementDecisions';

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
                <ControlIcon iconKind={item.iconKind} />
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
 * @param props.iconKind Icon type to render.
 * @returns {JSX.Element} SVG icon.
 */
function ControlIcon(props: { iconKind: ControlIconKind }): JSX.Element {
  const { iconKind } = props;
  switch (iconKind) {
    case 'light':
      return <svg viewBox="0 0 24 24"><path d="M9 21h6v-1H9v1zm3-20a7 7 0 00-4 12.74V17h8v-3.26A7 7 0 0012 1zm2.6 11.45l-.6.35V15h-4v-2.2l-.6-.35A5 5 0 1114.6 12.45z" /></svg>;
    case 'temperature':
      return <svg viewBox="0 0 24 24"><path d="M14 14.76V5a2 2 0 10-4 0v9.76a4 4 0 104 0zM10 5a1 1 0 112 0v10.24l.3.22a3 3 0 11-2.6 0l.3-.22V5z" /></svg>;
    case 'humidity':
      return <svg viewBox="0 0 24 24"><path d="M12 2S6 9 6 13a6 6 0 0012 0c0-4-6-11-6-11zm0 15a4 4 0 01-4-4c0-2.36 2.88-6.93 4-8.57 1.12 1.64 4 6.21 4 8.57a4 4 0 01-4 4z" /></svg>;
    case 'pressure':
      return <svg viewBox="0 0 24 24"><path d="M12 4a9 9 0 100 18 9 9 0 000-18zm0 16a7 7 0 117-7 7 7 0 01-7 7zm1-7.59V8h-2v5l3.8 2.2 1-1.73z" /></svg>;
    case 'roller':
      return <svg viewBox="0 0 24 24"><path d="M4 4h16v4H4V4zm2 6h12v2H6v-2zm1 4h10v2H7v-2zm1 4h8v2H8v-2z" /></svg>;
    case 'window':
      return <svg viewBox="0 0 24 24"><path d="M3 4h18v16H3V4zm2 2v12h6V6H5zm8 0v12h6V6h-6z" /></svg>;
    case 'camera':
      return <svg viewBox="0 0 24 24"><path d="M9 5l1.5-2h3L15 5h4a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h4zm3 12a4 4 0 100-8 4 4 0 000 8z" /></svg>;
    case 'switch':
      return <svg viewBox="0 0 24 24"><path d="M7 7h10a5 5 0 010 10H7A5 5 0 017 7zm0 2a3 3 0 000 6h10a3 3 0 000-6H7zm0 1h3v4H7v-4z" /></svg>;
    default:
      return <svg viewBox="0 0 24 24"><path d="M5 5h14v14H5V5zm2 2v10h10V7H7z" /></svg>;
  }
}
