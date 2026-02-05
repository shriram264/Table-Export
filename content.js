(function () {
  const sanitizeText = (text) => text.replace(/\s+/g, " ").trim();

  const safeText = (value) => sanitizeText(String(value || ""));

  const findNearbyHeading = (table) => {
    let el = table.previousElementSibling;
    let steps = 0;
    while (el && steps < 5) {
      if (/^H[1-6]$/i.test(el.tagName)) {
        const text = safeText(el.innerText);
        if (text) return text;
      }
      el = el.previousElementSibling;
      steps += 1;
    }
    return "";
  };

  const buildDescription = (table, rows) => {
    const caption = safeText(table.caption ? table.caption.innerText : "");
    const aria = safeText(table.getAttribute("aria-label") || "");
    const summary = safeText(table.getAttribute("summary") || "");
    const heading = findNearbyHeading(table);
    const id = safeText(table.id);
    const className = safeText(table.className);
    const headerRow = rows && rows.length > 0 ? rows[0].slice(0, 4).map(safeText).filter(Boolean).join(" | ") : "";

    const parts = [];
    if (caption) parts.push(caption);
    if (aria && aria !== caption) parts.push(aria);
    if (heading && heading !== caption && heading !== aria) parts.push(heading);
    if (summary && summary !== caption && summary !== aria) parts.push(summary);
    if (headerRow) parts.push(headerRow);
    if (id) parts.push(`#${id}`);
    if (className) parts.push(`.${className.split(" ").filter(Boolean).slice(0, 2).join(".")}`);

    const description = parts.filter(Boolean).join(" - ");
    return description || "Table detected";
  };

  const extractTable = (table, index, frameContext) => {
    const rows = [];
    const headerCells = table.querySelectorAll("thead th");
    let name = "";

    if (headerCells.length > 0) {
      const headerText = Array.from(headerCells)
        .slice(0, 3)
        .map((cell) => sanitizeText(cell.innerText))
        .filter(Boolean)
        .join(" | ");
      if (headerText) {
        name = headerText;
      }
    }

    const tableRows = Array.from(table.rows);
    tableRows.forEach((row) => {
      const cells = Array.from(row.cells);
      const rowData = [];
      cells.forEach((cell) => {
        const text = sanitizeText(cell.innerText);
        const colSpan = cell.colSpan || 1;
        rowData.push(text);
        for (let i = 1; i < colSpan; i += 1) {
          rowData.push("");
        }
      });
      rows.push(rowData);
    });

    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const description = buildDescription(table, rows);
    if (!name || name.length < 4) {
      name = description.split(" • ")[0] || `Table ${index + 1}`;
    }
    return {
      id: index,
      name,
      description,
      rows,
      columnCount,
      rowCount: rows.length,
      frameTitle: frameContext.title,
      frameUrl: frameContext.url,
    };
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "GET_TABLES") {
      const tables = Array.from(document.querySelectorAll("table"));
      const frameContext = {
        title: sanitizeText(document.title || ""),
        url: location.href,
      };
      const extracted = tables.map((table, index) => extractTable(table, index, frameContext));
      sendResponse({
        tables: extracted,
        frameContext,
      });
      return true;
    }
    return false;
  });
})();
