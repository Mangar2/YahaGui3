import { useMemo, useState, type ChangeEvent, type JSX } from 'react';
import type { MessageHistoryEntry, MessageReason, MessageScalar, MessageTreeNode } from '../../../domain/messages/interfaces';

interface DetailValueTableProps {
  activeNode: MessageTreeNode | null;
}

interface DetailHistoryRow {
  time?: string;
  value?: MessageScalar;
  reason?: MessageReason[];
}

const PAGE_SIZE_OPTIONS = [5, 20, 100] as const;

/**
 * Renders the legacy-equivalent detail value table with reason text and paging.
 * @param props Component props.
 * @returns {JSX.Element} Value table section.
 */
export function DetailValueTable(props: DetailValueTableProps): JSX.Element {
  const { activeNode } = props;
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const allRows = useMemo((): DetailHistoryRow[] => {
    if (!activeNode) {
      return [];
    }

    const currentRow: DetailHistoryRow = {
      time: activeNode.time,
      value: activeNode.value,
      reason: activeNode.reason,
    };

    const historyRows: MessageHistoryEntry[] = Array.isArray(activeNode.history) ? activeNode.history : [];
    return [currentRow, ...historyRows];
  }, [activeNode]);

  const pageCount = Math.max(1, Math.ceil(allRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pageStart = safePageIndex * pageSize;
  const pageRows = allRows.slice(pageStart, pageStart + pageSize);

  /**
   * Handles page-size selection and resets to first page.
   * @param event Select change event.
   */
  function handlePageSizeChange(event: ChangeEvent<HTMLSelectElement>): void {
    const selectedValue = Number(event.currentTarget.value);
    if (!Number.isFinite(selectedValue) || selectedValue <= 0) {
      return;
    }
    setPageSize(selectedValue);
    setPageIndex(0);
  }

  return (
    <section className="detail-history-content" aria-label="Value history table">
      <h3>History</h3>
      <div className="detail-history-table-wrapper">
        <table className="detail-history-table">
          <thead>
            <tr>
              <th scope="col">Value</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row: DetailHistoryRow, rowIndex: number): JSX.Element => {
              return (
                <tr key={`${row.time ?? 'unknown'}-${String(row.value ?? '')}-${String(rowIndex)}`}>
                  <td>{getValueString(row)}</td>
                  <td>{getReasonString(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="detail-history-paginator">
        <label>
          Rows per page
          <select value={String(pageSize)} onChange={handlePageSizeChange}>
            {PAGE_SIZE_OPTIONS.map((option: number): JSX.Element => {
              return (
                <option key={option} value={String(option)}>
                  {option}
                </option>
              );
            })}
          </select>
        </label>

        <div className="detail-history-pager-buttons">
          <button
            type="button"
            disabled={safePageIndex === 0}
            onClick={(): void => {
              setPageIndex(0);
            }}
          >
            {'<<'}
          </button>
          <button
            type="button"
            disabled={safePageIndex === 0}
            onClick={(): void => {
              setPageIndex((current: number): number => Math.max(0, current - 1));
            }}
          >
            {'<'}
          </button>
          <span>
            {safePageIndex + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={safePageIndex >= pageCount - 1}
            onClick={(): void => {
              setPageIndex((current: number): number => Math.min(pageCount - 1, current + 1));
            }}
          >
            {'>'}
          </button>
          <button
            type="button"
            disabled={safePageIndex >= pageCount - 1}
            onClick={(): void => {
              setPageIndex(pageCount - 1);
            }}
          >
            {'>>'}
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Returns displayable value text with legacy length truncation.
 * @param historyRow Current row.
 * @returns {string} Short value text.
 */
function getValueString(historyRow: DetailHistoryRow): string {
  let result = historyRow.value !== undefined ? String(historyRow.value) : '';
  if (result.length > 80) {
    result = result.substring(0, 79);
  }
  return result;
}

/**
 * Returns formatted reason text for one history row.
 * @param historyRow Current row.
 * @returns {string} Formatted reason text.
 */
function getReasonString(historyRow: DetailHistoryRow): string {
  const reasons = historyRow.reason ?? [];
  if (reasons.length === 0) {
    return `${beautifyTimeString(historyRow.time, true)} (Updated)`;
  }

  let result = '';
  let separator = '';
  let addDate = true;
  for (let index = 0; index < reasons.length; index += 1) {
    const reason = reasons[index];
    if (!reason) {
      continue;
    }
    result += `${separator}${String(index + 1)}. ${reason.message} (${beautifyTimeString(reason.timestamp, addDate)})`;
    addDate = false;
    separator = ' ';
  }

  return result;
}

/**
 * Returns localized time text, optionally with date similar to legacy UI.
 * @param timestamp Timestamp string.
 * @param addDate Whether date should be prefixed.
 * @returns {string} Formatted timestamp.
 */
function beautifyTimeString(timestamp: string | undefined, addDate: boolean): string {
  if (timestamp === undefined) {
    return '';
  }

  const date = new Date(timestamp);
  if (timestamp.length === 0 || Number.isNaN(date.getTime())) {
    return timestamp.length > 0 ? timestamp : 'unknown';
  }

  const timeString = date.toLocaleTimeString();
  const dateString = isToday(date)
    ? 'Today'
    : date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });

  return addDate ? `${dateString}, ${timeString}` : timeString;
}

/**
 * Checks whether the given date is today.
 * @param date Date to test.
 * @returns {boolean} True when date is today.
 */
function isToday(date: Date): boolean {
  const givenDate = new Date(date.getTime());
  const todayDate = new Date();
  return givenDate.setHours(0, 0, 0, 0) === todayDate.setHours(0, 0, 0, 0);
}
