import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await request.json()

    const supabase = await createClient()

    // If setting as active, deactivate all others first
    if (body.is_active) {
      await supabase.from("projects").update({ is_active: false }).neq("id", id)
    }

    const { data, error } = await supabase.from("projects").update(body).eq("id", id).select().single()

    if (error) throw error

    return NextResponse.json({ project: data })
  } catch (error) {
    console.error("[v0] Update project error:", error)

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params

    const supabase = await createClient()

    const { error } = await supabase.from("projects").delete().eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Delete project error:", error)

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
