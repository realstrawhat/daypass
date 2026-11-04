import { randomUUID } from 'node:crypto';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { createSession, handle, HttpError, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';

const site = (req: Request) => {
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') ?? url.host;
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return { rpID: host.split(':')[0], origin: `${proto}://${host}` };
};

async function saveChallenge(challenge: string, userId: string | null) {
  const id = randomUUID();
  await db()`DELETE FROM auth_challenges WHERE expires_at < now()`;
  await db()`INSERT INTO auth_challenges (id, challenge, user_id, expires_at) VALUES (${id}, ${challenge}, ${userId}::uuid, now() + interval '5 minutes')`;
  return id;
}

async function takeChallenge(id: string) {
  const rows = await db()`DELETE FROM auth_challenges WHERE id = ${id} AND expires_at > now() RETURNING challenge, user_id`;
  if (!rows[0]) throw new HttpError(400, 'Face ID timed out. Try again.');
  return rows[0] as { challenge: string; user_id: string | null };
}

export const POST = handle(async (req, ctx) => {
  const { action } = await ctx.params;
  const { rpID, origin } = site(req);

  if (action === 'register-options') {
    const user = await requireUser();
    const existing = await db()`SELECT credential_id FROM passkeys WHERE user_id = ${user.id}::uuid`;
    const options = await generateRegistrationOptions({
      rpName: 'Daypass',
      rpID,
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({ id: c.credential_id as string })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    return Response.json({ id: await saveChallenge(options.challenge, user.id), options });
  }

  if (action === 'register-verify') {
    const user = await requireUser();
    const body = await req.json();
    const c = await takeChallenge(String(body.id));
    if (c.user_id !== user.id) throw new HttpError(400, 'Face ID setup did not match this account.');
    const result = await verifyRegistrationResponse({ response: body.response, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpID });
    if (!result.verified || !result.registrationInfo) throw new HttpError(400, 'Face ID could not be verified.');
    const cred = result.registrationInfo.credential;
    await db()`INSERT INTO passkeys (credential_id, user_id, public_key, counter, transports)
      VALUES (${cred.id}, ${user.id}::uuid, ${Buffer.from(cred.publicKey).toString('base64url')}, ${cred.counter}, ${cred.transports ?? []})`;
    return Response.json({ ok: true });
  }

  if (action === 'login-options') {
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
    return Response.json({ id: await saveChallenge(options.challenge, null), options });
  }

  if (action === 'login-verify') {
    const body = await req.json();
    const c = await takeChallenge(String(body.id));
    const rows = await db()`SELECT p.* FROM passkeys p JOIN users u ON u.id = p.user_id WHERE p.credential_id = ${String(body.response?.id)} AND u.deletion_requested_at IS NULL`;
    const pk = rows[0];
    if (!pk) throw new HttpError(401, 'This device has no Face ID set up here. Log in with your password, then turn it on under Account.');
    const result = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: c.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: pk.credential_id as string, publicKey: new Uint8Array(Buffer.from(pk.public_key as string, 'base64url')), counter: Number(pk.counter), transports: pk.transports as never },
    });
    if (!result.verified) throw new HttpError(401, 'Face ID could not be verified. Use your password.');
    await db()`UPDATE passkeys SET counter = ${result.authenticationInfo.newCounter} WHERE credential_id = ${pk.credential_id as string}`;
    await createSession(pk.user_id as string);
    return Response.json({ ok: true });
  }

  throw new HttpError(404, 'Not found.');
});
