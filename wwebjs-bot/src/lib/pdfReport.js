"use strict";

/**
 * PDF report generation for group delivery reports.
 * Extracted from src/api/routes/reports.js to keep the route handler thin.
 */

const logger = require("../logger");

/**
 * Format an amount as a French-locale integer string (no decimals).
 * FCFA is a whole-number currency.
 */
function formatCurrency(amount) {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return "0";
  }
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.round(numAmount));
  return formatted.replace(/[\u00A0\u202F]/g, " ").trim();
}

/**
 * Generate the full group delivery PDF into the given PDFDocument instance.
 *
 * @param {PDFDocument} doc - pdfkit document (caller pipes it to response)
 * @param {{
 *   agency: object,
 *   group: object,
 *   startDate: string|null,
 *   endDate: string|null,
 *   totalEncaisse: number,
 *   totalTarifs: number,
 *   fixedStatusTarifs: object,
 *   tarifsParQuartier: object,
 *   allLivraisonsDetails: Array,
 *   totalFraisExpeditions: number,
 *   totalExpeditions: number,
 *   stockLines?: Array<{ name: string, quantity: number, subtitle?: string|null }>,
 * }} data
 */
function generateGroupPdf(doc, data) {
  const {
    agency,
    group,
    startDate,
    endDate,
    totalEncaisse,
    totalTarifs,
    fixedStatusTarifs,
    tarifsParQuartier,
    allLivraisonsDetails,
    totalFraisExpeditions,
    totalExpeditions,
    stockLines = [],
  } = data;

  // ── Page constants ─────────────────────────────────────────────────────────
  const pageWidth = 595;       // A4 width in points
  const pageHeight = 842;      // A4 height in points
  const leftColumnX = 50;
  const SAFE_PAGE_BREAK = 780; // safe break leaving ~60pt buffer

  const generationDate = new Date().toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const agencyInfo = {
    email: agency.email,
    phone: agency.phone,
  };

  // ── Mutable state (shared across inner helpers via closure) ────────────────
  let currentY;
  let hasContentOnPage = false;
  let pageNumber = 1;

  // ── Debug harness (set PDF_DEBUG=true locally to trace page creation) ──────
  const PDF_DEBUG = false;
  let debugPageIndex = 1;
  let isManualAddPage = false;
  let manualAddPageReason = "";
  let lastPageAddKind = null;
  let footerInProgress = false;
  let suppressNextManualAddForResume = false;

  const dbg = (label, extra = {}) => {
    if (!PDF_DEBUG) return;
    try {
      console.log("[PDFDBG]", label, {
        page: debugPageIndex,
        currentY,
        docY: doc?.y,
        hasContentOnPage,
        manualAddPageReason,
        ...extra,
      });
    } catch (e) {
      console.log("[PDFDBG]", label, extra);
    }
  };

  // ── pageAdded listener ─────────────────────────────────────────────────────
  doc.on("pageAdded", () => {
    debugPageIndex += 1;
    pageNumber += 1;
    const kind = isManualAddPage ? "manual" : "auto";
    const reason = isManualAddPage ? manualAddPageReason : undefined;
    lastPageAddKind = kind;

    if (PDF_DEBUG)
      console.log("[PDFDBG] pageAdded", {
        page: debugPageIndex,
        kind,
        reason,
        currentY,
        docY: doc?.y,
        hasContentOnPage,
        footerInProgress,
      });

    drawHeader(false);
    // drawHeader() already sets currentY to the correct safe position below the header.
    // Never override it — for both manual and auto pages currentY is correct after drawHeader.

    if (!isManualAddPage) {
      hasContentOnPage = false;
      if (footerInProgress) suppressNextManualAddForResume = true;
    }

    isManualAddPage = false;
    manualAddPageReason = "";
  });

  // ── addPage helper ─────────────────────────────────────────────────────────
  const addPage = (reason) => {
    if (reason === "beforeResume" && suppressNextManualAddForResume) {
      dbg("addPage() suppressed (auto page already created for Résumé)", { reason });
      suppressNextManualAddForResume = false;
      return;
    }
    isManualAddPage = true;
    manualAddPageReason = reason || "";
    dbg("addPage()", { reason });
    doc.addPage();
  };

  // ── markContent helper ─────────────────────────────────────────────────────
  const markContent = (tag) => {
    if (!hasContentOnPage) {
      hasContentOnPage = true;
      dbg("markContent", { tag });
    }
  };

  // ── drawHeader ─────────────────────────────────────────────────────────────
  const drawHeader = (isFirstPage = false) => {
    const headerY = 40;
    const centerX = pageWidth / 2;
    const rightColumnX = 320;

    if (isFirstPage && agency.logo_base64) {
      try {
        const base64Data = agency.logo_base64.replace(
          /^data:image\/[^;]+;base64,/,
          ""
        );
        const logoBuffer = Buffer.from(base64Data, "base64");
        const logoWidth = 120;
        const logoHeight = 120;
        doc.image(logoBuffer, centerX - logoWidth / 2, headerY, {
          width: logoWidth,
          height: logoHeight,
          fit: [logoWidth, logoHeight],
        });
      } catch (error) {
        logger.error({ err: error }, "PDF: error loading logo");
      }
    }

    currentY = headerY + (isFirstPage && agency.logo_base64 ? 120 : 0);

    doc.fontSize(12).font("Helvetica-Bold").fillColor("#1a1a1a");
    doc.text(agency.name || "Agence", leftColumnX, currentY);
    let leftY = currentY + 16;

    if (agency.address) {
      doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a");
      doc.text(agency.address, leftColumnX, leftY);
      leftY += 12;
    }
    if (agency.phone) {
      doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a");
      doc.text(`Tél: ${agency.phone}`, leftColumnX, leftY);
      leftY += 12;
    }
    if (agency.email) {
      doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a");
      doc.text(agency.email, leftColumnX, leftY);
      leftY += 12;
    }

    const rightValueX = rightColumnX + 75;
    let rightY = currentY;

    const reportNumber = `R${new Date().getFullYear()}${String(
      new Date().getMonth() + 1
    ).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}${String(
      group.id
    ).padStart(3, "0")}`;

    const rightRows = [
      { label: "Client N°:", value: String(group.id) },
      { label: "Rapport N°:", value: reportNumber },
      { label: "Destinataire:", value: group.name },
      {
        label: "Période:",
        value: `${startDate || new Date().toISOString().split("T")[0]} - ${
          endDate || new Date().toISOString().split("T")[0]
        }`,
      },
    ];

    rightRows.forEach(({ label, value }) => {
      doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a");
      doc.text(label, rightColumnX, rightY, { width: 70, align: "left" });
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#000000");
      doc.text(value, rightValueX, rightY, { width: 225 - 75, ellipsis: true });
      rightY += 12;
    });

    doc.fillColor("#000000");
    const maxY = Math.max(leftY, rightY);
    currentY = maxY + 25;
  };

  // ── drawFooter ─────────────────────────────────────────────────────────────
  const drawFooter = (docInstance) => {
    footerInProgress = true;
    dbg("drawFooter()");
    const { width, height, margins } = docInstance.page;
    const leftX = margins.left;
    const usableWidth = width - margins.left - margins.right;
    const bottomY = height - margins.bottom;
    const footerLineY = bottomY - 22;
    const textY = bottomY - 18;

    docInstance
      .moveTo(leftX, footerLineY)
      .lineTo(width - margins.right, footerLineY)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    docInstance.fontSize(8).font("Helvetica").fillColor("#666666");
    docInstance.text(`Rapport généré le: ${generationDate}`, leftX, textY, {
      width: usableWidth,
      align: "left",
      lineBreak: false,
      ellipsis: true,
      continued: false,
    });

    docInstance.text(`Page ${pageNumber}`, leftX, textY, {
      width: usableWidth,
      align: "right",
      lineBreak: false,
      ellipsis: true,
      continued: false,
    });

    docInstance.fillColor("#000000");
    footerInProgress = false;
  };

  // ── ensureSpace helper ─────────────────────────────────────────────────────
  const ensureSpace = (neededHeight, onNewPage, threshold = SAFE_PAGE_BREAK) => {
    dbg("ensureSpace()", { neededHeight, threshold });
    if (currentY + neededHeight > threshold) {
      const MIN_CONTENT_HEIGHT = 200;
      if (hasContentOnPage && currentY >= MIN_CONTENT_HEIGHT) {
        drawFooter(doc);
        addPage("ensureSpace");
        // currentY is already set correctly by drawHeader() inside the pageAdded listener
        hasContentOnPage = false;
        if (onNewPage) onNewPage();
      } else {
        // Not enough content for a footer — currentY from drawHeader() is already correct
        hasContentOnPage = false;
        if (onNewPage) onNewPage();
      }
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ── DRAW CONTENT ──────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // First page header
  drawHeader(true);

  // ── Section 1: Détails des livraisons ─────────────────────────────────────
  const section1Title = "DÉTAILS DES LIVRAISONS";
  const section1TitleWidth = doc.widthOfString(section1Title, {
    fontSize: 14,
    font: "Helvetica-Bold",
  });

  doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a");
  doc.text(section1Title, leftColumnX, currentY);

  doc
    .moveTo(leftColumnX, currentY + 18)
    .lineTo(leftColumnX + section1TitleWidth, currentY + 18)
    .lineWidth(0.5)
    .strokeColor("#cccccc")
    .stroke()
    .strokeColor("#000000")
    .lineWidth(1);

  currentY += 25;
  markContent("section1:title");

  // Table header columns
  const tableTop = currentY;
  const col1X = leftColumnX;
  const col2X = col1X + 110;
  const col3X = col2X + 90;
  const col4X = col3X + 75;
  const col5X = col4X + 110;
  const tableRight = 545;

  doc
    .rect(col1X - 5, tableTop - 5, tableRight - col1X + 10, 18)
    .fillColor("#e8e8e8")
    .fill()
    .fillColor("#000000");

  doc.fontSize(8).font("Helvetica-Bold").fillColor("#1a1a1a");
  doc.text("Quartier", col1X + 3, tableTop + 1, { width: 105, ellipsis: true });
  doc.text("Téléphone", col2X, tableTop + 1, { width: 85, align: "left", ellipsis: true });
  doc.text("Statut", col3X, tableTop + 1, { width: 70, align: "left", ellipsis: true });
  doc.text("Montant cmd FCFA", col4X, tableTop + 1, { width: 105, align: "right" });
  doc.text("Montant reçu FCFA", col5X, tableTop + 1, { width: 100, align: "right" });

  doc
    .rect(col1X - 5, tableTop - 5, tableRight - col1X + 10, 18)
    .lineWidth(1)
    .strokeColor("#333333")
    .stroke()
    .strokeColor("#000000");

  currentY = tableTop + 18;

  doc.fontSize(8).font("Helvetica");
  let totalEncaisseTable = 0;
  let rowIndex = 0;

  const statusLabels = {
    pending: "En cours",
    delivered: "Livré",
    failed: "Annulé",
    cancelled: "Annulé",
    postponed: "Renvoyé",
    renvoyé: "Renvoyé",
    injoignable: "Injoignable",
    pickup: "Au bureau",
    expedition: "Expédition",
    client_absent: "Client absent",
    unreachable: "Injoignable",
    ne_decroche_pas: "Ne décroche pas",
    no_answer: "Ne décroche pas",
    present_ne_decroche_zone1: "CPCNDP Z1",
    present_ne_decroche_zone2: "CPCNDP Z2",
  };

  if (allLivraisonsDetails.length === 0) {
    doc.fontSize(9).font("Helvetica").fillColor("#666666");
    doc.text("Aucune livraison pour cette période", col1X + 3, currentY + 5, {
      width: tableRight - col1X,
      align: "center",
    });
    doc.fillColor("#000000");
    currentY += 20;
    markContent("section1:emptyMessage");
  } else {
    allLivraisonsDetails.forEach((item) => {
      ensureSpace(15, () => {
        rowIndex = 0;
      });

      if (item.status === "delivered" || item.status === "pickup") {
        totalEncaisseTable += item.amountPaid || 0;
      }

      if (rowIndex % 2 === 0) {
        doc
          .rect(col1X - 5, currentY - 2, tableRight - col1X + 10, 15)
          .fillColor("#f8f8f8")
          .fill()
          .fillColor("#000000");
      }

      doc.fillColor("#1a1a1a");
      doc.text(item.quartier || "", col1X + 3, currentY + 1, { width: 105, ellipsis: true });
      doc.text(item.phone || "", col2X, currentY + 1, { width: 85, ellipsis: true });
      doc.text(statusLabels[item.status] || item.status, col3X, currentY + 1, { width: 70, ellipsis: true });
      doc.text(formatCurrency(item.amountDue), col4X, currentY + 1, { width: 105, align: "right" });
      doc.text(formatCurrency(item.amountPaid), col5X, currentY + 1, { width: 100, align: "right" });
      doc.fillColor("#000000");

      doc
        .moveTo(col1X - 5, currentY + 13)
        .lineTo(tableRight + 5, currentY + 13)
        .lineWidth(0.5)
        .strokeColor("#e0e0e0")
        .stroke()
        .strokeColor("#000000")
        .lineWidth(1);

      currentY += 15;
      markContent("section1:row");
      rowIndex++;
    });

    ensureSpace(35);

    currentY += 6;
    doc
      .moveTo(col1X - 5, currentY)
      .lineTo(tableRight + 5, currentY)
      .lineWidth(2)
      .strokeColor("#666666")
      .stroke()
      .lineWidth(1)
      .strokeColor("#000000");
    currentY += 12;

    doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a1a1a");
    doc.text("Total encaissé:", col1X + 3, currentY + 1, { width: 190 });
    doc.text(formatCurrency(totalEncaisseTable), col5X, currentY + 1, { width: 100, align: "right" });
    doc.fillColor("#000000");
    currentY += 16;
  }

  // ── Section 2: Tarifs par livraison ───────────────────────────────────────
  const fixedStatusList = [];
  if (fixedStatusTarifs.pickup.count > 0) {
    fixedStatusList.push({
      quartier: fixedStatusTarifs.pickup.label,
      count: fixedStatusTarifs.pickup.count,
      total: fixedStatusTarifs.pickup.total,
      standardTariff: fixedStatusTarifs.pickup.fixedTariff,
    });
  }
  if (fixedStatusTarifs.present_ne_decroche_zone1.count > 0) {
    fixedStatusList.push({
      quartier: fixedStatusTarifs.present_ne_decroche_zone1.label,
      count: fixedStatusTarifs.present_ne_decroche_zone1.count,
      total: fixedStatusTarifs.present_ne_decroche_zone1.total,
      standardTariff: fixedStatusTarifs.present_ne_decroche_zone1.fixedTariff,
    });
  }
  if (fixedStatusTarifs.present_ne_decroche_zone2.count > 0) {
    fixedStatusList.push({
      quartier: fixedStatusTarifs.present_ne_decroche_zone2.label,
      count: fixedStatusTarifs.present_ne_decroche_zone2.count,
      total: fixedStatusTarifs.present_ne_decroche_zone2.total,
      standardTariff: fixedStatusTarifs.present_ne_decroche_zone2.fixedTariff,
    });
  }

  const quartierTarifsList = Object.values(tarifsParQuartier);
  const tarifsList = [...fixedStatusList, ...quartierTarifsList];

  const spaceForTarifsTitle = 15 + 25 + 18;
  const minTarifsRows =
    tarifsList.length > 0 ? Math.min(2, tarifsList.length) * 15 + 15 : 20;
  ensureSpace(spaceForTarifsTitle + minTarifsRows);

  currentY += 15;

  const section2Title = "TARIFS PAR LIVRAISON";
  const section2TitleWidth = doc.widthOfString(section2Title, {
    fontSize: 14,
    font: "Helvetica-Bold",
  });

  doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a");
  doc.text(section2Title, leftColumnX, currentY);

  doc
    .moveTo(leftColumnX, currentY + 18)
    .lineTo(leftColumnX + section2TitleWidth, currentY + 18)
    .lineWidth(0.5)
    .strokeColor("#cccccc")
    .stroke()
    .strokeColor("#000000")
    .lineWidth(1);

  currentY += 25;
  doc.fillColor("#000000");

  const tarifsTableTop = currentY;
  const tarifsCol1X = leftColumnX;
  const tarifsCol2X = tarifsCol1X + 200;
  const tarifsCol3X = tarifsCol2X + 60;
  const tarifsCol4X = tarifsCol3X + 80;

  doc
    .rect(tarifsCol1X - 5, tarifsTableTop - 5, tableRight - tarifsCol1X + 10, 18)
    .fillColor("#e8e8e8")
    .fill()
    .fillColor("#000000");

  doc.fontSize(8).font("Helvetica-Bold").fillColor("#1a1a1a");
  doc.text("Description", tarifsCol1X + 3, tarifsTableTop + 1);
  doc.text("Qté", tarifsCol2X, tarifsTableTop + 1, { width: 50, align: "right" });
  doc.text("PU HT FCFA", tarifsCol3X, tarifsTableTop + 1, { width: 80, align: "right" });
  doc.text("Montant HT FCFA", tarifsCol4X, tarifsTableTop + 1, { width: 80, align: "right" });
  doc.fillColor("#000000");

  doc
    .rect(tarifsCol1X - 5, tarifsTableTop - 5, tableRight - tarifsCol1X + 10, 18)
    .lineWidth(1)
    .strokeColor("#333333")
    .stroke()
    .strokeColor("#000000");

  currentY = tarifsTableTop + 18;

  doc.fontSize(8).font("Helvetica");
  let tarifRowIndex = 0;

  if (tarifsList.length === 0) {
    doc.fontSize(9).font("Helvetica").fillColor("#666666");
    doc.text(
      "Aucun tarif appliqué pour cette période",
      tarifsCol1X + 3,
      currentY + 5,
      { width: tableRight - tarifsCol1X, align: "center" }
    );
    doc.fillColor("#000000");
    currentY += 20;
    markContent("section2:emptyMessage");
  } else {
    tarifsList.forEach((tarif) => {
      ensureSpace(15, () => {
        tarifRowIndex = 0;
      });

      if (tarifRowIndex % 2 === 0) {
        doc
          .rect(tarifsCol1X - 5, currentY - 2, tableRight - tarifsCol1X + 10, 15)
          .fillColor("#f8f8f8")
          .fill()
          .fillColor("#000000");
      }

      const unitPrice =
        tarif.standardTariff !== undefined
          ? tarif.standardTariff
          : tarif.total / tarif.count;

      doc.fillColor("#1a1a1a");
      doc.text(tarif.quartier, tarifsCol1X + 3, currentY + 1, { width: 190 });
      doc.text(tarif.count.toString(), tarifsCol2X, currentY + 1, { width: 50, align: "right" });
      doc.text(formatCurrency(unitPrice), tarifsCol3X, currentY + 1, { width: 80, align: "right" });
      doc.text(formatCurrency(tarif.total), tarifsCol4X, currentY + 1, { width: 80, align: "right" });
      doc.fillColor("#000000");

      doc
        .moveTo(tarifsCol1X - 5, currentY + 13)
        .lineTo(tableRight + 5, currentY + 13)
        .lineWidth(0.5)
        .strokeColor("#e0e0e0")
        .stroke()
        .strokeColor("#000000")
        .lineWidth(1);

      currentY += 15;
      markContent("section2:row");
      tarifRowIndex++;
    });

    ensureSpace(32);

    doc
      .moveTo(tarifsCol1X - 5, currentY)
      .lineTo(tableRight + 5, currentY)
      .lineWidth(2)
      .strokeColor("#666666")
      .stroke()
      .lineWidth(1)
      .strokeColor("#000000");
    currentY += 12;

    if (tarifRowIndex % 2 === 0) {
      doc
        .rect(tarifsCol1X - 5, currentY - 2, tableRight - tarifsCol1X + 10, 15)
        .fillColor("#f8f8f8")
        .fill()
        .fillColor("#000000");
    }

    doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a1a1a");
    doc.text("Total", tarifsCol1X + 3, currentY + 1, { width: 190 });
    doc.text(formatCurrency(totalTarifs), tarifsCol4X, currentY + 1, { width: 80, align: "right" });
    doc.fillColor("#000000");

    doc
      .moveTo(tarifsCol1X - 5, currentY + 13)
      .lineTo(tableRight + 5, currentY + 13)
      .lineWidth(0.5)
      .strokeColor("#e0e0e0")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    currentY += 15;
  }

  // ── Section Stock (optional, manual snapshot) ─────────────────────────────
  if (Array.isArray(stockLines) && stockLines.length > 0) {
    const stockRowHeight = 16;
    ensureSpace(50 + stockLines.length * stockRowHeight);

    currentY += 12;

    const stockTitle = "STOCK (ÉTAT AU MOMENT DU RAPPORT)";
    const stockTitleWidth = doc.widthOfString(stockTitle, {
      fontSize: 14,
      font: "Helvetica-Bold",
    });

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a");
    doc.text(stockTitle, leftColumnX, currentY);

    doc
      .moveTo(leftColumnX, currentY + 18)
      .lineTo(leftColumnX + stockTitleWidth, currentY + 18)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    currentY += 25;
    markContent("stock:title");

    const stCol1 = leftColumnX;
    const stCol2 = stCol1 + 350;
    const stTableTop = currentY;

    doc
      .rect(stCol1 - 5, stTableTop - 5, tableRight - stCol1 + 10, 18)
      .fillColor("#e8e8e8")
      .fill()
      .fillColor("#000000");

    doc.fontSize(8).font("Helvetica-Bold").fillColor("#1a1a1a");
    doc.text("Produit", stCol1 + 3, stTableTop + 1, { width: 340, ellipsis: true });
    doc.text("Qté restante", stCol2, stTableTop + 1, { width: tableRight - stCol2, align: "right" });
    doc.fillColor("#000000");

    doc
      .rect(stCol1 - 5, stTableTop - 5, tableRight - stCol1 + 10, 18)
      .lineWidth(1)
      .strokeColor("#333333")
      .stroke()
      .strokeColor("#000000");

    currentY = stTableTop + 18;
    doc.fontSize(8).font("Helvetica");

    let stIdx = 0;
    stockLines.forEach((row) => {
      ensureSpace(stockRowHeight, () => {
        stIdx = 0;
      });

      if (stIdx % 2 === 0) {
        doc
          .rect(stCol1 - 5, currentY - 2, tableRight - stCol1 + 10, stockRowHeight)
          .fillColor("#f8f8f8")
          .fill()
          .fillColor("#000000");
      }

      doc.fillColor("#1a1a1a");
      doc.text(row.name || "", stCol1 + 3, currentY + 2, { width: 340, ellipsis: true });
      doc.text(String(row.quantity ?? 0), stCol2, currentY + 2, { width: tableRight - stCol2, align: "right" });
      doc.fillColor("#000000");

      doc
        .moveTo(stCol1 - 5, currentY + stockRowHeight - 2)
        .lineTo(tableRight + 5, currentY + stockRowHeight - 2)
        .lineWidth(0.5)
        .strokeColor("#e0e0e0")
        .stroke()
        .strokeColor("#000000")
        .lineWidth(1);

      currentY += stockRowHeight;
      markContent("stock:row");
      stIdx++;
    });

    currentY += 8;
  }

  // ── Section 3: Résumé ──────────────────────────────────────────────────────
  const resumeLineCount = 3 + (totalExpeditions > 0 ? 1 : 0);
  const spaceForResume = 25 + 15 + 28 + 18 * resumeLineCount;
  const MIN_CONTENT_HEIGHT_FOR_FOOTER = 200;

  if (currentY + spaceForResume > SAFE_PAGE_BREAK) {
    if (hasContentOnPage && currentY >= MIN_CONTENT_HEIGHT_FOR_FOOTER) {
      drawFooter(doc);
      addPage("beforeResume");
      // currentY is already set correctly by drawHeader() inside the pageAdded listener
      hasContentOnPage = false;
    } else {
      // currentY from drawHeader() is already correct
      hasContentOnPage = false;
    }
  }

  currentY += 25;

  doc
    .moveTo(leftColumnX, currentY - 15)
    .lineTo(pageWidth - leftColumnX, currentY - 15)
    .lineWidth(0.5)
    .strokeColor("#cccccc")
    .stroke()
    .strokeColor("#000000")
    .lineWidth(1);

  doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a");
  doc.text("RÉSUMÉ", leftColumnX, currentY);
  markContent("section3:title");

  doc
    .moveTo(leftColumnX, currentY + 18)
    .lineTo(leftColumnX + 100, currentY + 18)
    .lineWidth(0.5)
    .strokeColor("#cccccc")
    .stroke()
    .strokeColor("#000000")
    .lineWidth(1);

  currentY += 28;

  const resumeValueX = leftColumnX + 140;
  const resteAPercevoir = totalEncaisse - totalTarifs - totalFraisExpeditions;

  const resumeRows = [
    { label: "Total encaissé:", value: `${formatCurrency(totalEncaisse)} FCFA` },
    { label: "Total tarifs (retirés):", value: `${formatCurrency(totalTarifs)} FCFA` },
    ...(totalExpeditions > 0
      ? [
          {
            label: `Frais expéditions (${totalExpeditions}) :`,
            value: `${formatCurrency(totalFraisExpeditions)} FCFA`,
          },
        ]
      : []),
    {
      label: resteAPercevoir < 0 ? "Dette du groupe:" : "Reste à percevoir:",
      value: `${formatCurrency(Math.abs(resteAPercevoir))} FCFA`,
      isDebt: resteAPercevoir < 0,
    },
  ];

  resumeRows.forEach(({ label, value, isDebt }) => {
    const labelColor = isDebt ? "#cc0000" : "#4a4a4a";
    const valueColor = isDebt ? "#cc0000" : "#000000";
    doc.fontSize(9).font("Helvetica").fillColor(labelColor);
    doc.text(label, leftColumnX, currentY, { width: 135 });
    doc.fontSize(9).font("Helvetica-Bold").fillColor(valueColor);
    doc.text(value, resumeValueX, currentY, { width: 200 });
    currentY += 18;
  });
  doc.fillColor("#000000");

  // Footer on last page
  if (hasContentOnPage && currentY >= 200) {
    drawFooter(doc);
  }

  doc.end();
}

module.exports = { generateGroupPdf, formatCurrency };
