let partsArray = [];
let fuse = null;

// ── View loading ──────────────────────────────────────────────
async function loadView(name) {
  const container = document.getElementById('view-container');
  const html = await fetch(`views/${name}.html`).then(r => r.text());
  container.innerHTML = html;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === name);
  });

  if (name === 'print') initPrintView();
  if (name === 'import') initImportView();
  if (name === 'parts') initPartsView();
  if (name === 'setup') initSetupView();
}

// ── Search index ──────────────────────────────────────────────
async function rebuildSearchIndex() {
  partsArray = await window.api.db.getAllParts();
  if (typeof Fuse !== 'undefined') {
    fuse = new Fuse(partsArray, {
      keys: ['part_number', 'description', 'bin_location'],
      threshold: 0.25,
      minMatchCharLength: 2,
      includeScore: true
    });
  }
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, duration = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ── Print view ────────────────────────────────────────────────
let selectedPart = null;
let searchDebounceTimer = null;

function initPrintView() {
  if (partsArray.length === 0) {
    const dropdown = document.getElementById('search-dropdown');
    if (dropdown) {
      dropdown.innerHTML = '<div class="search-no-results">No parts imported yet. Go to Import to load your parts list.</div>';
    }
  }

  const searchInput = document.getElementById('part-search');
  const dropdown = document.getElementById('search-dropdown');
  const printBtn = document.getElementById('btn-print');
  const clearBtn = document.getElementById('btn-clear');
  const qtyInput = document.getElementById('qty-per-label');
  const labelCountInput = document.getElementById('label-count');
  const containerCountInput = document.getElementById('container-count');
  const customerInput = document.getElementById('customer');
  const poJobInput = document.getElementById('po-job');

  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => runSearch(searchInput.value), 150);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) runSearch(searchInput.value);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) closeDropdown();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  [qtyInput, labelCountInput, containerCountInput, customerInput, poJobInput].forEach(el => {
    if (el) el.addEventListener('input', () => { updateSummary(); updatePrintBtn(); updateLabelPreview(); });
  });

  if (clearBtn) clearBtn.addEventListener('click', resetPrintFields);
  if (printBtn) printBtn.addEventListener('click', executePrintJob);

  updateSummary();
  updatePrintBtn();
  updateLabelPreview();
}

function runSearch(query) {
  const dropdown = document.getElementById('search-dropdown');
  if (!dropdown) return;

  if (!query || query.trim().length < 1) { closeDropdown(); return; }

  if (!fuse || partsArray.length === 0) {
    dropdown.innerHTML = '<div class="search-no-results">No parts imported yet. Go to Import to load your parts list.</div>';
    dropdown.classList.add('open');
    return;
  }

  const results = fuse.search(query.trim()).slice(0, 10);
  if (results.length === 0) {
    dropdown.innerHTML = '<div class="search-no-results">No results found</div>';
    dropdown.classList.add('open');
    return;
  }

  dropdown.innerHTML = results.map(({ item }) => `
    <div class="search-result-item" data-id="${item.id}">
      <span class="result-part-number">${item.part_number}</span>
      <span class="result-description"> — ${item.description || ''}</span>
      ${item.bin_location ? `<div class="result-bin">${item.bin_location}</div>` : ''}
    </div>
  `).join('');

  dropdown.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', () => selectPart(parseInt(el.dataset.id)));
  });

  dropdown.classList.add('open');
}

function closeDropdown() {
  const dropdown = document.getElementById('search-dropdown');
  if (dropdown) dropdown.classList.remove('open');
}

function selectPart(id) {
  const part = partsArray.find(p => p.id === id);
  if (!part) return;
  selectedPart = part;

  const searchInput = document.getElementById('part-search');
  if (searchInput) searchInput.value = part.part_number;

  setField('field-part-number', part.part_number);
  setField('field-category', part.category || '');
  setField('field-description', part.description || '');
  setField('field-bin-location', part.bin_location || '');

  closeDropdown();
  updatePrintBtn();
  updateSummary();
  updateLabelPreview();
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function updateSummary() {
  const labelCount = parseInt(document.getElementById('label-count')?.value) || 0;
  const containerCount = parseInt(document.getElementById('container-count')?.value) || 0;
  const customer = (document.getElementById('customer')?.value || '').trim();
  const summaryEl = document.getElementById('job-summary');
  if (!summaryEl) return;

  const totalPart = labelCount * containerCount;
  if (customer) {
    summaryEl.textContent = `${totalPart} Part labels + ${containerCount} Customer label${containerCount !== 1 ? 's' : ''} across ${containerCount} set${containerCount !== 1 ? 's' : ''}`;
  } else {
    summaryEl.textContent = `${totalPart} Part label${totalPart !== 1 ? 's' : ''} across ${containerCount} set${containerCount !== 1 ? 's' : ''}`;
  }
}

function updatePrintBtn() {
  const printBtn = document.getElementById('btn-print');
  if (!printBtn) return;
  const qty = parseInt(document.getElementById('qty-per-label')?.value) || 0;
  const printerMissing = !printBtn.dataset.printerOk;
  printBtn.disabled = !selectedPart || qty < 1;
}

function resetPrintFields() {
  selectedPart = null;
  const ids = ['part-search','field-part-number','field-category','field-description','field-bin-location','customer','po-job'];
  ids.forEach(id => setField(id, ''));
  setField('qty-per-label', '');
  setField('label-count', '2');
  setField('container-count', '1');
  closeDropdown();
  updateSummary();
  updatePrintBtn();
  updateLabelPreview();
}

async function updateLabelPreview() {
  const partPreviewContainer = document.getElementById('part-label-preview');
  const custPreviewContainer = document.getElementById('customer-label-preview');
  const placeholder = document.getElementById('preview-placeholder');
  const labelsWrapper = document.getElementById('preview-labels');

  if (!partPreviewContainer) return;

  if (!selectedPart) {
    if (placeholder) placeholder.style.display = '';
    if (labelsWrapper) labelsWrapper.style.display = 'none';
    return;
  }

  if (placeholder) placeholder.style.display = 'none';
  if (labelsWrapper) labelsWrapper.style.display = 'flex';

  const qty = document.getElementById('qty-per-label')?.value || '';
  const customer = (document.getElementById('customer')?.value || '').trim();
  const poJob = (document.getElementById('po-job')?.value || '').trim();

  const partData = {
    part_number: selectedPart.part_number,
    description: selectedPart.description || '',
    bin_location: selectedPart.bin_location || '',
    qty_per_label: qty
  };

  let logoBase64 = '';
  try {
    const logoPath = await window.api.db.getSetting('logo_path');
    if (logoPath) logoBase64 = await window.api.fs.readFileBase64(logoPath);
  } catch (_) {}

  const partIframe = partPreviewContainer.querySelector('iframe');
  if (partIframe) {
    partIframe.srcdoc = buildPartLabelHTML(partData, logoBase64);
  }

  const custWrapper = document.getElementById('customer-label-wrapper');
  if (custPreviewContainer && custWrapper) {
    if (customer) {
      custWrapper.style.display = '';
      const custIframe = custPreviewContainer.querySelector('iframe');
      if (custIframe) {
        custIframe.srcdoc = buildCustomerLabelHTML({ customer, po_job: poJob }, partData, logoBase64);
      }
    } else {
      custWrapper.style.display = 'none';
    }
  }
}

async function executePrintJob() {
  const printBtn = document.getElementById('btn-print');
  if (!selectedPart) return;

  const qty = parseInt(document.getElementById('qty-per-label')?.value) || 0;
  if (qty < 1) return;

  const labelCount = parseInt(document.getElementById('label-count')?.value) || 1;
  const containerCount = parseInt(document.getElementById('container-count')?.value) || 1;
  const customer = (document.getElementById('customer')?.value || '').trim();
  const poJob = (document.getElementById('po-job')?.value || '').trim();

  const printerName = await window.api.db.getSetting('printer_name');
  if (!printerName) {
    alert('Printer not configured. Go to Setup to select a printer.');
    return;
  }

  const logoPath = await window.api.db.getSetting('logo_path');
  let logoBase64 = '';
  if (logoPath) {
    try {
      logoBase64 = await window.api.fs.readFileBase64(logoPath);
    } catch (e) {
      alert('Cannot read logo file: ' + logoPath + '\n\nPlease check the path in Setup.');
      return;
    }
  }

  const partData = {
    part_number: selectedPart.part_number,
    description: selectedPart.description || '',
    bin_location: selectedPart.bin_location || '',
    qty_per_label: qty
  };
  const customerData = { customer, po_job: poJob };
  const hasCustomer = customer !== '';

  if (printBtn) {
    printBtn.disabled = true;
    printBtn.textContent = 'Printing...';
  }

  for (let c = 0; c < containerCount; c++) {
    for (let l = 0; l < labelCount; l++) {
      const html = buildPartLabelHTML(partData, logoBase64);
      const result = await window.api.print.printLabel({ html, printerName });
      if (!result.success) {
        alert('Print error: ' + result.error + '\n\nJob stopped. Please check the printer and try again.');
        resetPrintFields();
        return;
      }
    }
    if (hasCustomer) {
      const html = buildCustomerLabelHTML(customerData, partData, logoBase64);
      const result = await window.api.print.printLabel({ html, printerName });
      if (!result.success) {
        alert('Print error: ' + result.error + '\n\nJob stopped. Please check the printer and try again.');
        resetPrintFields();
        return;
      }
    }
  }

  if (printBtn) {
    printBtn.textContent = '✓ Printed';
    setTimeout(() => {
      //resetPrintFields();
      if (printBtn) printBtn.textContent = 'Print';
    }, 1500);
  } else {
    resetPrintFields();
  }
}

// ── Import view ───────────────────────────────────────────────
function initImportView() {
  const browseBtn = document.getElementById('btn-browse-import');
  const confirmBtn = document.getElementById('btn-confirm-import');
  const confirmCheck = document.getElementById('confirm-checkbox');
  const statusEl = document.getElementById('import-status');

  let pendingParts = [];

  if (browseBtn) {
    browseBtn.addEventListener('click', async () => {
      const filePath = await window.api.dialog.openFile({
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xlsm'] }]
      });
      if (!filePath) return;

      statusEl.textContent = 'Reading file...';
      try {
        const base64 = await window.api.fs.readFileBase64(filePath);
        pendingParts = parsePartsFromXlsx(base64);
        showImportPreview(pendingParts);
        document.getElementById('preview-section').style.display = '';
        statusEl.textContent = `Detected ${pendingParts.length} parts after filtering.`;
        document.getElementById('warning-banner').style.display = '';
        document.getElementById('confirm-row').style.display = '';
        confirmCheck.checked = false;
        if (confirmBtn) confirmBtn.disabled = true;
      } catch (e) {
        statusEl.textContent = 'Error reading file: ' + e.message;
      }
    });
  }

  if (confirmCheck) {
    confirmCheck.addEventListener('change', () => {
      if (confirmBtn) confirmBtn.disabled = !confirmCheck.checked;
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (pendingParts.length === 0) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Importing...';
      try {
        const result = await window.api.db.importParts(pendingParts);
        await rebuildSearchIndex();
        showToast(`Imported ${result.count} parts successfully — ${new Date().toLocaleTimeString()}`);
        statusEl.textContent = `✓ Imported ${result.count} parts on ${new Date().toLocaleString()}`;
        confirmBtn.textContent = '✓ Imported';
      } catch (e) {
        statusEl.textContent = 'Import failed: ' + e.message;
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Import';
      }
    });
  }
}

function parsePartsFromXlsx(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const workbook = XLSX.read(bytes.buffer, { type: 'array' });

  const sheet = workbook.Sheets['Sheet1'];
  if (!sheet) throw new Error('Sheet "Sheet1" not found in workbook.');

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Row 0 is header; find column indices
  const header = rows[0].map(h => String(h).trim());
  const colItem = header.indexOf('Item');
  const colDesc = header.indexOf('Description');
  const colBin = header.indexOf('Bin Location');

  if (colItem === -1) throw new Error('Column "Item" not found. Expected header row with: Item, Description, Bin Location');
  if (colDesc === -1) throw new Error('Column "Description" not found.');
  if (colBin === -1) throw new Error('Column "Bin Location" not found.');

  const parts = [];
  const now = new Date().toISOString();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const item = String(row[colItem] || '').trim();
    const desc = String(row[colDesc] || '').trim();
    const binRaw = String(row[colBin] || '').trim();

    if (!item) continue;
    if (!item.includes(':')) continue;
    if (desc.toLowerCase().includes('do not use')) continue;

    const colonIdx = item.indexOf(':');
    const category = item.substring(0, colonIdx).trim();
    const part_number = item.substring(colonIdx + 1).trim();

    if (!part_number) continue;

    let bin_location = '';
    if (binRaw.toLowerCase().includes('tulsa:')) {
      const tulsaIdx = binRaw.toLowerCase().indexOf('tulsa:');
      const afterTulsa = binRaw.substring(tulsaIdx + 6);
      const commaIdx = afterTulsa.indexOf(',');
      bin_location = (commaIdx !== -1 ? afterTulsa.substring(0, commaIdx) : afterTulsa).trim();
    }

    parts.push({ part_number, description: desc, category, bin_location, updated_at: now });
  }

  return parts;
}

function showImportPreview(parts) {
  const tbody = document.getElementById('preview-tbody');
  if (!tbody) return;
  const preview = parts.slice(0, 10);
  tbody.innerHTML = preview.map(p => `
    <tr>
      <td>${escapeHtml(p.part_number)}</td>
      <td>${escapeHtml(p.description)}</td>
      <td>${escapeHtml(p.bin_location)}</td>
    </tr>
  `).join('');
}

// ── Parts view ────────────────────────────────────────────────
let partsViewData = [];
let partsSortKey = 'part_number';
let partsSortDir = 1;
let selectedPartRow = null;
let partsSearchTimer = null;

function initPartsView() {
  partsViewData = [...partsArray];
  renderPartsTable(partsViewData);

  const searchInput = document.getElementById('parts-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(partsSearchTimer);
      partsSearchTimer = setTimeout(() => filterPartsView(searchInput.value), 150);
    });
  }

  document.querySelectorAll('.parts-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (partsSortKey === key) partsSortDir *= -1;
      else { partsSortKey = key; partsSortDir = 1; }
      sortAndRenderParts();
      updateSortArrows();
    });
  });
}

function filterPartsView(query) {
  if (!query || query.trim().length < 2) {
    partsViewData = [...partsArray];
  } else {
    const results = fuse ? fuse.search(query.trim()).map(r => r.item) : partsArray;
    partsViewData = results;
  }
  sortAndRenderParts();
}

function sortAndRenderParts() {
  partsViewData.sort((a, b) => {
    const av = (a[partsSortKey] || '').toLowerCase();
    const bv = (b[partsSortKey] || '').toLowerCase();
    return av < bv ? -partsSortDir : av > bv ? partsSortDir : 0;
  });
  renderPartsTable(partsViewData);
}

function renderPartsTable(data) {
  const tbody = document.getElementById('parts-tbody');
  const countEl = document.getElementById('parts-count');
  if (!tbody) return;

  if (partsArray.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="no-parts-message">No parts imported yet. Go to Import to load your parts list.</td></tr>';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) {
    countEl.textContent = data.length === partsArray.length
      ? `${partsArray.length} parts`
      : `Showing ${data.length} of ${partsArray.length} parts`;
  }

  tbody.innerHTML = data.map(p => `
    <tr data-id="${p.id}">
      <td>${escapeHtml(p.part_number)}</td>
      <td>${escapeHtml(p.description || '')}</td>
      <td>${escapeHtml(p.bin_location || '')}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => selectPartRow(parseInt(row.dataset.id), row));
  });
}

function updateSortArrows() {
  document.querySelectorAll('.parts-table th[data-sort]').forEach(th => {
    const arrow = th.querySelector('.sort-arrow');
    if (!arrow) return;
    if (th.dataset.sort === partsSortKey) {
      arrow.textContent = partsSortDir === 1 ? ' ↑' : ' ↓';
    } else {
      arrow.textContent = '';
    }
  });
}

function selectPartRow(id, rowEl) {
  const part = partsArray.find(p => p.id === id);
  if (!part) return;
  selectedPartRow = part;

  document.querySelectorAll('.parts-table tr.selected').forEach(r => r.classList.remove('selected'));
  if (rowEl) rowEl.classList.add('selected');

  showPartDetail(part);
}

function showPartDetail(part) {
  const panel = document.getElementById('part-detail-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="detail-part-number">${escapeHtml(part.part_number)}</div>
    <div class="detail-meta">
      <span>Category: ${escapeHtml(part.category || '—')}</span>
      <span>Bin: ${escapeHtml(part.bin_location || '—')}</span>
    </div>
    <div>
      <label for="detail-desc">Description</label>
      <textarea id="detail-desc" class="detail-desc-textarea">${escapeHtml(part.description || '')}</textarea>
    </div>
    <div class="detail-actions">
      <button class="btn-primary" id="btn-save-desc" disabled>Save</button>
      <button class="btn-secondary" id="btn-cancel-desc">Cancel</button>
      <span class="save-indicator" id="save-indicator"></span>
    </div>
  `;

  const textarea = panel.querySelector('#detail-desc');
  const saveBtn = panel.querySelector('#btn-save-desc');
  const cancelBtn = panel.querySelector('#btn-cancel-desc');
  const saveIndicator = panel.querySelector('#save-indicator');
  const originalDesc = part.description || '';

  textarea.addEventListener('input', () => {
    saveBtn.disabled = textarea.value === originalDesc;
  });

  cancelBtn.addEventListener('click', () => {
    textarea.value = originalDesc;
    saveBtn.disabled = true;
    saveIndicator.textContent = '';
  });

  saveBtn.addEventListener('click', async () => {
    const newDesc = textarea.value;
    const updatedAt = new Date().toISOString();
    await window.api.db.updateDescription({ id: part.id, description: newDesc, updated_at: updatedAt });

    const idx = partsArray.findIndex(p => p.id === part.id);
    if (idx !== -1) {
      partsArray[idx].description = newDesc;
      partsArray[idx].updated_at = updatedAt;
    }
    const vIdx = partsViewData.findIndex(p => p.id === part.id);
    if (vIdx !== -1) partsViewData[vIdx].description = newDesc;

    const tableRow = document.querySelector(`.parts-table tr[data-id="${part.id}"] td:nth-child(2)`);
    if (tableRow) tableRow.textContent = newDesc;

    await rebuildSearchIndex();
    saveBtn.disabled = true;
    saveIndicator.textContent = '✓ Saved';
    setTimeout(() => { saveIndicator.textContent = ''; }, 1500);
  });
}

// ── Setup view ────────────────────────────────────────────────
async function initSetupView() {
  const settings = await window.api.db.getAllSettings();

  const printerSelect = document.getElementById('printer-select');
  const logoInput = document.getElementById('logo-path');
  const browseLogoBtn = document.getElementById('btn-browse-logo');
  const logoPreview = document.getElementById('logo-preview');
  const logoError = document.getElementById('logo-error');
  const saveBtn = document.getElementById('btn-save-settings');
  const savedMsg = document.getElementById('settings-saved');
  const testPrintBtn = document.getElementById('btn-test-print');

  if (printerSelect) {
    const printers = await window.api.print.getInstalledPrinters();
    printerSelect.innerHTML = '';
    const saved = settings.printer_name || '';
    let found = false;
    printers.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === saved) { opt.selected = true; found = true; }
      printerSelect.appendChild(opt);
    });
    if (saved && !found) {
      const opt = document.createElement('option');
      opt.value = saved;
      opt.textContent = `(saved printer not found) ${saved}`;
      opt.disabled = true;
      opt.selected = true;
      printerSelect.insertBefore(opt, printerSelect.firstChild);
    }
  }

  if (logoInput) {
    logoInput.value = settings.logo_path || '';
    if (settings.logo_path) loadLogoPreview(settings.logo_path, logoPreview, logoError);

    logoInput.addEventListener('input', () => {
      loadLogoPreview(logoInput.value.trim(), logoPreview, logoError);
    });
  }

  if (browseLogoBtn) {
    browseLogoBtn.addEventListener('click', async () => {
      const filePath = await window.api.dialog.openFile({
        filters: [{ name: 'PNG Images', extensions: ['png'] }]
      });
      if (filePath && logoInput) {
        logoInput.value = filePath;
        loadLogoPreview(filePath, logoPreview, logoError);
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const printerName = printerSelect ? printerSelect.value : '';
      const logoPath = logoInput ? logoInput.value.trim() : '';
      await window.api.db.setSetting('printer_name', printerName);
      await window.api.db.setSetting('logo_path', logoPath);
      if (savedMsg) {
        savedMsg.textContent = '✓ Settings saved';
        setTimeout(() => { savedMsg.textContent = ''; }, 2000);
      }
    });
  }

  if (testPrintBtn) {
    testPrintBtn.addEventListener('click', async () => {
      const printerName = printerSelect ? printerSelect.value : '';
      if (!printerName) { alert('No printer selected.'); return; }

      const logoPath = logoInput ? logoInput.value.trim() : '';
      let logoBase64 = '';
      if (logoPath) {
        try { logoBase64 = await window.api.fs.readFileBase64(logoPath); } catch (_) {}
      }

      const testPart = { part_number: 'TEST-001', description: 'This is a test label to verify printer alignment and layout', bin_location: 'A01B', qty_per_label: '999' };
      const testCustomer = { customer: 'Test Customer', po_job: 'PO-TEST-001' };

      testPrintBtn.disabled = true;
      testPrintBtn.textContent = 'Printing...';

      const r1 = await window.api.print.printLabel({ html: buildPartLabelHTML(testPart, logoBase64), printerName });
      if (!r1.success) { alert('Print error: ' + r1.error); testPrintBtn.disabled = false; testPrintBtn.textContent = 'Test Print'; return; }

      const r2 = await window.api.print.printLabel({ html: buildCustomerLabelHTML(testCustomer, testPart, logoBase64), printerName });
      if (!r2.success) { alert('Print error: ' + r2.error); testPrintBtn.disabled = false; testPrintBtn.textContent = 'Test Print'; return; }

      testPrintBtn.textContent = '✓ Printed';
      setTimeout(() => { testPrintBtn.disabled = false; testPrintBtn.textContent = 'Test Print'; }, 2000);
    });
  }
}

async function loadLogoPreview(path, previewEl, errorEl) {
  if (!path) {
    if (previewEl) previewEl.style.display = 'none';
    if (errorEl) errorEl.textContent = '';
    return;
  }
  try {
    const base64 = await window.api.fs.readFileBase64(path);
    if (previewEl) {
      previewEl.src = `data:image/png;base64,${base64}`;
      previewEl.style.display = '';
    }
    if (errorEl) errorEl.textContent = '';
  } catch (e) {
    if (previewEl) previewEl.style.display = 'none';
    if (errorEl) errorEl.textContent = '⚠ Cannot read file at this path';
  }
}

// ── Label builders ────────────────────────────────────────────
function buildPartLabelHTML(partData, logoBase64) {
  const logoSrc = logoBase64 ? `data:image/png;base64,${logoBase64}` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: 4in 3in landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 4in; height: 3in;
    font-family: Arial, sans-serif;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.15in;
  }
  .logo-wrapper {
    width: 100%
    flex-shrink: 0;
    margin-bottom: 0.14in;
  }
  .logo-wrapper img { width: 100%; height: auto; display: block; }
  .part-number {
    font-size: 28pt;
    font-weight: bold;
    text-transform: uppercase;
    line-height: 1.1;
    flex-shrink: 0;
    text-align: center;
    width: 100%
    margin-bottom: 0.14in;
  }
  .desc-container {
    flex: 1;
    width: 100%
    overflow: hidden;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
  .description {
    font-size: 28pt;
    line-height: 1.3;
    text-align: center;
    width: 100%;
  }
  .qty-row {
    font-size: 28pt;
    font-weight: bold;
    flex-shrink: 0;
    text-align: center;
    margin-top: 0.06in;
  }
</style>
</head>
<body>
  ${logoSrc ? `<div class="logo-wrapper"><img src="${logoSrc}" /></div>` : ''}
  <div class="part-number" id="pn">${escapeHtmlStr(partData.part_number)}</div>
  <div class="desc-container">
    <div class="description" id="desc">${escapeHtmlStr(partData.description)}</div>
  </div>
  <div class="qty-row">QTY: ${escapeHtmlStr(String(partData.qty_per_label))}</div>
  <script>
    (function() {
      const desc = document.getElementById('desc');
      const container = desc.parentElement;
      let size = 28;
      while (desc.scrollHeight > container.clientHeight && size > 8) {
        size -= 0.5;
        desc.style.fontSize = size + 'pt';
      }
      const pn = document.getElementById('pn');
      let pnSize = 28;
      while (pn.scrollWidth > pn.parentElement.clientWidth && pnSize > 10) {
        pnSize -= 0.5;
        pn.style.fontSize = pnSize + 'pt';
      }
    })();
  <\/script>
</body>
</html>`;
}

function buildCustomerLabelHTML(customerData, partData, logoBase64) {
  const logoSrc = logoBase64 ? `data:image/png;base64,${logoBase64}` : '';
  const showPo = customerData.po_job && customerData.po_job.trim() !== '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: 4in 3in landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 4in; height: 3in;
    font-family: Arial, sans-serif;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.15in;
  }
  .logo-wrapper {
    width: 75%;
    flex-shrink: 0;
    margin-bottom: 0.14in;
  }
  .logo-wrapper img { width: 100%; height: auto; display: block; }
  .customer-name {
    font-size: 36pt;
    font-weight: bold;
    text-align: center;
    line-height: 1.2;
    width: 75%;
    flex-shrink: 0;
  }
  .spacer { flex: 1; }
  .po-name {
    font-size: 28pt;
    text-align: center;
    line-height: 1.2;
    width: 75%;
    flex-shrink: 0;
    ${showPo ? '' : 'display: none;'}
  }
</style>
</head>
<body>
  ${logoSrc ? `<div class="logo-wrapper"><img src="${logoSrc}" /></div>` : ''}
  <div class="customer-name" id="cust-name">${escapeHtmlStr(customerData.customer)}</div>
  <div class="spacer"></div>
  ${showPo ? `<div class="po-name" id="po-name">${escapeHtmlStr(customerData.po_job)}</div>` : ''}
  <script>
    (function() {
      function fitText(el, startSize) {
        let size = startSize;
        while ((el.scrollHeight > el.parentElement.clientHeight || el.scrollWidth > el.clientWidth) && size > 8) {
          size -= 0.5;
          el.style.fontSize = size + 'pt';
        }
      }
      const custEl = document.getElementById('cust-name');
      if (custEl) fitText(custEl, 36);
      const poEl = document.getElementById('po-name');
      if (poEl) fitText(poEl, 28);
    })();
  <\/script>
</body>
</html>`;
}

function escapeHtmlStr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtml(str) {
  return escapeHtmlStr(str);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => loadView(el.dataset.view));
  });

  await rebuildSearchIndex();
  await loadView('print');
});
