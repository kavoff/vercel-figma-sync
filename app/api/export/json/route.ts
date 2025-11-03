import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const lang = searchParams.get("lang") || "ru"

    const supabase = await createClient()

    const { data, error } = await supabase.from("texts").select("key, value").eq("lang", lang).eq("status", "approved")

    if (error) {
      throw error
    }

    // Convert to key-value object
    const jsonOutput: Record<string, string> = {}
    data?.forEach((item) => {
      jsonOutput[item.key] = item.value
    })

    return NextResponse.json(jsonOutput, {
      headers: {
        "Content-Disposition": `attachment; filename="${lang}.json"`,
      },
    })
  } catch (error) {
    console.error("[v0] Export JSON error:", error)
    return NextResponse.json({ error: "Failed to export JSON" }, { status: 500 })
  }
}
