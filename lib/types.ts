export type TextStatus = "draft" | "in_review" | "approved"

export type TextKey = {
  key: string
  value_en: string // Source English text
  value_ru: string | null // Russian translation (null if not translated)
  status: TextStatus
  category: string
  project_id: string | null
  sources: {
    figmaFileId?: string
    figmaNodes?: string[]
  }
  updated_at: string
  created_at: string
}

export type BulkUpsertItem = {
  key: string
  value: string
}

export type BulkUpsertRequest = {
  fileId: string
  items: BulkUpsertItem[]
}

export type Project = {
  id: string
  name: string
  github_token: string
  github_owner: string
  github_repo: string
  github_branch: string
  github_path: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ProjectInput = Omit<Project, "id" | "created_at" | "updated_at">

export type ProjectSafe = Omit<Project, "github_token">
