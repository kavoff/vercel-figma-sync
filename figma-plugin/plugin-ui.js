window.addEventListener('DOMContentLoaded', () => {
  console.log('[TextSync UI] DOM loaded, requesting API URL from plugin');
  window.parent.postMessage({ pluginMessage: { type: 'request-api-url' } }, '*');
});

let currentApiUrl = '';
let allTexts = [];
let allProjects = [];
let selectedTexts = new Set();
let activeProjectId = null;

function initializePlugin() {
  console.log('[TextSync UI] Initializing plugin UI...');
  
  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  console.log('[TextSync UI] Found tabs:', tabs.length);
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      console.log('[TextSync UI] Tab clicked:', tab.dataset.tab);
      const tabName = tab.dataset.tab;
      
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.querySelector(`[data-content="${tabName}"]`).classList.add('active');
      
      if (tabName === 'manage') {
        loadTexts();
      } else if (tabName === 'settings') {
        loadProjects();
      }
    });
  });
  
  // Button event listeners
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('pullBtn').addEventListener('click', handlePull);
  document.getElementById('saveSettingsBtn').addEventListener('click', handleSaveSettings);
  document.getElementById('createProjectBtn').addEventListener('click', handleCreateProject);
  document.getElementById('selectAllBtn').addEventListener('click', handleSelectAll);
  document.getElementById('refreshBtn').addEventListener('click', loadTexts);
  document.getElementById('syncSelectedBtn').addEventListener('click', handleSyncSelected);
  document.getElementById('bulkStatusSelect').addEventListener('change', handleBulkStatus);
  
  // Project select change handlers
  document.getElementById('syncProjectSelect').addEventListener('change', (e) => {
    console.log('[TextSync UI] Sync project changed:', e.target.value);
    activeProjectId = e.target.value;
    setActiveProject(activeProjectId);
  });
  
  document.getElementById('manageProjectSelect').addEventListener('change', (e) => {
    console.log('[TextSync UI] Manage project changed:', e.target.value);
    activeProjectId = e.target.value;
    setActiveProject(activeProjectId);
    loadTexts();
  });
  
  console.log('[TextSync UI] All event listeners attached');
  console.log('[TextSync UI] Requesting API URL from plugin...');
  
  // Request API URL from plugin
  window.parent.postMessage({ pluginMessage: { type: 'request-api-url' } }, '*');
}

// Tab switching
// document.querySelectorAll('.tab').forEach(tab => {
//   tab.addEventListener('click', () => {
//     const tabName = tab.dataset.tab;
//     
//     document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
//     document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
//     
//     tab.classList.add('active');
//     document.querySelector(`[data-content="${tabName}"]`).classList.add('active');
//     
//     if (tabName === 'manage') {
//       loadTexts();
//     } else if (tabName === 'settings') {
//       loadProjects();
//     }
//   });
// });

// Status helpers
function showStatus(elementId, message, type) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = `status show ${type}`;
}

function hideStatus(elementId) {
  document.getElementById(elementId).className = 'status';
}

function updateHeaderInfo() {
  const activeProject = allProjects.find(p => p.is_active);
  const headerInfo = document.getElementById('headerInfo');
  
  if (!currentApiUrl) {
    headerInfo.textContent = 'Not connected - Set API URL in Settings';
  } else if (activeProject) {
    headerInfo.textContent = `${activeProject.name} → ${activeProject.github_owner}/${activeProject.github_repo}`;
  } else {
    headerInfo.textContent = 'Connected - No active project';
  }
}

// Load projects
async function loadProjects() {
  if (!currentApiUrl) {
    console.log('[TextSync UI] Cannot load projects - no API URL');
    return;
  }
  
  console.log('[TextSync UI] Loading projects from:', currentApiUrl);
  
  try {
    const response = await fetch(`${currentApiUrl}/api/projects`);
    const data = await response.json();
    allProjects = data.projects || [];
    
    console.log('[TextSync UI] Loaded', allProjects.length, 'projects');
    
    renderProjectSelects();
    renderProjectList();
    updateHeaderInfo();
  } catch (error) {
    console.error('[TextSync UI] Failed to load projects:', error);
  }
}

function renderProjectSelects() {
  const syncSelect = document.getElementById('syncProjectSelect');
  const manageSelect = document.getElementById('manageProjectSelect');
  
  const activeProject = allProjects.find(p => p.is_active);
  
  if (allProjects.length === 0) {
    syncSelect.innerHTML = '<option value="">No projects - Create one in Settings</option>';
    manageSelect.innerHTML = '<option value="">No projects - Create one in Settings</option>';
    syncSelect.disabled = true;
    manageSelect.disabled = true;
  } else {
    const options = allProjects.map(p => 
      `<option value="${p.id}" ${p.is_active ? 'selected' : ''}>${p.name}</option>`
    ).join('');
    
    syncSelect.innerHTML = options;
    manageSelect.innerHTML = options;
    syncSelect.disabled = false;
    manageSelect.disabled = false;
    
    if (activeProject) {
      syncSelect.value = activeProject.id;
      manageSelect.value = activeProject.id;
      activeProjectId = activeProject.id;
    }
  }
  
  // Add change listeners
  syncSelect.onchange = () => {
    activeProjectId = syncSelect.value;
    setActiveProject(activeProjectId);
  };
  
  manageSelect.onchange = () => {
    activeProjectId = manageSelect.value;
    setActiveProject(activeProjectId);
    loadTexts();
  };
}

function renderProjectList() {
  const listEl = document.getElementById('projectList');
  
  if (allProjects.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No projects yet</div>';
    return;
  }
  
  listEl.innerHTML = allProjects.map(p => `
    <div class="project-item ${p.is_active ? 'active' : ''}" data-id="${p.id}">
      <input type="radio" name="project" ${p.is_active ? 'checked' : ''} />
      <div style="flex: 1;">
        <div class="project-name">${p.name}</div>
        <div class="project-info">${p.github_owner}/${p.github_repo}</div>
      </div>
    </div>
  `).join('');
  
  listEl.querySelectorAll('.project-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      setActiveProject(id);
    });
  });
}

async function setActiveProject(projectId) {
  if (!currentApiUrl || !projectId) return;
  
  try {
    await fetch(`${currentApiUrl}/api/projects/${projectId}/activate`, {
      method: 'POST'
    });
    
    await loadProjects();
    loadTexts();
  } catch (error) {
    console.error('[TextSync] Failed to set active project:', error);
  }
}

// Sync tab
function handleExport() {
  console.log('[TextSync UI] Export button clicked');
  
  if (!currentApiUrl) {
    showStatus('syncStatus', 'Please set API URL in Settings', 'error');
    return;
  }
  
  const projectId = document.getElementById('syncProjectSelect').value;
  if (!projectId) {
    showStatus('syncStatus', 'Please select a project', 'error');
    return;
  }
  
  console.log('[TextSync UI] Sending export message to plugin');
  showStatus('syncStatus', 'Exporting...', 'info');
  window.parent.postMessage({ pluginMessage: { type: 'export', apiUrl: currentApiUrl, projectId } }, '*');
}

function handlePull() {
  console.log('[TextSync UI] Pull button clicked');
  
  if (!currentApiUrl) {
    showStatus('syncStatus', 'Please set API URL in Settings', 'error');
    return;
  }
  
  const projectId = document.getElementById('syncProjectSelect').value;
  if (!projectId) {
    showStatus('syncStatus', 'Please select a project', 'error');
    return;
  }
  
  console.log('[TextSync UI] Sending pull message to plugin');
  showStatus('syncStatus', 'Pulling...', 'info');
  window.parent.postMessage({ pluginMessage: { type: 'pull', apiUrl: currentApiUrl, projectId } }, '*');
}

// Manage tab
async function loadTexts() {
  if (!currentApiUrl) {
    console.log('[TextSync UI] Cannot load texts - no API URL');
    document.getElementById('textList').innerHTML = '<div class="empty-state">Set API URL in Settings first</div>';
    return;
  }
  
  const projectId = document.getElementById('manageProjectSelect').value;
  if (!projectId) {
    console.log('[TextSync UI] Cannot load texts - no project selected');
    document.getElementById('textList').innerHTML = '<div class="empty-state">Select a project first</div>';
    return;
  }
  
  console.log('[TextSync UI] Loading texts for project:', projectId);
  showStatus('manageStatus', 'Loading...', 'info');
  
  try {
    const response = await fetch(`${currentApiUrl}/api/texts?project_id=${projectId}`);
    const data = await response.json();
    allTexts = data.texts || [];
    
    console.log('[TextSync UI] Loaded', allTexts.length, 'texts');
    
    renderTextList();
    hideStatus('manageStatus');
  } catch (error) {
    console.error('[TextSync UI] Failed to load texts:', error);
    showStatus('manageStatus', 'Failed to load texts', 'error');
  }
}

function renderTextList() {
  const listEl = document.getElementById('textList');
  
  if (allTexts.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No texts found. Export from Figma to get started.</div>';
    return;
  }
  
  listEl.innerHTML = allTexts.map(text => {
    const statusClass = !text.value_ru ? 'status-no-loc' : `status-${text.status}`;
    const statusLabel = !text.value_ru ? 'No translation' : 
      text.status === 'draft' ? 'Draft' : 
      text.status === 'in_review' ? 'In Review' : 'Done';
    
    return `
      <div class="text-item">
        <input type="checkbox" data-key="${text.key}" ${selectedTexts.has(text.key) ? 'checked' : ''} />
        <div class="text-item-content">
          <span class="text-key-label">Key</span>
          <input 
            type="text" 
            value="${text.key}" 
            data-key="${text.key}" 
            data-field="key"
            class="text-field"
          />
          
          <span class="text-key-label">English</span>
          <input 
            type="text" 
            value="${text.value_en || ''}" 
            data-key="${text.key}" 
            data-field="value_en"
            class="text-field"
          />
          
          <span class="text-key-label">Russian</span>
          <input 
            type="text" 
            value="${text.value_ru || ''}" 
            placeholder="Add translation..."
            data-key="${text.key}" 
            data-field="value_ru"
            class="text-field"
          />
          
          <div style="display: flex; gap: 4px; align-items: center;">
            <select data-key="${text.key}" data-field="status" style="flex: 1;">
              <option value="draft" ${text.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="in_review" ${text.status === 'in_review' ? 'selected' : ''}>In Review</option>
              <option value="approved" ${text.status === 'approved' ? 'selected' : ''}>Done</option>
            </select>
            <span class="text-status ${statusClass}">${statusLabel}</span>
          </div>
        </div>
        <button class="btn-icon" data-key="${text.key}" title="Go to layer">👁</button>
      </div>
    `;
  }).join('');
  
  // Add event listeners
  listEl.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const key = e.target.dataset.key;
      if (e.target.checked) {
        selectedTexts.add(key);
      } else {
        selectedTexts.delete(key);
      }
    });
  });
  
  listEl.querySelectorAll('.text-field').forEach(input => {
    input.addEventListener('blur', async (e) => {
      const key = e.target.dataset.key;
      const field = e.target.dataset.field;
      const value = e.target.value;
      
      await updateText(key, { [field]: value });
    });
  });
  
  listEl.querySelectorAll('select[data-field="status"]').forEach(select => {
    select.addEventListener('change', async (e) => {
      const key = e.target.dataset.key;
      const status = e.target.value;
      
      await updateText(key, { status });
    });
  });
  
  listEl.querySelectorAll('.btn-icon').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.currentTarget.dataset.key;
      console.log('[TextSync UI] Navigate to layer:', key);
      window.parent.postMessage({ pluginMessage: { type: 'navigate-to-layer', key } }, '*');
    });
  });
}

function handleSelectAll() {
  console.log('[TextSync UI] Select all button clicked');
  
  const allChecked = selectedTexts.size === allTexts.length;
  
  if (allChecked) {
    selectedTexts.clear();
  } else {
    allTexts.forEach(t => selectedTexts.add(t.key));
  }
  
  renderTextList();
}

async function handleSyncSelected() {
  console.log('[TextSync UI] Sync selected button clicked');
  
  if (!currentApiUrl) {
    showStatus('manageStatus', 'Please set API URL', 'error');
    return;
  }
  
  if (selectedTexts.size === 0) {
    showStatus('manageStatus', 'No items selected', 'error');
    return;
  }
  
  showStatus('manageStatus', 'Syncing to GitHub...', 'info');
  
  try {
    const response = await fetch(`${currentApiUrl}/api/sync/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: Array.from(selectedTexts) })
    });
    
    const data = await response.json();
    showStatus('manageStatus', `Synced ${data.count || 0} items to GitHub`, 'success');
    setTimeout(() => hideStatus('manageStatus'), 3000);
  } catch (error) {
    console.error('[TextSync UI] Sync selected error:', error);
    showStatus('manageStatus', 'Failed to sync to GitHub', 'error');
  }
}

async function handleBulkStatus(e) {
  const status = e.target.value;
  if (!status || selectedTexts.size === 0) return;
  
  console.log('[TextSync UI] Bulk status change:', status, 'for', selectedTexts.size, 'items');
  
  showStatus('manageStatus', 'Updating...', 'info');
  
  try {
    await Promise.all(
      Array.from(selectedTexts).map(key => updateText(key, { status }))
    );
    
    showStatus('manageStatus', `Updated ${selectedTexts.size} items`, 'success');
    setTimeout(() => hideStatus('manageStatus'), 2000);
  } catch (error) {
    console.error('[TextSync UI] Bulk status error:', error);
    showStatus('manageStatus', 'Failed to update', 'error');
  }
  
  e.target.value = '';
}

// Settings tab
function handleSaveSettings() {
  console.log('[TextSync UI] Save settings button clicked');
  
  const apiUrl = document.getElementById('apiUrl').value.trim();
  
  if (!apiUrl) {
    showStatus('settingsStatus', 'Please enter API URL', 'error');
    return;
  }
  
  console.log('[TextSync UI] Saving API URL:', apiUrl);
  currentApiUrl = apiUrl;
  window.parent.postMessage({ pluginMessage: { type: 'save-api-url', apiUrl } }, '*');
  showStatus('settingsStatus', 'Settings saved', 'success');
  
  loadProjects();
  updateHeaderInfo();
  setTimeout(() => hideStatus('settingsStatus'), 2000);
}

async function handleCreateProject() {
  console.log('[TextSync UI] Create project button clicked');
  
  const name = document.getElementById('newProjectName').value.trim();
  
  if (!name) {
    showStatus('settingsStatus', 'Please enter project name', 'error');
    return;
  }
  
  if (!currentApiUrl) {
    showStatus('settingsStatus', 'Please set API URL first', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${currentApiUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        github_owner: '',
        github_repo: '',
        github_branch: 'main',
        github_path: 'locales/text.json'
      })
    });
    
    if (!response.ok) throw new Error('Failed to create project');
    
    document.getElementById('newProjectName').value = '';
    showStatus('settingsStatus', 'Project created', 'success');
    
    await loadProjects();
    setTimeout(() => hideStatus('settingsStatus'), 2000);
  } catch (error) {
    console.error('[TextSync UI] Create project error:', error);
    showStatus('settingsStatus', 'Failed to create project', 'error');
  }
}

async function updateText(key, updates) {
  if (!currentApiUrl) return;
  
  try {
    await fetch(`${currentApiUrl}/api/texts/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    // Update local state
    const textIndex = allTexts.findIndex(t => t.key === key);
    if (textIndex !== -1) {
      allTexts[textIndex] = { ...allTexts[textIndex], ...updates };
      renderTextList();
    }
  } catch (error) {
    console.error('[TextSync] Failed to update text:', error);
  }
}

// Handle messages from plugin
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;
  
  console.log('[TextSync UI] Received message from plugin:', msg.type);
  
  if (msg.type === 'load-api-url') {
    currentApiUrl = msg.apiUrl || '';
    document.getElementById('apiUrl').value = currentApiUrl;
    
    console.log('[TextSync UI] API URL loaded:', currentApiUrl || '(empty)');
    
    if (currentApiUrl) {
      console.log('[TextSync UI] API URL set, loading projects...');
      loadProjects();
    } else {
      console.log('[TextSync UI] No API URL set');
      updateHeaderInfo();
    }
  } else if (msg.type === 'export-complete') {
    console.log('[TextSync UI] Export complete');
    showStatus('syncStatus', msg.data.message, 'success');
    loadTexts();
  } else if (msg.type === 'export-error') {
    console.log('[TextSync UI] Export error:', msg.data.message);
    showStatus('syncStatus', `Export failed: ${msg.data.message}`, 'error');
  } else if (msg.type === 'pull-complete') {
    console.log('[TextSync UI] Pull complete');
    showStatus('syncStatus', msg.data.message, 'success');
  } else if (msg.type === 'pull-error') {
    console.log('[TextSync UI] Pull error:', msg.data.message);
    showStatus('syncStatus', `Pull failed: ${msg.data.message}`, 'error');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePlugin);
} else {
  initializePlugin();
}
