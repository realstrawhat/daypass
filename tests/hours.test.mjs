// Opening hours and next-slot wording, with fixed times so the result never depends on when this runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gymStatus, ratingShares } from '../lib/hours.ts';

const gym = { id: 'g', timezone: 'Europe/Amsterdam', open_hour: 7, close_hour: 21, weekend_open_hour: 9, weekend_close_hour: 18 };

test('a gym is open during its hours, in its own timezone', () => {
  // Wednesday 2026-11-04, 12:00 in Amsterdam is 11:00 UTC.
  assert.equal(gymStatus(gym, new Date('2026-11-04T11:00:00Z')).open, true);
  // 05:30 UTC is 06:30 in Amsterdam, before opening. It would be wrong if hours were compared in UTC.
  assert.equal(gymStatus(gym, new Date('2026-11-04T05:30:00Z')).open, false);
});

test('closing time and weekend hours are respected', () => {
  assert.equal(gymStatus(gym, new Date('2026-11-04T20:30:00Z')).open, false, '21:30 on a weekday is closed');
  // Saturday 2026-11-07, 08:00 in Amsterdam is before the later weekend opening.
  assert.equal(gymStatus(gym, new Date('2026-11-07T07:00:00Z')).open, false);
  assert.equal(gymStatus(gym, new Date('2026-11-07T09:00:00Z')).open, true);
});

test('after closing, the next time offered is the following morning', () => {
  const status = gymStatus(gym, new Date('2026-11-04T21:30:00Z'));
  assert.match(status.line, /tomorrow/i);
  assert.match(status.nextSlot ?? '', /^Tomorrow/);
});

test('rating bars cover five bands and follow the average', () => {
  const high = ratingShares(4.8);
  const low = ratingShares(3.6);
  assert.equal(high.length, 5);
  assert.ok(high[0] > low[0], 'a higher average puts more in the top band');
});
