import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth/mock-auth';

export async function POST() {
  try {
    await logout();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}

// GET handler for redirect-based logout (clears cookie and redirects to login)
export async function GET(request: Request) {
  try {
    await logout();
    const url = new URL(request.url);
    const redirect = url.searchParams.get('redirect') || '/login';
    return NextResponse.redirect(new URL(redirect, request.url));
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
