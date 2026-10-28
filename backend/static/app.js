/**
 * SMARTCHUNK VANILLA JAVASCRIPT FRONTEND CLIENT (app.js)
 * Fully uses relative paths for seamless local and production hosting:
 *   - POST /api/upload
 *   - GET  /api/search
 *   - POST /api/qa
 *   - GET  /api/documents
 *   - GET  /api/health
 */

// DOM Elements
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const dropZonePrompt = document.getElementById('dropZonePrompt');
const fileSelectedInfo = document.getElementById('fileSelectedInfo');
const selectedFileName = document.getElementById('selectedFileName');
const btnRemoveFile = document.getElementById('btnRemoveFile');
const btnUpload = document.getElementById('btnUpload');

const qualityReportCard = document.getElementById('qualityReportCard');
const statPassed = document.getElementById('statPassed');
const statRepaired = document.getElementById('statRepaired');
const statReviewed = document.getElementById('statReviewed');
const statRejected = document.getElementById('statRejected');
const sourceHash = document.getElementById('sourceHash');
const documentsList = document.getElementById('documentsList');

const qaForm = document.getElementById('qaForm');
const queryInput = document.getElementById('queryInput');
const topKSelect = document.getElementById('topKSelect');
const btnAsk = document.getElementById('btnAsk');

const loadingIndicator = document.getElementById('loadingIndicator');
const loadingMessage = document.getElementById('loadingMessage');
const answerCard = document.getElementById('answerCard');
const answerContent = document.getElementById('answerContent');
const modelBadge = document.getElementById('modelBadge');
const evidenceSection = document.getElementById('evidenceSection');
const evidenceGrid = document.getElementById('evidenceGrid');
const evidenceCount = document.getElementById('evidenceCount');
const backendStatus = document.getElementById('backendStatus');

let currentFile = null;

// ==============================================================
// 1. RELATIVE FETCH API CALLS (Production & Port-Forward Safe)
// ==============================================================

/**
 * 1. Upload a PDF file via FormData using a relative path: /api/upload
 */
async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Upload failed (HTTP ${response.status})`);
  }

  return await response.json();
}

/**
 * 2. Trigger Grounded Q&A endpoint using relative path: /api/qa
 */
async function askQuestion(query, topK = 5) {
  const response = await fetch('/api/qa', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: query,
      top_k: parseInt(topK, 10),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Q&A failed (HTTP ${response.status})`);
  }

  return await response.json();
}

/**
 * 3. Search evidence chunks directly using relative path: /api/search
 */
async function searchEvidence(query, topK = 5) {
  const params = new URLSearchParams({ q: query, top_k: topK });
  const response = await fetch(`/api/search?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Search failed (HTTP ${response.status})`);
  }

  return await response.json();
}

/**
 * 4. Fetch list of indexed documents using relative path: /api/documents
 */
async function fetchDocuments() {
  try {
    const response = await fetch('/api/documents');
    if (response.ok) {
      const docs = await response.json();
      renderDocumentsList(docs);
    }
  } catch (err) {
    console.error('Failed to load documents list:', err);
  }
}

/**
 * 5. Check backend health using relative path: /api/health
 */
async function checkHealth() {
  try {
    const response = await fetch('/api/health');
    if (response.ok) {
      const data = await response.json();
      const chunkCount = data.indexed_chunks !== undefined ? data.indexed_chunks : 0;
      backendStatus.textContent = `Online • ${chunkCount} Chunks Indexed`;
      backendStatus.parentElement.querySelector('.status-indicator').style.background = '#10b981';
    } else {
      backendStatus.textContent = 'Degraded';
    }
  } catch (err) {
    backendStatus.textContent = 'Offline (Start backend on :8000)';
    if (backendStatus.parentElement.querySelector('.status-indicator')) {
      backendStatus.parentElement.querySelector('.status-indicator').style.background = '#ef4444';
    }
  }
}

// ==============================================================
// 2. UI RENDERING LOGIC
// ==============================================================

function renderQAResult(qaResult) {
  const { answer, evidence_chunks, model } = qaResult;

  answerCard.classList.remove('hidden');
  answerContent.textContent = answer;
  if (modelBadge) {
    modelBadge.textContent = model || 'gemini-1.5-flash';
  }

  if (evidence_chunks && evidence_chunks.length > 0) {
    evidenceSection.classList.remove('hidden');
    evidenceCount.textContent = `${evidence_chunks.length} Evidence Chunks Verified`;

    evidenceGrid.innerHTML = evidence_chunks.map((chunk) => {
      const shortDocHash = chunk.doc_sha256 ? chunk.doc_sha256.substring(0, 12) : 'unknown';
      const shortChunkHash = chunk.chunk_hash ? chunk.chunk_hash.substring(0, 10) : '';
      const qualityClass = chunk.quality_status === 'PASS' ? 'badge-quality-pass' : 'badge-quality-repair';

      return `
        <div class="evidence-card">
          <div class="evidence-card-header">
            <div class="evidence-badges">
              <span class="badge badge-source" title="Source SHA-256: ${chunk.doc_sha256}">
                Source ID: ${shortDocHash}
              </span>
              <span class="badge badge-page">
                Page: ${chunk.page_num}
              </span>
              <span class="badge ${qualityClass}">
                Quality: ${chunk.quality_status}
              </span>
              ${shortChunkHash ? `<span class="badge" title="Chunk Hash">#${shortChunkHash}</span>` : ''}
            </div>
            <div class="rrf-score" title="Reciprocal Rank Fusion hybrid score">
              RRF: ${(chunk.rrf_score || 0).toFixed(5)}
            </div>
          </div>
          <div class="evidence-content">
            ${escapeHtml(chunk.content)}
          </div>
        </div>
      `;
    }).join('');
  } else {
    evidenceSection.classList.add('hidden');
  }

  answerCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderDocumentsList(docs) {
  if (!docs || docs.length === 0) {
    documentsList.innerHTML = '<p class="empty-state">No documents indexed yet.</p>';
    return;
  }

  documentsList.innerHTML = docs.map(doc => `
    <div class="doc-item">
      <span class="doc-title">${escapeHtml(doc.filename)}</span>
      <div class="doc-meta">
        ${doc.total_pages} Pages • ${doc.total_chunks} Chunks • SHA: ${doc.sha256_hash.substring(0, 8)}...
      </div>
    </div>
  `).join('');
}

// ==============================================================
// 3. EVENT LISTENERS
// ==============================================================

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleFileSelected(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFileSelected(e.target.files[0]);
  }
});

btnRemoveFile.addEventListener('click', (e) => {
  e.stopPropagation();
  currentFile = null;
  fileInput.value = '';
  fileSelectedInfo.classList.add('hidden');
  dropZonePrompt.classList.remove('hidden');
  btnUpload.disabled = true;
});

function handleFileSelected(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Please select a valid PDF file.');
    return;
  }
  currentFile = file;
  selectedFileName.textContent = file.name;
  dropZonePrompt.classList.add('hidden');
  fileSelectedInfo.classList.remove('hidden');
  btnUpload.disabled = false;
}

btnUpload.addEventListener('click', async () => {
  if (!currentFile) return;

  btnUpload.disabled = true;
  btnUpload.innerHTML = '<span>Processing Quality Gate...</span>';
  qualityReportCard.classList.add('hidden');

  try {
    const result = await uploadDocument(currentFile);
    const { document: doc, quality_report: report } = result;

    statPassed.textContent = report.passed;
    statRepaired.textContent = report.repaired;
    statReviewed.textContent = report.reviewed;
    statRejected.textContent = report.rejected;
    sourceHash.textContent = doc.sha256_hash;
    qualityReportCard.classList.remove('hidden');

    btnUpload.innerHTML = '<span>Indexed Successfully ✓</span>';
    setTimeout(() => {
      btnUpload.innerHTML = '<span>Upload & Index with Quality Gate</span>';
      btnUpload.disabled = false;
    }, 2500);

    fetchDocuments();
    checkHealth();

  } catch (err) {
    alert(`Upload failed: ${err.message}`);
    btnUpload.innerHTML = '<span>Upload Failed ✕</span>';
    setTimeout(() => {
      btnUpload.innerHTML = '<span>Upload & Index with Quality Gate</span>';
      btnUpload.disabled = false;
    }, 2500);
  }
});

qaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = queryInput.value.trim();
  const topK = parseInt(topKSelect.value, 10);

  if (!query) return;

  loadingIndicator.classList.remove('hidden');
  loadingMessage.textContent = 'Running hybrid retrieval (FTS5 + Dense Embeddings) and generating grounded answer...';
  answerCard.classList.add('hidden');
  evidenceSection.classList.add('hidden');
  btnAsk.disabled = true;

  try {
    const result = await askQuestion(query, topK);
    renderQAResult(result);
  } catch (err) {
    alert(`Failed to answer question: ${err.message}`);
  } finally {
    loadingIndicator.classList.add('hidden');
    btnAsk.disabled = false;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  fetchDocuments();
  setInterval(checkHealth, 30000);
});
