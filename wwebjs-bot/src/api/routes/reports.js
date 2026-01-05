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
  adapter,
} = require("../../db");

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

    // Filter deliveries that have tariffs applied (delivered and client_absent)
    const deliveriesWithTariffs = deliveries.filter(
      (d) => d.status === "delivered" || d.status === "client_absent"
    );

    // Filter only delivered deliveries for amount calculations
    const deliveredDeliveries = deliveries.filter(
      (d) => d.status === "delivered"
    );

    // Calculate totals
    // IMPORTANT: 
    // - totalEncaisse = sum(amount_paid + delivery_fee) for "delivered" deliveries only
    // - totalTarifs = sum(delivery_fee) for BOTH "delivered" AND "client_absent" deliveries
    // - netARever = totalEncaisse - totalTarifs
    // This means client_absent deliveries contribute to tariffs but not to collected amount
    let totalEncaisse = 0; // Gross amount (amount_paid + delivery_fee) for delivered only
    let totalTarifs = 0; // Sum of delivery_fee for delivered + client_absent
    const tarifsParQuartier = {};

    // Calculate totalEncaisse only for delivered deliveries
    deliveredDeliveries.forEach((delivery) => {
      // Convert to numbers explicitly to handle PostgreSQL DECIMAL types
      const deliveryFee = parseFloat(delivery.delivery_fee) || 0;
      const amountPaid = parseFloat(delivery.amount_paid) || 0;
      const amountPaidBrut = amountPaid + deliveryFee; // Gross amount

      totalEncaisse += amountPaidBrut;
    });

    // Calculate totalTarifs for BOTH delivered and client_absent deliveries
    deliveriesWithTariffs.forEach((delivery) => {
      // Convert to numbers explicitly to handle PostgreSQL DECIMAL types
      const deliveryFee = parseFloat(delivery.delivery_fee) || 0;
      
      totalTarifs += deliveryFee;

      // Group tariffs by quartier (for both delivered and client_absent)
      if (delivery.quartier && deliveryFee > 0) {
        if (!tarifsParQuartier[delivery.quartier]) {
          tarifsParQuartier[delivery.quartier] = {
            quartier: delivery.quartier,
            count: 0,
            total: 0,
          };
        }
        tarifsParQuartier[delivery.quartier].count += 1;
        tarifsParQuartier[delivery.quartier].total += deliveryFee;
      }
    });

    const netARever = totalEncaisse - totalTarifs;

    // Prepare ALL deliveries for display (not just delivered)
    const allLivraisonsDetails = deliveries.map((delivery) => {
      const amountDue = parseFloat(delivery.amount_due) || 0;
      const deliveryFee = parseFloat(delivery.delivery_fee) || 0;
      const amountPaid = parseFloat(delivery.amount_paid) || 0;
      // For delivered: amount_paid + delivery_fee (montant collecté)
      // For client_absent: delivery_fee (tarif appliqué même si amount_paid = 0)
      // For others: amount_paid
      let amountPaidBrut;
      if (delivery.status === "delivered") {
        amountPaidBrut = amountPaid + deliveryFee; // Montant collecté
      } else if (delivery.status === "client_absent") {
        amountPaidBrut = deliveryFee; // Afficher le tarif appliqué
      } else {
        amountPaidBrut = amountPaid;
      }

      return {
        quartier: delivery.quartier || "",
        phone: delivery.phone || "",
        status: delivery.status || "pending",
        amountDue: amountDue,
        amountPaid: amountPaidBrut,
      };
    });

    // Generate PDF with better margins
    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
      layout: "portrait",
    });

    // Set better line height defaults
    doc.lineGap(2);

    // Store agency info for footer
    const agencyInfo = {
      email: agency.email,
      phone: agency.phone,
    };

    // Helper function to add footer to current page
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
    
    // Track pages that already have footer to prevent infinite loop
    const pagesWithFooter = new Set();
    let isDocumentEnding = false; // Flag to prevent adding pages after content is done
    
    const addFooterToPage = () => {
      // Don't add footer if document is ending (prevents creating empty pages)
      if (isDocumentEnding) {
        return;
      }
      
      // Prevent infinite loop - check if footer already added to this page
      const currentPage = doc.bufferedPageRange().count || 1;
      if (pagesWithFooter.has(currentPage)) {
        return; // Footer already added to this page
      }
      
      // Mark this page as having footer
      pagesWithFooter.add(currentPage);
      
      // Position footer near bottom but ensure it fits on the page
      // A4 height is 842pt, minus bottom margin (50) = 792pt max
      // Place footer at 800pt which is safe (within page bounds)
      const footerY = Math.min(800, pageHeight - 50); // Ensure footer fits on page
      
      // Draw separator line
      doc
        .moveTo(leftColumnX, footerY)
        .lineTo(pageWidth - leftColumnX, footerY)
        .lineWidth(0.5)
        .strokeColor("#cccccc")
        .stroke()
        .strokeColor("#000000")
        .lineWidth(1);
      
      const footerYStart = footerY + 8;
      
      doc.fontSize(8).font("Helvetica").fillColor("#666666");
      doc.text(`Rapport généré le: ${generationDate}`, leftColumnX, footerYStart);
      
      // Agency contact info
      const contactInfo = [];
      if (agencyInfo.email) contactInfo.push(`Email: ${agencyInfo.email}`);
      if (agencyInfo.phone) contactInfo.push(`Téléphone: ${agencyInfo.phone}`);
      if (contactInfo.length > 0) {
        doc.text(contactInfo.join(" | "), leftColumnX, footerYStart + 12);
      }
      
      doc.fillColor("#000000");
    };
    
    // Add footer to each new page automatically
    doc.on("pageAdded", () => {
      // Only add footer if document is not ending
      if (!isDocumentEnding) {
        addFooterToPage();
      }
    });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rapport-${group.name}-${new Date().toISOString().split("T")[0]}.pdf"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Header: Logo centered, Agency and Client info side by side
    const headerY = 40; // Reduced from 45
    const centerX = pageWidth / 2;
    const rightColumnX = 320; // Adjusted for side-by-side layout

    // Centered Logo - Augmenter la taille
    if (agency.logo_base64) {
      try {
        const base64Data = agency.logo_base64.replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        const logoBuffer = Buffer.from(base64Data, "base64");
        const logoWidth = 120; // Augmenté de 80 à 120
        const logoHeight = 120; // Augmenté de 80 à 120
        doc.image(logoBuffer, centerX - logoWidth / 2, headerY, {
          width: logoWidth,
          height: logoHeight,
          fit: [logoWidth, logoHeight],
        });
      } catch (error) {
        console.error("[PDF] Error loading logo:", error);
      }
    }

    // Start info below logo
    let currentY = headerY + (agency.logo_base64 ? 120 : 0); // Ajusté pour le logo plus grand

    // Left column: Agency info (reduced font sizes)
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#1a1a1a"); // Reduced from 16
    doc.text(agency.name || "Agence", leftColumnX, currentY);
    let leftY = currentY + 16; // Reduced from 22

    if (agency.address) {
      doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 10
      doc.text(agency.address, leftColumnX, leftY);
      leftY += 12; // Reduced from 16
    }

    if (agency.phone) {
      doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 10
      doc.text(`Tél: ${agency.phone}`, leftColumnX, leftY);
      leftY += 12; // Reduced from 18
    }

    if (agency.email) {
      doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 10
      doc.text(agency.email, leftColumnX, leftY);
      leftY += 12; // Reduced from 18
    }

    // Right column: Client/Group info (same Y position as agency info)
    let rightY = currentY;
    doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 10
    doc.text(`Client N°: `, rightColumnX, rightY)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text(`${group.id}`, rightColumnX + 55, rightY);
    rightY += 12; // Reduced from 17

    const reportNumber = `R${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}${String(group.id).padStart(3, "0")}`;
    doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 10
    doc.text(`Rapport N°: `, rightColumnX, rightY)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text(reportNumber, rightColumnX + 60, rightY);
    rightY += 12; // Reduced from 17

    doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 10
    doc.text(`Destinataire: `, rightColumnX, rightY)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text(group.name, rightColumnX + 70, rightY);
    rightY += 12; // Reduced from 17

    const periodStart = startDate || new Date().toISOString().split("T")[0];
    const periodEnd = endDate || new Date().toISOString().split("T")[0];
    doc.fontSize(8).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 10
    doc.text(`Période: `, rightColumnX, rightY)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text(`${periodStart} - ${periodEnd}`, rightColumnX + 50, rightY);

    doc.fillColor("#000000");

    // Start section 1 after header info
    const maxY = Math.max(leftY, rightY);
    currentY = maxY + 25; // Reduced from 40

    // Section 1: Détails des livraisons - Aligné à gauche comme l'adresse
    const section1Title = "DÉTAILS DES LIVRAISONS";
    const section1TitleWidth = doc.widthOfString(section1Title, {
      fontSize: 14, // Reduced from 17
      font: "Helvetica-Bold",
    });

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a"); // Reduced from 17
    doc.text(section1Title, leftColumnX, currentY); // Aligné à gauche

    // Subtle underline - aligné à gauche aussi
    doc.moveTo(leftColumnX, currentY + 18) // Reduced from 20
      .lineTo(leftColumnX + section1TitleWidth, currentY + 18)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    currentY += 25; // Reduced from 32

    // Table header - Updated columns: Quartier, Téléphone, Statut, Montant commande, Montant reçu
    const tableTop = currentY;
    const col1X = leftColumnX; // Quartier
    const col2X = col1X + 110; // Téléphone (reduced from 120)
    const col3X = col2X + 90; // Statut (reduced from 100)
    const col4X = col3X + 75; // Montant commande (reduced from 80)
    const col5X = col4X + 110; // Montant reçu (reduced from 120)
    const tableRight = 545;

    // Table header background
    doc.rect(col1X - 5, tableTop - 5, tableRight - col1X + 10, 18) // Reduced height from 22
      .fillColor("#e8e8e8")
      .fill()
      .fillColor("#000000");

    doc.fontSize(8).font("Helvetica-Bold").fillColor("#1a1a1a"); // Reduced from 10
    doc.text("Quartier", col1X + 3, tableTop + 1, { width: 105, ellipsis: true });
    doc.text("Téléphone", col2X, tableTop + 1, { width: 85, align: "left", ellipsis: true });
    doc.text("Statut", col3X, tableTop + 1, { width: 70, align: "left", ellipsis: true });
    doc.text("Montant cmd FCFA", col4X, tableTop + 1, { width: 105, align: "right" });
    doc.text("Montant reçu FCFA", col5X, tableTop + 1, { width: 100, align: "right" });

    // Draw border around header
    doc.rect(col1X - 5, tableTop - 5, tableRight - col1X + 10, 18)
      .lineWidth(1)
      .strokeColor("#333333")
      .stroke()
      .strokeColor("#000000");
    currentY = tableTop + 18; // Reduced from 22

    // Table rows - Display ALL deliveries
    doc.fontSize(8).font("Helvetica"); // Reduced from 9.5
    let totalHT = 0;
    let totalEncaisseTable = 0; // Total collected amount for the table (only delivered)
    let rowIndex = 0;

    // Map status to French labels
    const statusLabels = {
      pending: "En cours",
      delivered: "Livré",
      failed: "Échec",
      client_absent: "Client absent",
      unreachable: "Injoignable",
      no_answer: "Ne décroche pas"
    };

    if (allLivraisonsDetails.length === 0) {
      doc.fontSize(9).font("Helvetica").fillColor("#666666");
      doc.text(
        "Aucune livraison pour cette période",
        col1X + 3,
        currentY + 5,
        { width: tableRight - col1X, align: "center" }
      );
      doc.fillColor("#000000");
      currentY += 20;
    } else {
      allLivraisonsDetails.forEach((item) => {
        if (currentY + 15 > SAFE_PAGE_BREAK) { // Reduced row height check
          doc.addPage();
          currentY = 50;
          rowIndex = 0;
        }

        // Calculate totals only for delivered deliveries
        if (item.status === "delivered") {
          totalHT += item.amountDue || 0;
          totalEncaisseTable += item.amountPaid || 0;
        }

        // Alternate row background
        if (rowIndex % 2 === 0) {
          doc.rect(col1X - 5, currentY - 2, tableRight - col1X + 10, 15) // Reduced height
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

        // Draw row border
        doc.moveTo(col1X - 5, currentY + 13) // Reduced from 16
          .lineTo(tableRight + 5, currentY + 13)
          .lineWidth(0.5)
          .strokeColor("#e0e0e0")
          .stroke()
          .strokeColor("#000000")
          .lineWidth(1);

        currentY += 15; // Reduced from 18
        rowIndex++;
      });

      // Add total encaissé row (only for delivered deliveries)
      if (currentY + 35 > SAFE_PAGE_BREAK) {
        doc.addPage();
        currentY = 50;
      }
      
      currentY += 6; // Reduced from 8
      doc.moveTo(col1X - 5, currentY)
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
      doc.text(formatCurrency(totalEncaisseTable), col5X, currentY + 1, { width: 100, align: "right" });
      doc.fillColor("#000000");
      currentY += 16; // Reduced from 20
    }

    // Section 2: Tarifs par quartier (centered) - improved spacing
    // Calculate space needed for tarifs section: 30 (spacing) + 25 (title) + 18 (header) + (rows * 15) + 15 (total row)
    const tarifsList = Object.values(tarifsParQuartier);
    const spaceForTarifsTitle = 30 + 25 + 18; // ~73 points (reduced)
    const spaceForTarifsRows = tarifsList.length > 0 ? (tarifsList.length * 15) + 15 : 20; // rows + total or message (reduced)
    const totalSpaceForTarifs = spaceForTarifsTitle + spaceForTarifsRows;
    
    // Check if we need a new page for tarifs section
    if (currentY + totalSpaceForTarifs > SAFE_PAGE_BREAK) {
      doc.addPage();
      currentY = 50;
    }
    
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
    doc.moveTo(leftColumnX, currentY + 18) // Reduced from 20
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
    doc.rect(
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
    doc.rect(
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
    } else {
      tarifsList.forEach((tarif) => {
        // Check if we need a new page (with buffer for row height ~15 points)
        if (currentY + 15 > SAFE_PAGE_BREAK) {
          doc.addPage();
          currentY = 50;
          tarifRowIndex = 0;
        }

        // Alternate row background
        if (tarifRowIndex % 2 === 0) {
          doc.rect(
              tarifsCol1X - 5,
              currentY - 2,
              tableRight - tarifsCol1X + 10,
              15 // Reduced from 18
            )
            .fillColor("#f8f8f8")
            .fill()
            .fillColor("#000000");
        }

        const unitPrice = tarif.total / tarif.count;
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
        doc.moveTo(tarifsCol1X - 5, currentY + 13) // Reduced from 16
          .lineTo(tableRight + 5, currentY + 13)
          .lineWidth(0.5)
          .strokeColor("#e0e0e0")
          .stroke()
          .strokeColor("#000000")
          .lineWidth(1);

        currentY += 15; // Reduced from 18
        tarifRowIndex++;
      });

      // Total tarifs - on the same line as the last row, in the "Montant HT FCFA" column
      // Space needed: 14 (line) + 18 (row) = 32 points
      if (currentY + 32 > SAFE_PAGE_BREAK) {
        doc.addPage();
        currentY = 50;
      }

      // Draw separator line
      doc.moveTo(tarifsCol1X - 5, currentY)
        .lineTo(tableRight + 5, currentY)
        .lineWidth(2)
        .strokeColor("#666666")
        .stroke()
        .lineWidth(1)
        .strokeColor("#000000");
      currentY += 12; // Reduced from 14

      // Total row - same style as data rows
      if (tarifRowIndex % 2 === 0) {
        doc.rect(
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
      doc.moveTo(tarifsCol1X - 5, currentY + 13) // Reduced from 16
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
    const spaceForResume = 45 + 15 + 28 + (18 * 3); // ~142 points (reduced after removing "Net à reverser")
    
    // Check if we have enough space on current page
    // A4 page height is 842, minus top margin (50) = 792 max before bottom margin
    // Use a more lenient threshold to maximize space usage
    const RESUME_PAGE_BREAK = 800; // Allow more space before breaking
    
    if (currentY + spaceForResume > RESUME_PAGE_BREAK) {
      // Not enough space, create new page
      doc.addPage();
      currentY = 50;
    } else {
      // Enough space, just add spacing
      currentY += 45;
    }

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

    // Subtle underline
    doc.moveTo(leftColumnX, currentY + 18) // Reduced from 20
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
    doc.font("Helvetica-Bold")
      .fillColor("#000000")
      .text(
        `${formatCurrency(totalEncaisse)} FCFA`,
        leftColumnX + 90,
        currentY
      );
    currentY += 18; // Reduced from 22

    doc.fontSize(9).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 11
    doc.text(`Total tarifs (retirés): `, leftColumnX, currentY);
    doc.font("Helvetica-Bold")
      .fillColor("#000000")
      .text(`${formatCurrency(totalTarifs)} FCFA`, leftColumnX + 120, currentY);
    currentY += 18; // Reduced from 22

    // Reste à percevoir = montant collecté - total tarifs
    const resteAPercevoir = totalEncaisse - totalTarifs;
    doc.fontSize(9).font("Helvetica").fillColor("#4a4a4a"); // Reduced from 11
    doc.text(`Reste à percevoir: `, leftColumnX, currentY);
    doc.font("Helvetica-Bold")
      .fillColor("#000000")
      .text(`${formatCurrency(resteAPercevoir)} FCFA`, leftColumnX + 110, currentY);

    doc.fillColor("#000000");

    // Mark that document is ending to prevent creating empty pages
    isDocumentEnding = true;

    // Add footer to first page and current page (pageAdded event handles subsequent pages)
    addFooterToPage();

    // Finalize PDF - this should not create additional pages
    doc.end();
  } catch (error) {
    console.error("[Reports API] Error generating PDF:", error);
    next(error);
  }
});

module.exports = router;
