const statusEl = document.getElementById("status");
const tableSelect = document.getElementById("tableSelect");
const tableMeta = document.getElementById("tableMeta");
const preview = document.getElementById("preview");
const exportCsvBtn = document.getElementById("exportCsv");
const exportTsvBtn = document.getElementById("exportTsv");
const exportXlsBtn = document.getElementById("exportXls");
const exportMarkdownBtn = document.getElementById("exportMarkdown");
const exportJsonBtn = document.getElementById("exportJson");

let tables = [];

const setStatus = (text) => {
  statusEl.textContent = text;
};

const escapeCsv = (value) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const tableToCsv = (rows) => rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

const tableToTsv = (rows) => rows.map((row) => row.map((cell) => String(cell ?? "")).join("\t")).join("\n");

const tableToMarkdown = (rows) => {
  if (!rows || rows.length === 0) return "";
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const padRow = (row) => Array.from({ length: columnCount }, (_, i) => String(row[i] ?? ""));
  const header = padRow(rows[0]);
  const separator = header.map(() => "---");
  const body = rows.slice(1).map(padRow);
  const lines = [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`);
  return lines.join("\n");
};

const guessHeaders = (rows) => {
  if (!rows || rows.length < 2) return null;
  const header = rows[0].map((cell) => String(cell ?? "").trim());
  if (header.some((cell) => !cell)) return null;
  const unique = new Set(header.map((cell) => cell.toLowerCase()));
  if (unique.size !== header.length) return null;
  return header;
};

const tableToJson = (rows) => {
  const headers = guessHeaders(rows);
  if (!headers) {
    return JSON.stringify({ rows }, null, 2);
  }
  const dataRows = rows.slice(1);
  const objects = dataRows.map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? "";
    });
    return obj;
  });
  return JSON.stringify({ headers, rows: objects }, null, 2);
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url,
    filename,
    saveAs: true,
  }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
};

const renderPreview = (table) => {
  const rows = table ? table.rows : null;
  if (!rows || rows.length === 0) {
    preview.innerHTML = "<em>No data in this table.</em>";
    return;
  }
  const maxRows = Math.min(5, rows.length);
  const maxCols = Math.min(6, rows.reduce((max, row) => Math.max(max, row.length), 0));
  const head = rows.slice(0, maxRows).map((row, rowIndex) => {
    const cells = row.slice(0, maxCols).map((cell) => {
      const tag = rowIndex === 0 ? "th" : "td";
      return `<${tag}>${String(cell ?? "")}</${tag}>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  const description = table && table.description ? `<div class="preview-title">${table.description}</div>` : "";
  preview.innerHTML = `${description}<table>${head}</table>`;
};

const refreshMeta = (table) => {
  if (!table) {
    tableMeta.textContent = "";
    return;
  }
  const description = table.description ? ` - ${table.description}` : "";
  tableMeta.textContent = `${table.rowCount} rows - ${table.columnCount} columns${description}`;
};

const sendMessageToFrame = (tabId, frameId) => new Promise((resolve) => {
  chrome.tabs.sendMessage(tabId, { type: "GET_TABLES" }, { frameId }, (response) => {
    if (chrome.runtime.lastError) {
      resolve({ tables: [] });
      return;
    }
    resolve(response || { tables: [] });
  });
});

const enrichNameWithFrame = (table) => {
  if (!table.frameTitle && !table.frameUrl) return table;
  const frameLabel = table.frameTitle || table.frameUrl;
  return {
    ...table,
    name: `${table.name} - ${frameLabel}`,
    description: table.description
      ? `${table.description} - ${frameLabel}`
      : `Table detected - ${frameLabel}`,
  };
};

const loadTables = async () => {
  setStatus("Scanning current page...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    setStatus("No active tab found.");
    return;
  }

  chrome.webNavigation.getAllFrames({ tabId: tab.id }, async (frames) => {
    if (chrome.runtime.lastError || !frames || frames.length === 0) {
      setStatus("Unable to access this page.");
      tableSelect.innerHTML = "";
      preview.innerHTML = "";
      return;
    }

    const responses = await Promise.all(
      frames.map((frame) => sendMessageToFrame(tab.id, frame.frameId))
    );

    let collected = [];
    responses.forEach((response) => {
      if (response && response.tables && response.tables.length > 0) {
        collected = collected.concat(response.tables);
      }
    });

    tables = collected.map(enrichNameWithFrame).map((table, index) => ({ ...table, id: index }));
    if (tables.length === 0) {
      setStatus("No tables found on this page.");
      tableSelect.innerHTML = "";
      preview.innerHTML = "";
      return;
    }

    tableSelect.innerHTML = tables
      .map((table) => `<option value="${table.id}">${table.name}</option>`)
      .join("");

    setStatus(`Found ${tables.length} tables.`);
    const selected = tables[0];
    refreshMeta(selected);
    renderPreview(selected);
  });
};

const getSelectedTable = () => {
  const id = Number(tableSelect.value);
  return tables.find((table) => table.id === id);
};

tableSelect.addEventListener("change", () => {
  const selected = getSelectedTable();
  refreshMeta(selected);
  renderPreview(selected);
});

exportCsvBtn.addEventListener("click", () => {
  const selected = getSelectedTable();
  if (!selected) return;
  const csv = tableToCsv(selected.rows);
  downloadBlob(new Blob([csv], { type: "text/csv" }), "table-export.csv");
});

exportTsvBtn.addEventListener("click", () => {
  const selected = getSelectedTable();
  if (!selected) return;
  const tsv = tableToTsv(selected.rows);
  downloadBlob(new Blob([tsv], { type: "text/tab-separated-values" }), "table-export.tsv");
});

exportXlsBtn.addEventListener("click", () => {
  const selected = getSelectedTable();
  if (!selected) return;
  const worksheet = XLSX.utils.aoa_to_sheet(selected.rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Table");
  const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "table-export.xlsx"
  );
});

exportMarkdownBtn.addEventListener("click", () => {
  const selected = getSelectedTable();
  if (!selected) return;
  const markdown = tableToMarkdown(selected.rows);
  downloadBlob(new Blob([markdown], { type: "text/markdown" }), "table-export.md");
});

exportJsonBtn.addEventListener("click", () => {
  const selected = getSelectedTable();
  if (!selected) return;
  const json = tableToJson(selected.rows);
  downloadBlob(new Blob([json], { type: "application/json" }), "table-export.json");
});

loadTables();
