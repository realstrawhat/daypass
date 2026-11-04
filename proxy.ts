import { NextResponse, type NextRequest } from 'next/server';

// Browsing is open to everyone. Only a person's own passes and account need a login.
// The pages also check the session themselves, so a made-up cookie gets nowhere.
export function proxy(request: NextRequest) {
  if (request.cookies.has('daypass_session')) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const login = new URL('/login', request.url);
  login.searchParams.set('next', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/bookings/:path*', '/account'],
};
