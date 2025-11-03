/// <reference types="@figma/plugin-typings" />
// declare const __html__: string;

// declare const figma: {
//   root: SceneNode & { children: readonly SceneNode[] }
//   showUI: (html: string, options?: { width?: number; height?: number }) => void
//   ui: {
//     postMessage: (message: any) => void
//     onmessage: ((msg: any) => void) | null
//   }
//   loadFontAsync: (fontName: FontName) => Promise<void>
// }

// import type { SceneNode, TextNode, FontName } from "figma"

// Generate unique key from text content
function makeKey(text: string): string {
  // Slugify text
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 30)

  // Generate hash
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const hashStr = Math.abs(hash).toString(36).substring(0, 4)

  return `${slug}_${hashStr}`
}

// Collect all text nodes recursively
function collectTextNodes(node: SceneNode, textNodes: TextNode[] = []): TextNode[] {
  if (node.type === "TEXT") {
    textNodes.push(node as TextNode)
  }

  if ("children" in node) {
    for (const child of node.children) {
      collectTextNodes(child, textNodes)
    }
  }

  return textNodes
}

// Export texts to admin panel
async function exportTexts(apiUrl: string) {
  try {
    // Collect all text nodes
    // const allTextNodes = collectTextNodes(figma.root)
    const allTextNodes = figma.root.findAll(n => n.type === 'TEXT') as TextNode[];

    if (allTextNodes.length === 0) {
      figma.ui.postMessage({
        type: "export-error",
        data: { message: "No text layers found in document" },
      })
      return
    }

    // Process texts and generate keys
    const textsMap = new Map<string, { key: string; value: string; nodes: TextNode[] }>()

    for (const node of allTextNodes) {
      const text = node.characters.trim()
      if (!text) continue

      // Check if node already has a key
      let key: string
      if (node.name.startsWith("T:")) {
        key = node.name.substring(2)
      } else {
        key = makeKey(text)
        node.name = `T:${key}`
      }

      // Group by key for deduplication
      if (textsMap.has(key)) {
        textsMap.get(key)!.nodes.push(node)
      } else {
        textsMap.set(key, { key, value: text, nodes: [node] })
      }
    }

    // Prepare data for API
    const texts = Array.from(textsMap.values()).map(({ key, value }) => ({
      key,
      value,
      lang: "ru",
      sources: [{ type: "figma", file: figma.root.name }],
    }))

    // Send to API
    const response = await fetch(`${apiUrl}/api/texts/bulk-upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    figma.ui.postMessage({
      type: "export-complete",
      data: { message: `Exported ${texts.length} texts successfully` },
    })
  } catch (error) {
    figma.ui.postMessage({
      type: "export-error",
      data: { message: error instanceof Error ? error.message : "Unknown error" },
    })
  }
}

// Pull approved texts from admin panel
async function pullTexts(apiUrl: string) {
  try {
    // Fetch approved texts
    const response = await fetch(`${apiUrl}/api/texts?status=approved`)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const approvedTexts = new Map<string, string>()

    for (const text of data.texts) {
      approvedTexts.set(text.key, text.value)
    }

    if (approvedTexts.size === 0) {
      figma.ui.postMessage({
        type: "pull-complete",
        data: { message: "No approved texts found" },
      })
      return
    }

    // Collect all text nodes with keys
    // const allTextNodes = collectTextNodes(figma.root)
    const allTextNodes = figma.root.findAll(n => n.type === 'TEXT') as TextNode[];
    let updatedCount = 0

    for (const node of allTextNodes) {
      if (!node.name.startsWith("T:")) continue

      const key = node.name.substring(2)
      const newValue = approvedTexts.get(key)

      if (newValue && newValue !== node.characters) {
        try {
          // Load font before updating
          await figma.loadFontAsync(node.fontName as FontName)
          node.characters = newValue
          updatedCount++
        } catch (fontError) {
          console.log(`[v0] Failed to load font for node ${node.name}:`, fontError)
        }
      }
    }

    figma.ui.postMessage({
      type: "pull-complete",
      data: { message: `Updated ${updatedCount} text layers` },
    })
  } catch (error) {
    figma.ui.postMessage({
      type: "pull-error",
      data: { message: error instanceof Error ? error.message : "Unknown error" },
    })
  }
}


// Show UI
figma.showUI(__html__, { width: 400, height: 220 });

// Отправляем сохраненный URL в UI при запуске
figma.clientStorage.getAsync('textsync:apiUrl').then(apiUrl => {
  // 2. Если URL найден, отправляем его в UI для отображения
  if (apiUrl) {
    figma.ui.postMessage({ type: 'load-api-url', apiUrl: apiUrl });
  }
}).catch(err => {
  console.error('Error getting data from clientStorage:', err);
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  // Если пришло сообщение 'export'
  if (msg.type === 'export') {
    // Сохраняем URL в хранилище и запускаем экспорт
    await figma.clientStorage.setAsync('textsync:apiUrl', msg.apiUrl);
    await exportTexts(msg.apiUrl);
  } 
  // Если пришло сообщение 'pull'
  else if (msg.type === 'pull') {
    // Сохраняем URL и запускаем загрузку текстов
    await figma.clientStorage.setAsync('textsync:apiUrl', msg.apiUrl);
    await pullTexts(msg.apiUrl);
  }
  // Если пользователь просто изменил URL в поле ввода
  else if (msg.type === 'save-api-url') {
    // Тихо сохраняем его в хранилище без запуска других действий
    await figma.clientStorage.setAsync('textsync:apiUrl', msg.apiUrl);
  }
};
