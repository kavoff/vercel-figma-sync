import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requireAuth()

    const { key } = await params
    const body = await request.json()
    const { value_en, value_ru, status, key: newKey } = body

    const supabase = await createClient()

    const { data: activeProject } = await supabase.from("projects").select("id").eq("is_active", true).maybeSingle()

    const updateData: Record<string, unknown> = {}
    
    if (value_en !== undefined) updateData.value_en = value_en
    if (value_ru !== undefined) updateData.value_ru = value_ru
    
    if (status !== undefined) updateData.status = status
    
    if (newKey && typeof newKey === "string") updateData.key = newKey
    if (activeProject?.id) updateData.project_id = activeProject.id

    const { data, error } = await supabase
      .from("texts")
      .update(updateData)
      .eq("key", key)
      .select()
      .single()

    if (error) {
      console.error("[v0] Update text error:", error.message)
      throw error
    }

    return NextResponse.json({ text: data })
  } catch (error) {
    console.error("[v0] Update text error:", error)

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to update text" 
    }, { status: 500 })
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
