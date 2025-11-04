import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { syncToGitHub } from "@/lib/github"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requireAuth()

    const { key } = await params
    const body = await request.json()
    const { value, status, key: newKey } = body

    const supabase = await createClient()

    // Ensure project scoping: attach project_id if missing
    const { data: activeProject } = await supabase.from("projects").select("id").eq("is_active", true).maybeSingle()

    const updateData: Record<string, unknown> = {}
    if (value !== undefined) updateData.value = value
    if (status !== undefined) updateData.status = status
    if (newKey && typeof newKey === "string") updateData.key = newKey
    if (activeProject?.id) (updateData as any).project_id = activeProject.id

    const { data, error } = await supabase
      .from("texts")
      .update(updateData)
      .eq("key", key)
      .select()
      .single()

    if (error) {
      throw error
    }

    // Auto GitHub sync removed; use manual sync endpoint instead

    return NextResponse.json({ text: data })
  } catch (error) {
    console.error("[v0] Update text error:", error)

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Failed to update text" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const supabase = await createClient()

    const { data, error } = await supabase.from("texts").select("*").eq("key", key).single()

    if (error) {
      throw error
    }

    return NextResponse.json({ text: data })
  } catch (error) {
    console.error("[v0] Get text error:", error)
    return NextResponse.json({ error: "Text not found" }, { status: 404 })
  }
}
