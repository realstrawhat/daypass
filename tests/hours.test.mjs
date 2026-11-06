// Opening hours and next-slot wording, with fixed times so the result never depends on when this runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysUntil, doorIsOpen, gymStatus, hoursUntil, MAX_STAY_HOURS, ratingShares, refusalIsOpen, sameLocalDay, stayLabel, timerLabel, visitState } from '../lib/hours.ts';

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

test('the door is open from an hour before until three hours after the start', () => {
  assert.equal(doorIsOpen(1.5), false);
  assert.equal(doorIsOpen(1), true);
  assert.equal(doorIsOpen(-3), true);
  assert.equal(doorIsOpen(-3.1), false);
  assert.equal(hoursUntil('2026-11-04T12:00:00Z', Date.parse('2026-11-04T10:00:00Z')), 2);
});

test('refused entry opens on the day of the session and closes six hours after it starts', () => {
  const tz = 'Europe/Berlin';
  const start = '2026-11-04T17:00:00Z';
  assert.equal(refusalIsOpen(start, tz, Date.parse('2026-11-04T07:00:00Z')), true, 'that morning');
  assert.equal(refusalIsOpen(start, tz, Date.parse('2026-11-03T22:00:00Z')), false, 'the evening before');
  assert.equal(refusalIsOpen(start, tz, Date.parse('2026-11-04T22:30:00Z')), true, 'five and a half hours after');
  assert.equal(refusalIsOpen(start, tz, Date.parse('2026-11-04T23:30:00Z')), false, 'six and a half hours after');
});

test('calendar days follow the gym\'s own clock, so tomorrow evening is one day away', () => {
  const tz = 'Europe/Berlin';
  const now = Date.parse('2026-11-04T06:00:00Z');
  assert.equal(daysUntil('2026-11-05T18:00:00Z', tz, now), 1, '36 hours away is still tomorrow');
  assert.equal(daysUntil('2026-11-04T20:00:00Z', tz, now), 0);
  assert.equal(daysUntil('2026-11-04T23:30:00Z', tz, now), 1, 'past midnight in Berlin');
  assert.equal(sameLocalDay(new Date('2026-11-04T22:30:00Z'), new Date(now), tz), true);
  assert.equal(sameLocalDay(new Date('2026-11-04T23:30:00Z'), new Date(now), tz), false);
});

test('a visit is inside until it has an exit, and stops counting after the longest stay', () => {
  const now = Date.parse('2026-11-04T18:00:00Z');
  assert.equal(visitState(null, null, now), 'not_in');
  assert.equal(visitState('2026-11-04T17:00:00Z', null, now), 'inside');
  assert.equal(visitState('2026-11-04T17:00:00Z', '2026-11-04T17:40:00Z', now), 'left');
  assert.equal(visitState(now - MAX_STAY_HOURS * 3600000, null, now), 'inside', 'right on the limit');
  assert.equal(visitState(now - MAX_STAY_HOURS * 3600000 - 1000, null, now), 'no_exit');
});

test('times inside read naturally, and the timer never goes below zero', () => {
  assert.equal(stayLabel(20000), '1 min');
  assert.equal(stayLabel(48 * 60000), '48 min');
  assert.equal(stayLabel(120 * 60000), '2 h');
  assert.equal(stayLabel(72 * 60000), '1 h 12 min');
  assert.equal(timerLabel(4331000), '01:12:11');
  assert.equal(timerLabel(-5000), '00:00:00');
});
