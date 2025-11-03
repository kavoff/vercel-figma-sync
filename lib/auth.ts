import { cookies } from "next/headers"

const SESSION_COOKIE_NAME = "textsync_session"
const SESSION_SECRET = process.env.ADMIN_PASSWORD || "change-me-in-production"

export async function createSession() {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, SESSION_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE_NAME)
  return session?.value === SESSION_SECRET
}

export async function requireAuth() {
  const authenticated = await isAuthenticated()
  if (!authenticated) {
    throw new Error("Unauthorized")
  }
}
