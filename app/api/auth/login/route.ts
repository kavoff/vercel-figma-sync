import { type NextRequest, NextResponse } from "next/server"
import { createSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    const adminPassword = process.env.ADMIN_PASSWORD || "change-me-in-production"

    if (password === adminPassword) {
      await createSession()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
