import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] GET /api/texts - starting")
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[v0] Missing Supabase environment variables")
      return NextResponse.json({ 
        texts: [], 
        error: "Supabase not configured. Please check environment variables." 
      }, { status: 500 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const category = searchParams.get("category")
    const q = searchParams.get("q")

    const supabase = await createClient()

    let { data: activeProject, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log("[v0] Active project query result:", activeProject?.id || "none", "error:", projectError?.message || "none")

    if (!activeProject && !projectError) {
      console.log("[v0] No active project, creating default...")
      const { data: newProject, error: createError } = await supabase
        .from("projects")
        .insert({
          name: "Default Project",
          github_owner: "",
          github_repo: "",
          github_branch: "main",
          github_path: "locales",
          github_token: "",
          is_active: true,
        })
        .select()
        .single()
      
      if (createError) {
        console.error("[v0] Failed to create project:", createError)
      } else {
        activeProject = newProject
        console.log("[v0] Created default project:", activeProject?.id)
      }
    }

    let query = supabase
      .from("texts")
      .select("*")
      .order("updated_at", { ascending: false })

    // Only filter by project if one exists
    if (activeProject?.id) {
      query = query.eq("project_id", activeProject.id)
    }

    if (status) {
      if (status === 'approved') {
        query = query.eq("status", "done")
      } else {
        query = query.eq("status", status)
      }
    }

    if (category && category !== "all") {
      query = query.eq("category", category)
    }

    if (q) {
      query = query.or(`key.ilike.%${q}%,value_en.ilike.%${q}%,value_ru.ilike.%${q}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Query error:", error)
      return NextResponse.json({ texts: [], error: error.message }, { status: 500 })
    }

    console.log("[v0] Found texts:", data?.length || 0)

    const statusOrder: Record<string, number> = { in_review: 0, draft: 1, done: 2 }
    const sorted = (data || []).slice().sort((a: any, b: any) => {
      const sa = statusOrder[a.status] ?? 3
      const sb = statusOrder[b.status] ?? 3
      if (sa !== sb) return sa - sb
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

    return NextResponse.json({ texts: sorted })
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return NextResponse.json({ 
      texts: [], 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const keys: string[] = Array.isArray(body?.keys) ? body.keys : []
    if (!keys.length) {
      return NextResponse.json({ error: "No keys provided" }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.from("texts").delete().in("key", keys)
    if (error) throw error

    return NextResponse.json({ success: true, deleted: keys.length })
  } catch (error) {
    console.error("[v0] Delete texts error:", error)
    return NextResponse.json({ error: "Failed to delete texts" }, { status: 500 })
  }
}
