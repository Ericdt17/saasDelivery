/**
 * Reports Routes
 * PDF generation and report endpoints
 */

const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const { authenticateToken } = require("../middleware/auth");
const {
  getGroupById,
  getDeliveries,
  getAgencyById,
  getTariffsByAgency,
  adapter,
} = require("../../db");
const { buildReportPdfData } = require("../../lib/reportAggregates");
const logger = require("../../logger");

// All routes require authentication
router.use(authenticateToken);

/**
 * Helper function to format currency (without slashes)
 */
function formatCurrency(amount) {
  // Convert to number and handle NaN/undefined/null cases
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return "0,00";
  }

  // Format number and ensure no slashes - use spaces for thousands separator
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(numAmount);

  // Replace any slashes, non-breaking spaces, or other separators with regular spaces
  return formatted.replace(/[/\u00A0\u202F]/g, " ").trim();
}

/**
 * GET /api/v1/reports/groups/:groupId/pdf
 * Generate PDF report for a group's deliveries
 */
router.get("/groups/:groupId/pdf", async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { startDate, endDate } = req.query;

    // Get group
    const group = await getGroupById(parseInt(groupId));
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Group not found",
      });
    }

    // Agency admin can only access their own groups
    if (req.user.role !== "super_admin") {
      const agencyId =
        req.user.agencyId !== null && req.user.agencyId !== undefined
          ? req.user.agencyId
          : req.user.userId;

      if (group.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this group",
        });
      }
    }

    // Get agency info for header
    const agency = await getAgencyById(group.agency_id);
    if (!agency) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Agency not found",
      });
    }

    // Get deliveries for the group in the date range
    const deliveriesResult = await getDeliveries({
      page: 1,
      limit: 10000, // Get all deliveries
      startDate: startDate || null,
      endDate: endDate || null,
      group_id: parseInt(groupId),
      sortBy: "created_at",
      sortOrder: "ASC",
    });

    const deliveries = deliveriesResult.deliveries || [];

    // Get standard tariffs for each quartier from the tariffs table (used by PDF aggregates)
    const standardTariffs = {};
    try {
      const tariffsResult = await getTariffsByAgency(agency.id);
      const tariffs = Array.isArray(tariffsResult)
        ? tariffsResult
        : tariffsResult
          ? [tariffsResult]
          : [];
      tariffs.forEach((tariff) => {
        if (tariff && tariff.quartier && tariff.tarif_amount) {
          standardTariffs[tariff.quartier] =
            parseFloat(tariff.tarif_amount) || 0;
        }
      });
    } catch (error) {
      logger.error({ err: error }, "Reports API: error fetching standard tariffs");
    }

    // Totals and per-quartier breakdown (see reportAggregates.js)
    const {
      totalEncaisse,
      totalTarifs,
      netARever,
      fixedStatusTarifs,
      tarifsParQuartier,
      allLivraisonsDetails,
    } = buildReportPdfData(deliveries, standardTariffs);

    // Generate PDF with better margins
    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
      layout: "portrait",
    });

    // Set better line height defaults
    doc.lineGap(2);

    // ---------------- PDF Debug Harness (temporary) ----------------
    // Helps identify who creates extra pages (manual addPage vs PDFKit auto pageAdded)
    // and why a footer-only page appears.
    const PDF_DEBUG = false;
    let debugPageIndex = 1; // starts at 1
    let isManualAddPage = false;
    let manualAddPageReason = "";
    let lastPageAddKind = null; // 'auto' | 'manual'
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

    // Detect PDFKit's automatic page creations (text/graphics overflow)
    doc.on("pageAdded", () => {
      debugPageIndex += 1;
      const kind = isManualAddPage ? "manual" : "auto";
      const reason = isManualAddPage ? manualAddPageReason : undefined;
      lastPageAddKind = kind;

      if (PDF_DEBUG) console.log("[PDFDBG] pageAdded", { page: debugPageIndex, kind, reason, currentY, docY: doc?.y, hasContentOnPage, footerInProgress });

      // Redessiner un header léger sur chaque nouvelle page
      // (sans gros logo, mais avec infos agence + client + période)
      drawHeader(false);

      // Si la page a été créée automatiquement pendant un footer,
      // on considère que le footer a simplement "poussé" sur une nouvelle page.
      // On synchronise currentY et on marquera la page comme vide pour le contenu suivant.
      if (!isManualAddPage) {
        // auto
        currentY = doc.y || 50;
        hasContentOnPage = false;

        // Si c'était pendant le footer avant le Résumé,
        // on NE doit PAS appeler manuellement addPage("beforeResume") ensuite.
        if (footerInProgress) {
          suppressNextManualAddForResume = true;
        }
      } else {
        // manual addPage: currentY sera repositionné par notre code juste après
      }

      // reset markers after the addPage event
      isManualAddPage = false;
      manualAddPageReason = "";
    });

    const addPage = (reason) => {
      // Si une page auto a déjà été créée juste après le footer du bloc Résumé,
      // ne pas recréer une nouvelle page "manuelle" pour le même bloc.
      if (reason === "beforeResume" && suppressNextManualAddForResume) {
        dbg("addPage() suppressed (auto page already created for Résumé)", { reason });
        suppressNextManualAddForResume = false;
        return;
      }

      const pageBeforeAdd = doc.page?.number;
      isManualAddPage = true;
      manualAddPageReason = reason || "";
      dbg("addPage()", { reason });
      doc.addPage();
    };

    const markContent = (tag) => {
      if (!hasContentOnPage) {
        hasContentOnPage = true;
        dbg("markContent", { tag });
      }
    };

    // Store agency info for footer
    const agencyInfo = {
      email: agency.email,
      phone: agency.phone,
    };

    // Page constants
    const pageWidth = 595; // A4 width in points (210mm = 595pt at 72dpi)
    const pageHeight = 842; // A4 height in points (297mm = 842pt at 72dpi)
    const leftColumnX = 50;
    // A4 height is 842, minus bottom margin (50) = 792 max
    // Use 780 as safe break point to leave some buffer
    const SAFE_PAGE_BREAK = 780; // Safe point to break page (leaving ~60 points buffer)
    const generationDate = new Date().toLocaleString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Draw header (full on first page, light on others)
    const drawHeader = (isFirstPage = false) => {
      const headerY = 40;
      const centerX = pageWidth / 2;
      const rightColumnX = 320;

      // 1) Logo : seulement sur la première page (option A)
      if (isFirstPage && agency.logo_base64) {
        try {
          const base64Data = agency.logo_base64.replace(
            /^data:image\/\w+;base64,/,
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

      // 2) Point de départ sous le logo (ou directement en haut si pas de logo)
      currentY = headerY + (isFirstPage && agency.logo_base64 ? 120 : 0);

      // 3) Colonne gauche : agence
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

      // 4) Colonne droite : client / période / rapport
      let rightY = currentY;
      doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a");
      doc
        .text(`Client N°: `, rightColumnX, rightY)
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .text(`${group.id}`, rightColumnX + 55, rightY);
      rightY += 12;

      const reportNumber = `R${new Date().getFullYear()}${String(
        new Date().getMonth() + 1
      ).padStart(2, "0")}${String(new Date().getDate()).padStart(
        2,
        "0"
      )}${String(group.id).padStart(3, "0")}`;
      doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a");
      doc
        .text(`Rapport N°: `, rightColumnX, rightY)
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .text(reportNumber, rightColumnX + 60, rightY);
      rightY += 12;

      doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a");
      doc
        .text(`Destinataire: `, rightColumnX, rightY)
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .text(group.name, rightColumnX + 70, rightY);
      rightY += 12;

      const periodStart = startDate || new Date().toISOString().split("T")[0];
      const periodEnd = endDate || new Date().toISOString().split("T")[0];
      doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a");
      doc
        .text(`Période: `, rightColumnX, rightY)
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .text(`${periodStart} - ${periodEnd}`, rightColumnX + 50, rightY);

      doc.fillColor("#000000");

      // 5) Position du contenu après le header
      const maxY = Math.max(leftY, rightY);
      currentY = maxY + 25;
    };

    // Draw footer at the bottom of the current page
    const drawFooter = (docInstance) => {
      const pageBeforeFooter = docInstance.page?.number;
      const currentYBeforeFooter = currentY;
      footerInProgress = true;
      dbg("drawFooter()", {
        stackTop: new Error().stack?.split("\n").slice(0, 5).join("\n"),
      });
      const { width, height, margins } = docInstance.page;
      const leftX = margins.left;
      const usableWidth = width - margins.left - margins.right;
      const bottomY = height - margins.bottom; // e.g. 842 - 50 = 792
      const footerLineY = bottomY - 22; // separator line
      const textY = bottomY - 18; // first line of text

      // Separator line
      docInstance
        .moveTo(leftX, footerLineY)
        .lineTo(width - margins.right, footerLineY)
        .lineWidth(0.5)
        .strokeColor("#cccccc")
        .stroke()
        .strokeColor("#000000")
        .lineWidth(1);

      // Footer text
      docInstance.fontSize(8).font("Helvetica").fillColor("#666666");
      docInstance.text(`Rapport généré le: ${generationDate}`, leftX, textY, {
        width: usableWidth,
        align: "left",
        lineBreak: false,
        ellipsis: true,
        continued: false,
      });

      // Page number (right side)
      const pageNumber = docInstance.page?.number;
      if (pageNumber) {
        docInstance.text(`Page ${pageNumber}`, leftX, textY, {
          width: usableWidth,
          align: "right",
          lineBreak: false,
          ellipsis: true,
          continued: false,
        });
      }

      const contactInfo = [];
      if (agencyInfo.email) contactInfo.push(`Email: ${agencyInfo.email}`);
      if (agencyInfo.phone) contactInfo.push(`Téléphone: ${agencyInfo.phone}`);

      if (contactInfo.length > 0) {
        docInstance.text(contactInfo.join(" | "), leftX, textY + 12, {
          width: usableWidth,
          align: "left",
          lineBreak: false,
          ellipsis: true,
          continued: false,
        });
      }

      docInstance.fillColor("#000000");
      const pageAfterFooter = docInstance.page?.number;
      const currentYAfterFooter = currentY;
      footerInProgress = false;
    };

    // Ensure there is enough vertical space for the next block.
    // If not, draw footer for current page (if it has content), add a new page, reset Y,
    // and optionally run a callback.
    let currentY; // will be initialized after header
    let hasContentOnPage = false; // track if we've drawn any content on the current page
    const ensureSpace = (
      neededHeight,
      onNewPage,
      threshold = SAFE_PAGE_BREAK
    ) => {
      dbg("ensureSpace()", { neededHeight, threshold });
      if (currentY + neededHeight > threshold) {
        // Seuil minimum de contenu pour considérer qu'une page mérite un footer
        // Si currentY est trop bas (< 200), la page est considérée comme "quasi-vide"
        const MIN_CONTENT_HEIGHT = 200;

        if (hasContentOnPage && currentY >= MIN_CONTENT_HEIGHT) {
          // Page avec VRAI contenu (au moins 200pt) → on la clôture proprement avec footer
          drawFooter(doc);
          addPage("ensureSpace");
          currentY = 50;
          hasContentOnPage = false;
          if (onNewPage) onNewPage();
        } else {
          // Page vide ou quasi-vide : NE PAS dessiner de footer pour éviter une page "footer seul"
          // On remet juste le curseur en haut et on attend le vrai contenu.
          currentY = 50;
          hasContentOnPage = false; // Reset car on change de page sans footer
          if (onNewPage) onNewPage();
        }
      }
    };

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rapport-${group.name}-${new Date().toISOString().split("T")[0]}.pdf"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Header: Logo + infos pour la première page
    drawHeader(true);

    // Section 1: Détails des livraisons - Aligné à gauche comme l'adresse
    const section1Title = "DÉTAILS DES LIVRAISONS";
    const section1TitleWidth = doc.widthOfString(section1Title, {
      fontSize: 14, // Reduced from 17
      font: "Helvetica-Bold",
    });

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a"); // Reduced from 17
    doc.text(section1Title, leftColumnX, currentY); // Aligné à gauche

    // Subtle underline - aligné à gauche aussi
    doc
      .moveTo(leftColumnX, currentY + 18) // Reduced from 20
      .lineTo(leftColumnX + section1TitleWidth, currentY + 18)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    currentY += 25; // Reduced from 32
    markContent("section1:title");

    // Table header - Updated columns: Quartier, Téléphone, Statut, Montant commande, Montant reçu
    const tableTop = currentY;
    const col1X = leftColumnX; // Quartier
    const col2X = col1X + 110; // Téléphone (reduced from 120)
    const col3X = col2X + 90; // Statut (reduced from 100)
    const col4X = col3X + 75; // Montant commande (reduced from 80)
    const col5X = col4X + 110; // Montant reçu (reduced from 120)
    const tableRight = 545;

    // Table header background
    doc
      .rect(col1X - 5, tableTop - 5, tableRight - col1X + 10, 18) // Reduced height from 22
      .fillColor("#e8e8e8")
      .fill()
      .fillColor("#000000");

    doc.fontSize(8).font("Helvetica-Bold").fillColor("#1a1a1a"); // Reduced from 10
    doc.text("Quartier", col1X + 3, tableTop + 1, {
      width: 105,
      ellipsis: true,
    });
    doc.text("Téléphone", col2X, tableTop + 1, {
      width: 85,
      align: "left",
      ellipsis: true,
    });
    doc.text("Statut", col3X, tableTop + 1, {
      width: 70,
      align: "left",
      ellipsis: true,
    });
    doc.text("Montant cmd FCFA", col4X, tableTop + 1, {
      width: 105,
      align: "right",
    });
    doc.text("Montant reçu FCFA", col5X, tableTop + 1, {
      width: 100,
      align: "right",
    });

    // Draw border around header
    doc
      .rect(col1X - 5, tableTop - 5, tableRight - col1X + 10, 18)
      .lineWidth(1)
      .strokeColor("#333333")
      .stroke()
      .strokeColor("#000000");
    currentY = tableTop + 18; // Reduced from 22
    // NE PAS marquer la page comme ayant du contenu ici
    // Le contenu réel commence avec les lignes de livraisons, pas le header

    // Table rows - Display ALL deliveries
    doc.fontSize(8).font("Helvetica"); // Reduced from 9.5
    let totalHT = 0;
    let totalEncaisseTable = 0; // Total collected amount for the table (delivered and pickup)
    let rowIndex = 0;

    // Map status to French labels (matching status-badge.tsx)
    const statusLabels = {
      pending: "En cours",
      delivered: "Livré",
      failed: "Annulé",
      cancelled: "Annulé",
      postponed: "Renvoyé",
      pickup: "Au bureau",
      expedition: "Expédition",
      client_absent: "Client absent",
      unreachable: "Injoignable",
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
        // Ensure space for the next row (~15pt)
        ensureSpace(15, () => {
          rowIndex = 0;
        });

        // Calculate totals for delivered and pickup deliveries
        if (item.status === "delivered" || item.status === "pickup") {
          totalHT += item.amountDue || 0;
          totalEncaisseTable += item.amountPaid || 0;
        }

        // Alternate row background
        if (rowIndex % 2 === 0) {
          doc
            .rect(col1X - 5, currentY - 2, tableRight - col1X + 10, 15) // Reduced height
            .fillColor("#f8f8f8")
            .fill()
            .fillColor("#000000");
        }

        doc.fillColor("#1a1a1a");
        doc.text(item.quartier || "", col1X + 3, currentY + 1, {
          width: 105,
          ellipsis: true,
        });
        doc.text(item.phone || "", col2X, currentY + 1, {
          width: 85,
          ellipsis: true,
        });
        doc.text(
          statusLabels[item.status] || item.status,
          col3X,
          currentY + 1,
          { width: 70, ellipsis: true }
        );
        doc.text(formatCurrency(item.amountDue), col4X, currentY + 1, {
          width: 105,
          align: "right",
        });
        doc.text(formatCurrency(item.amountPaid), col5X, currentY + 1, {
          width: 100,
          align: "right",
        });
        doc.fillColor("#000000");

        // Draw row border
        doc
          .moveTo(col1X - 5, currentY + 13) // Reduced from 16
          .lineTo(tableRight + 5, currentY + 13)
          .lineWidth(0.5)
          .strokeColor("#e0e0e0")
          .stroke()
          .strokeColor("#000000")
          .lineWidth(1);

        currentY += 15; // Reduced from 18
        markContent("section1:row");
        rowIndex++;
      });

      // Add total encaissé row (only for delivered deliveries)
      ensureSpace(35);

      currentY += 6; // Reduced from 8
      doc
        .moveTo(col1X - 5, currentY)
        .lineTo(tableRight + 5, currentY)
        .lineWidth(2)
        .strokeColor("#666666")
        .stroke()
        .lineWidth(1)
        .strokeColor("#000000");
      currentY += 12; // Reduced from 14

      // Total encaissé row
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a1a1a"); // Reduced from 10.5
      doc.text("Total encaissé:", col1X + 3, currentY + 1, { width: 190 });
      doc.text(formatCurrency(totalEncaisseTable), col5X, currentY + 1, {
        width: 100,
        align: "right",
      });
      doc.fillColor("#000000");
      currentY += 16; // Reduced from 20
    }

    // Section 2: Tarifs par livraison - Prepare combined list
    // First: Fixed-status tariffs (pickup, zone1, zone2) - only include if count > 0
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

    // Second: Quartier-based tariffs (delivered, client_absent)
    const quartierTarifsList = Object.values(tarifsParQuartier);

    // Combine: fixed status first, then quartiers
    const tarifsList = [...fixedStatusList, ...quartierTarifsList];

    // Calculate space needed for tarifs section: 30 (spacing) + 25 (title) + 18 (header) + (rows * 15) + 15 (total row)
    const spaceForTarifsTitle = 30 + 25 + 18; // ~73 points (reduced)
    const spaceForTarifsRows =
      tarifsList.length > 0 ? tarifsList.length * 15 + 15 : 20; // rows + total or message (reduced)
    const totalSpaceForTarifs = spaceForTarifsTitle + spaceForTarifsRows;

    // Check if we need a new page for tarifs section
    ensureSpace(totalSpaceForTarifs);

    currentY += 30; // Reduced from 35

    // Section 2: Tarifs par livraison - Aligné à gauche
    const section2Title = "TARIFS PAR LIVRAISON";
    const section2TitleWidth = doc.widthOfString(section2Title, {
      fontSize: 14, // Reduced from 17
      font: "Helvetica-Bold",
    });

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a"); // Reduced from 17
    doc.text(section2Title, leftColumnX, currentY); // Aligné à gauche

    // Subtle underline - aligné à gauche aussi
    doc
      .moveTo(leftColumnX, currentY + 18) // Reduced from 20
      .lineTo(leftColumnX + section2TitleWidth, currentY + 18)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    currentY += 25; // Reduced from 32
    doc.fillColor("#000000");

    // Table header with styling
    const tarifsTableTop = currentY;

    // Define column positions for tarifs table
    const tarifsCol1X = leftColumnX; // Description
    const tarifsCol2X = tarifsCol1X + 200; // Qté
    const tarifsCol3X = tarifsCol2X + 60; // PU HT
    const tarifsCol4X = tarifsCol3X + 80; // Montant HT

    // Table header background with improved styling
    doc
      .rect(
        tarifsCol1X - 5,
        tarifsTableTop - 5,
        tableRight - tarifsCol1X + 10,
        18 // Reduced from 22
      )
      .fillColor("#e8e8e8")
      .fill()
      .fillColor("#000000");

    doc.fontSize(8).font("Helvetica-Bold").fillColor("#1a1a1a"); // Reduced from 10
    doc.text("Description", tarifsCol1X + 3, tarifsTableTop + 1);
    doc.text("Qté", tarifsCol2X, tarifsTableTop + 1, {
      width: 50,
      align: "right",
    });
    doc.text("PU HT FCFA", tarifsCol3X, tarifsTableTop + 1, {
      width: 80,
      align: "right",
    });
    doc.text("Montant HT FCFA", tarifsCol4X, tarifsTableTop + 1, {
      width: 80,
      align: "right",
    });
    doc.fillColor("#000000");

    // Draw border around header
    doc
      .rect(
        tarifsCol1X - 5,
        tarifsTableTop - 5,
        tableRight - tarifsCol1X + 10,
        18 // Reduced from 22
      )
      .lineWidth(1)
      .strokeColor("#333333")
      .stroke()
      .strokeColor("#000000");
    currentY = tarifsTableTop + 18; // Reduced from 22
    // NE PAS marquer la page comme ayant du contenu ici
    // Le contenu réel commence avec les lignes de tarifs, pas le header

    // Table rows with styling
    doc.fontSize(8).font("Helvetica"); // Reduced from 9.5
    // tarifsList already declared above for space calculation
    let tarifRowIndex = 0;

    if (tarifsList.length === 0) {
      // Message when no tariffs
      doc.fontSize(9).font("Helvetica").fillColor("#666666"); // Reduced from 10
      doc.text(
        "Aucun tarif appliqué pour cette période",
        tarifsCol1X + 3,
        currentY + 5,
        { width: tableRight - tarifsCol1X, align: "center" }
      );
      doc.fillColor("#000000");
      currentY += 20; // Reduced from 25
      markContent("section2:emptyMessage");
    } else {
      tarifsList.forEach((tarif) => {
        // Ensure space for the next tarifs row (~15pt)
        ensureSpace(15, () => {
          tarifRowIndex = 0;
        });

        // Alternate row background
        if (tarifRowIndex % 2 === 0) {
          doc
            .rect(
              tarifsCol1X - 5,
              currentY - 2,
              tableRight - tarifsCol1X + 10,
              15 // Reduced from 18
            )
            .fillColor("#f8f8f8")
            .fill()
            .fillColor("#000000");
        }

        // Use standard tariff if available (from tariffs table), otherwise calculate average
        const unitPrice =
          tarif.standardTariff !== undefined
            ? tarif.standardTariff
            : tarif.total / tarif.count;
        doc.fillColor("#1a1a1a");
        doc.text(tarif.quartier, tarifsCol1X + 3, currentY + 1, { width: 190 });
        doc.text(tarif.count.toString(), tarifsCol2X, currentY + 1, {
          width: 50,
          align: "right",
        });
        doc.text(formatCurrency(unitPrice), tarifsCol3X, currentY + 1, {
          width: 80,
          align: "right",
        });
        doc.text(formatCurrency(tarif.total), tarifsCol4X, currentY + 1, {
          width: 80,
          align: "right",
        });
        doc.fillColor("#000000");

        // Draw row border
        doc
          .moveTo(tarifsCol1X - 5, currentY + 13) // Reduced from 16
          .lineTo(tableRight + 5, currentY + 13)
          .lineWidth(0.5)
          .strokeColor("#e0e0e0")
          .stroke()
          .strokeColor("#000000")
          .lineWidth(1);

        currentY += 15; // Reduced from 18
        markContent("section2:row");
        tarifRowIndex++;
      });

      // Total tarifs - on the same line as the last row, in the "Montant HT FCFA" column
      // Space needed: 14 (line) + 18 (row) = 32 points
      ensureSpace(32);

      // Draw separator line
      doc
        .moveTo(tarifsCol1X - 5, currentY)
        .lineTo(tableRight + 5, currentY)
        .lineWidth(2)
        .strokeColor("#666666")
        .stroke()
        .lineWidth(1)
        .strokeColor("#000000");
      currentY += 12; // Reduced from 14

      // Total row - same style as data rows
      if (tarifRowIndex % 2 === 0) {
        doc
          .rect(
            tarifsCol1X - 5,
            currentY - 2,
            tableRight - tarifsCol1X + 10,
            15 // Reduced from 18
          )
          .fillColor("#f8f8f8")
          .fill()
          .fillColor("#000000");
      }

      doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a1a1a"); // Reduced from 10.5
      doc.text("Total", tarifsCol1X + 3, currentY + 1, { width: 190 });
      // Leave Qté and PU HT empty
      doc.text(formatCurrency(totalTarifs), tarifsCol4X, currentY + 1, {
        width: 80,
        align: "right",
      });
      doc.fillColor("#000000");

      // Draw row border
      doc
        .moveTo(tarifsCol1X - 5, currentY + 13) // Reduced from 16
        .lineTo(tableRight + 5, currentY + 13)
        .lineWidth(0.5)
        .strokeColor("#e0e0e0")
        .stroke()
        .strokeColor("#000000")
        .lineWidth(1);

      currentY += 15; // Reduced from 18
    }

    // Section 3: Résumé - Calculate space needed before adding
    // Space needed: 45 (spacing) + 15 (separator line) + 28 (title + underline) +
    //                (18 * 3 lines: Total encaissé, Total tarifs, Reste à percevoir) = ~142 points
    const spaceForResume = 45 + 15 + 28 + 18 * 3; // ~142 points (reduced after removing "Net à reverser")

    // Manual page break check for Résumé (like we did before)
    // This ensures content is immediately written on the new page if needed
    const MIN_CONTENT_HEIGHT_FOR_FOOTER = 200; // Même seuil que dans ensureSpace
    if (currentY + spaceForResume > SAFE_PAGE_BREAK) {
      if (hasContentOnPage && currentY >= MIN_CONTENT_HEIGHT_FOR_FOOTER) {
        // Page avec VRAI contenu → on la clôture avec footer
        drawFooter(doc);
        addPage("beforeResume");
        currentY = 50;
        hasContentOnPage = false;
      } else {
        // Page vide ou quasi-vide : pas de footer pour éviter une page "footer seul"
        currentY = 50;
        hasContentOnPage = false;
      }
    }

    // Now immediately draw the content
    currentY += 45;

    // Add subtle separator line before Résumé
    doc
      .moveTo(leftColumnX, currentY - 15)
      .lineTo(pageWidth - leftColumnX, currentY - 15)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a"); // Reduced from 17
    doc.text("RÉSUMÉ", leftColumnX, currentY);

    // Set hasContentOnPage AFTER drawing the title
    markContent("section3:title");

    // Subtle underline
    doc
      .moveTo(leftColumnX, currentY + 18) // Reduced from 20
      .lineTo(leftColumnX + 100, currentY + 18)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    currentY += 28; // Reduced from 35

    // Summary items with better visual hierarchy
    doc.fontSize(9).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 11
    doc.text(`Total encaissé: `, leftColumnX, currentY);
    doc
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text(
        `${formatCurrency(totalEncaisse)} FCFA`,
        leftColumnX + 90,
        currentY
      );
    currentY += 18; // Reduced from 22

    doc.fontSize(9).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 11
    doc.text(`Total tarifs (retirés): `, leftColumnX, currentY);
    doc
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text(`${formatCurrency(totalTarifs)} FCFA`, leftColumnX + 120, currentY);
    currentY += 18; // Reduced from 22

    // Reste à percevoir = montant collecté - total tarifs
    const resteAPercevoir = totalEncaisse - totalTarifs;
    doc.fontSize(9).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 11
    doc.text(`Reste à percevoir: `, leftColumnX, currentY);
    doc
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text(
        `${formatCurrency(resteAPercevoir)} FCFA`,
        leftColumnX + 110,
        currentY
      );

    doc.fillColor("#000000");

    // Draw footer on the last page if it has content
    if (hasContentOnPage && currentY >= 200) {
      drawFooter(doc);
    }

    // Finalize PDF
    doc.end();
  } catch (error) {
    logger.error({ err: error }, "Reports API: error generating PDF");
    next(error);
  }
});

module.exports = router;
