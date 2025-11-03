import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"

export async function GET() {
  try {
    await requireAuth()
    const supabase = await createClient()

    const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false })

    if (error) throw error

    // Do not expose github_token to the client
    const safeProjects = (data || []).map((p: any) => {
      const { github_token, ...rest } = p
      return rest
    })

    return NextResponse.json({ projects: safeProjects })
  } catch (error) {
    console.error("[v0] Get projects error:", error)

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { name, github_token, github_owner, github_repo, github_branch, github_path, is_active } = body

    const supabase = await createClient()

    // If setting as active, deactivate all others first
    if (is_active) {
      await supabase.from("projects").update({ is_active: false }).neq("name", name)
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        github_token,
        github_owner,
        github_repo,
        github_branch: github_branch || "main",
        github_path: github_path || "locales/ru.json",
        is_active: is_active || false,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ project: data })
  } catch (error) {
    console.error("[v0] Create project error:", error)

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
