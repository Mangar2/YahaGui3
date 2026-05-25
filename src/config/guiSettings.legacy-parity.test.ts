import { describe, expect, it } from 'vitest';
import {
  DETAIL_REFRESH_INTERVAL_MS,
  MAIN_REFRESH_INTERVAL_MS,
  PUBLISH_VERIFY_ATTEMPTS,
  PUBLISH_VERIFY_INTERVAL_MS,
} from './guiSettings';

describe('guiSettings legacy parity', (): void => {
  it('matches legacy overview and detail refresh intervals', (): void => {
    expect(MAIN_REFRESH_INTERVAL_MS).toBe(2000);
    expect(DETAIL_REFRESH_INTERVAL_MS).toBe(2000);
  });

  it('matches legacy publish verification polling defaults', (): void => {
    expect(PUBLISH_VERIFY_INTERVAL_MS).toBe(700);
    expect(PUBLISH_VERIFY_ATTEMPTS).toBe(15);
  });
});
