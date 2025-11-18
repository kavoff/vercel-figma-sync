// GitHub integration for Direct PR Mode (optional)

interface GitHubConfig {
  token: string
  owner: string
  repo: string
  branch: string
  path: string
}

interface GitHubFileContent {
  sha: string
  content: string
}

export async function getFileContent(config: GitHubConfig): Promise<GitHubFileContent | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}?ref=${config.branch}`,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    )

    if (response.status === 404) {
      return null // File doesn't exist yet
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      sha: data.sha,
      content: Buffer.from(data.content, "base64").toString("utf-8"),
    }
  } catch (error) {
    console.error("[v0] GitHub get file error:", error)
    throw error
  }
}

export async function createOrUpdateFile(
  config: GitHubConfig,
  content: string,
  message: string,
  sha?: string,
): Promise<void> {
  try {
    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content).toString("base64"),
      branch: config.branch,
    }

    if (sha) {
      body.sha = sha
    }

    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(error)}`)
    }
  } catch (error) {
    console.error("[v0] GitHub create/update file error:", error)
    throw error
  }
}

export async function createPullRequest(
  config: GitHubConfig,
  branchName: string,
  title: string,
  body: string,
): Promise<string> {
  try {
    // Get the base branch SHA
    const baseBranchResponse = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/git/refs/heads/${config.branch}`,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    )

    if (!baseBranchResponse.ok) {
      throw new Error(`Failed to get base branch: ${baseBranchResponse.status}`)
    }

    const baseBranchData = await baseBranchResponse.json()
    const baseSha = baseBranchData.object.sha

    // Create new branch
    await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/refs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    })

    // Create PR
    const prResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body,
        head: branchName,
        base: config.branch,
      }),
    })

    if (!prResponse.ok) {
      throw new Error(`Failed to create PR: ${prResponse.status}`)
    }

    const prData = await prResponse.json()
    return prData.html_url
  } catch (error) {
    console.error("[v0] GitHub create PR error:", error)
    throw error
  }
}

export async function syncToGitHub(
  jsonContentEn: Record<string, string>,
  jsonContentRu: Record<string, string>,
  config: GitHubConfig | null
): Promise<void> {
  if (!config) {
    console.log("[v0] GitHub integration not configured, skipping sync")
    return
  }

  try {
    // User provides parent directory, we add en/ru subdirectories
    // Example: config.path = "locales/text.json" -> parentDir = "locales", filename = "text.json"
    const pathParts = config.path.split('/')
    const filename = pathParts.pop() || 'text.json'
    const parentDir = pathParts.join('/') || 'locales'
    
    // Sync English file to {parentDir}/en/{filename}
    const contentEn = JSON.stringify(jsonContentEn, null, 2)
    const pathEn = `${parentDir}/en/${filename}`
    const existingFileEn = await getFileContent({ ...config, path: pathEn })
    await createOrUpdateFile(
      { ...config, path: pathEn },
      contentEn,
      "Update English texts from TextSync admin",
      existingFileEn?.sha
    )

    // Sync Russian file to {parentDir}/ru/{filename}
    const contentRu = JSON.stringify(jsonContentRu, null, 2)
    const pathRu = `${parentDir}/ru/${filename}`
    const existingFileRu = await getFileContent({ ...config, path: pathRu })
    await createOrUpdateFile(
      { ...config, path: pathRu },
      contentRu,
      "Update Russian texts from TextSync admin",
      existingFileRu?.sha
    )

    console.log("[v0] Successfully synced to GitHub (EN + RU)")
  } catch (error) {
    console.error("[v0] Failed to sync to GitHub:", error)
    throw error
  }
}
