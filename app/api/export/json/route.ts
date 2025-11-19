import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Export JSON request received")
    
    const searchParams = request.nextUrl.searchParams
    const lang = searchParams.get("lang") || "ru"

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("texts")
      .select("key, value_en, value_ru, status")
      .eq("status", "approved")

    console.log("[v0] Texts fetched:", data?.length || 0, "error:", error)

    if (error) {
      throw error
    }

    const jsonOutput: Record<string, string> = {}
    data?.forEach((item) => {
      const value = lang === "en" ? item.value_en : item.value_ru
      if (value) {
        jsonOutput[item.key] = value
      }
    })

    console.log("[v0] JSON output keys:", Object.keys(jsonOutput).length)

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
