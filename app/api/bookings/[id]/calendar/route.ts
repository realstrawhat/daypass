import { HttpError, handle, requireUser } from '@/lib/auth';
import { getBookingView } from '@/lib/bookings';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');

// A standard calendar file. The alert covers the day-before reminder.
export const GET = handle(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const b = await getBookingView(user.id, id);
  if (!b || b.status !== 'confirmed') throw new HttpError(404, 'Booking not found.');
  const start = new Date(b.starts_at);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daypass//Day pass//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.id}@daypass`,
    `SEQUENCE:${b.confirmation_version}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`Gym session at ${b.gym_name}`)}`,
    `LOCATION:${esc(b.gym_address)}`,
    `DESCRIPTION:${esc(`Day pass code ${b.code}`)}`,
    `GEO:${b.gym_lat};${b.gym_lng}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`Tomorrow: gym session at ${b.gym_name}`)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  return new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="daypass-${b.code}.ics"`, 'Cache-Control': 'no-store' } });
});
