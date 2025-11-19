/// <reference types="@figma/plugin-typings" />
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
function makeKey(text) {
    // Slugify text
    const slug = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .substring(0, 30);
    // Generate hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    const hashStr = Math.abs(hash).toString(36).substring(0, 4);
    return `${slug}_${hashStr}`;
}
// Determine if node and all ancestors are visible
function isNodeVisible(node) {
    let current = node;
    while (current) {
        // @ts-ignore - not all BaseNode have visible, guard with in
        if (current.visible === false)
            return false;
        current = current.parent || null;
    }
    return true;
}
// Find the page of a node
function getNodePage(node) {
    let current = node;
    while (current) {
        if (current.type === 'PAGE')
            return current;
        current = current.parent || null;
    }
    return null;
}
// Collect text nodes within a node tree, respecting visibility and page
function collectVisibleTextNodes(root) {
    const nodes = root.findAll(n => n.type === 'TEXT');
    return nodes.filter(n => isNodeVisible(n) && getNodePage(n) === figma.currentPage);
}
// Resolve export scope: selection > current page > none
function getScopedTextNodes() {
    const selection = figma.currentPage.selection;
    if (selection && selection.length > 0) {
        const selectedText = selection.filter(n => n.type === 'TEXT');
        if (selectedText.length > 0) {
            return selectedText.filter(n => isNodeVisible(n));
        }
        // gather from selected containers
        let gathered = [];
        for (const node of selection) {
            if ('findAll' in node) {
                gathered = gathered.concat(collectVisibleTextNodes(node));
            }
        }
        return gathered;
    }
    // default to current page only
    return collectVisibleTextNodes(figma.currentPage);
}
// Build a more human key using nearest container/page context (no hash)
function makeContextualKey(text, node) {
    function slugify(s) {
        return s
            .toLowerCase()
            .replace(/[^a-z0-9а-яё]+/gi, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 30);
    }
    // nearest named container
    let containerName = '';
    let current = node;
    while (current) {
        if ('name' in current && current.type !== 'TEXT' && current.name) {
            containerName = current.name;
            break;
        }
        current = current.parent || null;
    }
    const pageName = figma.currentPage.name;
    const scope = slugify(containerName || pageName);
    const base = slugify(text).slice(0, 30);
    return `${scope}_${base}`;
}
// Export texts to admin panel
async function exportTexts(apiUrl, projectId) {
    try {
        const allTextNodes = getScopedTextNodes();
        const scopeInfo = figma.currentPage.name + (figma.currentPage.selection.length ? ` (selection x${figma.currentPage.selection.length})` : " (page)");
        console.log(`[TextSync] Scope: ${scopeInfo}, found text nodes: ${allTextNodes.length}`);
        if (allTextNodes.length === 0) {
            figma.ui.postMessage({
                type: "export-error",
                data: { message: "No text layers found in document" },
            });
            return;
        }
        const textsMap = new Map();
        for (const node of allTextNodes) {
            const text = node.characters.trim();
            if (!text)
                continue;
            let key;
            if (node.name.startsWith("T:")) {
                key = node.name.substring(2);
            }
            else {
                key = makeContextualKey(text, node);
                node.name = `T:${key}`;
            }
            if (textsMap.has(key)) {
                textsMap.get(key).nodes.push(node);
            }
            else {
                textsMap.set(key, { key, value: text, nodes: [node] });
            }
        }
        const texts = Array.from(textsMap.values()).map(({ key, value }) => ({
            key,
            value,
            project_id: projectId,
            category: figma.currentPage.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
            sources: { type: "figma", file: figma.currentPage.name }
        }));

        console.log(`[TextSync] Sending ${texts.length} texts to API for project ${projectId}`);

        const response = await fetch(`${apiUrl}/api/texts/bulk-upsert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts }),
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error(`[TextSync] API error: ${response.status}`, errorData);
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        console.log(`[TextSync] Export result:`, result);

        figma.ui.postMessage({
            type: "export-complete",
            data: { message: `Exported ${texts.length} texts successfully` },
        });
    }
    catch (error) {
        console.error(`[TextSync] Export error:`, error);
        figma.ui.postMessage({
            type: "export-error",
            data: { message: error instanceof Error ? error.message : "Unknown error" },
        });
    }
}

// Pull approved texts from admin panel
async function pullTexts(apiUrl, projectId) {
    try {
        const response = await fetch(`${apiUrl}/api/texts?project_id=${projectId}&status=approved`);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        
        console.log(`[TextSync] Received data from API:`, data);
        
        const approvedTexts = new Map();
        for (const text of data.texts || []) {
            const valueToUse = text.value_ru || text.value_en;
            if (valueToUse) {
                approvedTexts.set(text.key, valueToUse);
            }
        }

        console.log(`[TextSync] Approved texts map size: ${approvedTexts.size}`);

        if (approvedTexts.size === 0) {
            figma.ui.postMessage({
                type: "pull-complete",
                data: { message: "No approved texts found" },
            });
            return;
        }
        const allTextNodes = getScopedTextNodes();
        const scopeInfo = figma.currentPage.name + (figma.currentPage.selection.length ? ` (selection x${figma.currentPage.selection.length})` : " (page)");
        console.log(`[TextSync] Pull scope: ${scopeInfo}, text nodes considered: ${allTextNodes.length}`);
        let updatedCount = 0;
        for (const node of allTextNodes) {
            if (!node.name.startsWith("T:"))
                continue;
            const key = node.name.substring(2);
            const newValue = approvedTexts.get(key);
            if (newValue && newValue !== node.characters) {
                try {
                    await figma.loadFontAsync(node.fontName);
                    node.characters = newValue;
                    updatedCount++;
                    console.log(`[TextSync] Updated text node: ${key}`);
                }
                catch (fontError) {
                    console.log(`[TextSync] Failed to load font for node ${node.name}:`, fontError);
                }
            }
        }

        console.log(`[TextSync] Pull completed, updated ${updatedCount} nodes`);

        figma.ui.postMessage({
            type: "pull-complete",
            data: { message: `Updated ${updatedCount} text layers` },
        });
    }
    catch (error) {
        console.error(`[TextSync] Pull error:`, error);
        figma.ui.postMessage({
            type: "pull-error",
            data: { message: error instanceof Error ? error.message : "Unknown error" },
        });
    }
}

function navigateToLayer(key) {
    const targetName = `T:${key}`;
    
    // Search all pages for the text node
    for (const page of figma.root.children) {
        const found = page.findOne(n => n.name === targetName && n.type === 'TEXT');
        
        if (found) {
            // Switch to the page if needed
            if (figma.currentPage !== page) {
                figma.currentPage = page;
            }
            
            // Select and zoom to the node
            figma.currentPage.selection = [found];
            figma.viewport.scrollAndZoomIntoView([found]);
            
            console.log(`[TextSync] Navigated to layer: ${key}`);
            return;
        }
    }
    
    console.log(`[TextSync] Layer not found: ${key}`);
}

// Show UI
figma.showUI(__html__, { width: 700, height: 600 });

console.log('[TextSync Plugin] Plugin started, UI shown');

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
    console.log('[TextSync Plugin] Received message:', msg.type, msg);
    
    if (msg.type === 'request-api-url') {
        console.log('[TextSync Plugin] API URL requested');
        try {
            const apiUrl = await figma.clientStorage.getAsync('textsync:apiUrl');
            console.log('[TextSync Plugin] Sending API URL to UI:', apiUrl || '(none)');
            figma.ui.postMessage({ type: 'load-api-url', apiUrl: apiUrl || '' });
        } catch (err) {
            console.error('[TextSync Plugin] Error getting API URL:', err);
            figma.ui.postMessage({ type: 'load-api-url', apiUrl: '' });
        }
    }
    else if (msg.type === 'export') {
        console.log('[TextSync Plugin] Export requested for project:', msg.projectId);
        await figma.clientStorage.setAsync('textsync:apiUrl', msg.apiUrl);
        await exportTexts(msg.apiUrl, msg.projectId);
    }
    else if (msg.type === 'pull') {
        console.log('[TextSync Plugin] Pull requested for project:', msg.projectId);
        await figma.clientStorage.setAsync('textsync:apiUrl', msg.apiUrl);
        await pullTexts(msg.apiUrl, msg.projectId);
    }
    else if (msg.type === 'save-api-url') {
        console.log('[TextSync Plugin] Saving API URL:', msg.apiUrl);
        await figma.clientStorage.setAsync('textsync:apiUrl', msg.apiUrl);
        figma.ui.postMessage({ type: 'api-url-saved' });
    }
    else if (msg.type === 'navigate-to-layer') {
        console.log('[TextSync Plugin] Navigate to layer requested:', msg.key);
        navigateToLayer(msg.key);
    }
};
