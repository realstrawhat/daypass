import { handle, readJson } from '@/lib/auth';
import { ownerLogin, ownerLogout } from '@/lib/owner';

export const POST = handle(async (req) => {
  const { password } = await readJson(req);
  await ownerLogin(String(password ?? ''));
  return Response.json({ ok: true });
});

export const DELETE = handle(async () => {
  await ownerLogout();
  return Response.json({ ok: true });
});
