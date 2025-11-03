import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"

export async function middleware(request: NextRequest) {
  const cookieStore = await cookies()
  const session = cookieStore.get("textsync_session")
  const adminPassword = process.env.ADMIN_PASSWORD || "change-me-in-production"
  const isAuthenticated = session?.value === adminPassword

  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  // Redirect to admin if already logged in and trying to access login
  if (request.nextUrl.pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
