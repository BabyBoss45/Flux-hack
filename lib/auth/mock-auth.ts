import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserByEmail, createUser, getUserById, type User } from '@/lib/db/queries';

const SESSION_COOKIE_NAME = 'session_user_id';

export interface Session {
  user: User;
}

export async function login(email: string, name?: string): Promise<User> {
  let user = getUserByEmail(email);

  if (!user) {
    // Auto-create user if doesn't exist
    const displayName = name || email.split('@')[0];
    user = createUser(email, displayName);
  }

  if (!user) {
    throw new Error('Failed to create or find user');
  }

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, String(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  });

  return user;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  const userId = parseInt(sessionCookie.value, 10);
  if (isNaN(userId)) {
    return null;
  }

  const user = getUserById(userId);
  if (!user) {
    // User doesn't exist (possibly database was reset)
    // Return null - the logout API will clear the cookie when called
    return null;
  }

  return { user };
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user || null;
}
