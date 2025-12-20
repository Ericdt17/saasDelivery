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
  // Format number and ensure no slashes - use spaces for thousands separator
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(amount);

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

    // Filter only delivered deliveries for calculations
    const deliveredDeliveries = deliveries.filter(
      (d) => d.status === "delivered"
    );

    // Calculate totals and organize data
    let totalEncaisse = 0; // Gross amount (amount_paid + delivery_fee)
    let totalTarifs = 0;
    const tarifsParQuartier = {};
    const livraisonsDetails = [];

    deliveredDeliveries.forEach((delivery) => {
      const deliveryFee = delivery.delivery_fee || 0;
      const amountPaid = delivery.amount_paid || 0;
      const amountPaidBrut = amountPaid + deliveryFee; // Gross amount
      const amountDue = delivery.amount_due || 0;

      totalEncaisse += amountPaidBrut;
      totalTarifs += deliveryFee;

      // Add to deliveries details
      livraisonsDetails.push({
        description: delivery.items || "",
        quantity: 1,
        unitPrice: amountDue,
        total: amountDue,
        quartier: delivery.quartier || "",
        amountPaid: amountPaid, // Amount received
        amountDue: amountDue, // Amount of order
      });

      // Group tariffs by quartier
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
    const leftColumnX = 50;
    const generationDate = new Date().toLocaleString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    
    // Track pages that already have footer to prevent infinite loop
    const pagesWithFooter = new Set();
    
    const addFooterToPage = () => {
      // Prevent infinite loop - check if footer already added to this page
      const currentPage = doc.bufferedPageRange().count || 1;
      if (pagesWithFooter.has(currentPage)) {
        return; // Footer already added to this page
      }
      
      // Mark this page as having footer
      pagesWithFooter.add(currentPage);
      
      const footerY = 800; // Bottom of page (A4 height is ~842pt, minus margin)
      
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
      addFooterToPage();
    });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rapport-${group.name}-${new Date().toISOString().split("T")[0]}.pdf"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Header: Logo + Agency info on left, Report info on right
    const headerY = 45;
    const rightColumnX = 380;

    // Left column: Logo and Agency info
    if (agency.logo_base64) {
      try {
        // Extract base64 data (remove data:image/...;base64, prefix if present)
        const base64Data = agency.logo_base64.replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        const logoBuffer = Buffer.from(base64Data, "base64");
        doc.image(logoBuffer, leftColumnX, headerY, {
          width: 120,
          height: 120,
          fit: [120, 120],
        });
      } catch (error) {
        console.error("[PDF] Error loading logo:", error);
        // If logo fails, just continue without it
      }
    }

    let currentY = headerY + (agency.logo_base64 ? 135 : 0);

    // Agency name with better spacing
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .fillColor("#1a1a1a")
      .text(agency.name || "Agence", leftColumnX, currentY);
    currentY += 22;

    if (agency.address) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#4a4a4a")
        .text(agency.address, leftColumnX, currentY);
      currentY += 16;
    }

    if (agency.phone) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#4a4a4a")
        .text(`Téléphone: ${agency.phone}`, leftColumnX, currentY);
      currentY += 18;
    }

    if (agency.email) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#4a4a4a")
        .text(`Email: ${agency.email}`, leftColumnX, currentY);
      currentY += 18;
    }

    // Reset to black for rest of document
    doc.fillColor("#000000");

    // Right column: Group info with better styling
    const rightColumnStartY = headerY + 8;
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#4a4a4a")
      .text(`Client N°: `, rightColumnX, rightColumnStartY)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text(`${group.id}`, rightColumnX + 50, rightColumnStartY);
    let rightY = rightColumnStartY + 17;

    const reportNumber = `R${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}${String(group.id).padStart(3, "0")}`;
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#4a4a4a")
      .text(`Rapport N°: `, rightColumnX, rightY)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text(reportNumber, rightColumnX + 60, rightY);
    rightY += 17;

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#4a4a4a")
      .text(`Destinataire: `, rightColumnX, rightY)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text(group.name, rightColumnX + 65, rightY);
    rightY += 17;

    const periodStart = startDate || new Date().toISOString().split("T")[0];
    const periodEnd = endDate || new Date().toISOString().split("T")[0];
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#4a4a4a")
      .text(`Période: `, rightColumnX, rightY)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text(`${periodStart} - ${periodEnd}`, rightColumnX + 50, rightY);
    rightY += 17;

    if (agency.email) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#4a4a4a")
        .text(`Email: `, rightColumnX, rightY)
        .fillColor("#000000")
        .font("Helvetica")
        .text(agency.email, rightColumnX + 40, rightY);
    }

    // Reset fill color
    doc.fillColor("#000000");

    // Start section 1 directly after header info (removed Compte Rendu title)
    const maxY = Math.max(currentY, rightY);
    currentY = maxY + 40;

    // Section 1: Détails des livraisons (centered, homogeneous with other titles)
    const section1Title = "DÉTAILS DES LIVRAISONS";
    const section1TitleWidth = doc.widthOfString(section1Title, {
      fontSize: 17,
      font: "Helvetica-Bold",
    });
    const section1TitleX = (pageWidth - section1TitleWidth) / 2;

    // Add subtle underline for section title
    doc
      .fontSize(17)
      .font("Helvetica-Bold")
      .fillColor("#1a1a1a")
      .text(section1Title, section1TitleX, currentY);

    // Subtle underline
    doc
      .moveTo(section1TitleX - 5, currentY + 20)
      .lineTo(section1TitleX + section1TitleWidth + 5, currentY + 20)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    currentY += 32;
    doc.fillColor("#000000");

    // Table header with styling - Quartier, Montant commande, Montant reçu
    const tableTop = currentY;
    const col1X = leftColumnX; // Quartier
    const col2X = col1X + 200; // Montant commande (amount_due)
    const col3X = col2X + 150; // Montant reçu (amount_paid)
    const tableRight = 545;

    // Table header background with better styling
    doc
      .rect(col1X - 5, tableTop - 5, tableRight - col1X + 10, 22)
      .fillColor("#e8e8e8")
      .fill()
      .fillColor("#000000"); // Reset to black

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#1a1a1a");
    doc.text("Quartier", col1X + 3, tableTop + 1);
    doc.text("Montant commande FCFA", col2X, tableTop + 1, {
      width: 140,
      align: "right",
    });
    doc.text("Montant reçu FCFA", col3X, tableTop + 1, {
      width: 130,
      align: "right",
    });
    doc.fillColor("#000000");

    // Draw border around header with better contrast
    doc
      .rect(col1X - 5, tableTop - 5, tableRight - col1X + 10, 22)
      .lineWidth(1)
      .strokeColor("#333333")
      .stroke()
      .strokeColor("#000000");
    currentY = tableTop + 22;

    // Table rows with styling - Group by quartier
    doc.fontSize(9.5).font("Helvetica");
    let totalHT = 0;
    let rowIndex = 0;

    // Group deliveries by quartier and calculate totals per quartier
    const quartierGroups = {};
    livraisonsDetails.forEach((item) => {
      totalHT += item.amountDue; // Use amount_due for total
      const quartier = item.quartier || "Non spécifié";
      if (!quartierGroups[quartier]) {
        quartierGroups[quartier] = {
          quartier: quartier,
          totalAmountDue: 0, // Total amount of orders
          totalAmountPaid: 0, // Total amount received
        };
      }
      quartierGroups[quartier].totalAmountDue += item.amountDue || 0;
      quartierGroups[quartier].totalAmountPaid += item.amountPaid || 0;
    });

    // Display quartiers with their data or message if empty
    const quartierGroupsList = Object.values(quartierGroups).sort((a, b) => a.quartier.localeCompare(b.quartier));
    
    if (quartierGroupsList.length === 0) {
      // Message when no deliveries
      doc.fontSize(10).font("Helvetica").fillColor("#666666");
      doc.text(
        "Aucune livraison livrée pour cette période",
        col1X + 3,
        currentY + 5,
        { width: tableRight - col1X, align: "center" }
      );
      doc.fillColor("#000000");
      currentY += 25;
    } else {
      quartierGroupsList.forEach((group) => {
        if (currentY > 700) {
          // New page if needed
          doc.addPage();
          currentY = 50;
          rowIndex = 0;
        }

        // Alternate row background with better color
        if (rowIndex % 2 === 0) {
          doc
            .rect(col1X - 5, currentY - 2, tableRight - col1X + 10, 18)
            .fillColor("#f8f8f8")
            .fill()
            .fillColor("#000000");
        }

        doc.fillColor("#1a1a1a");
        doc.text(group.quartier || "", col1X + 3, currentY + 1, {
          width: 190,
          ellipsis: true,
        });
        doc.text(formatCurrency(group.totalAmountDue), col2X, currentY + 1, {
          width: 140,
          align: "right",
        });
        doc.text(formatCurrency(group.totalAmountPaid), col3X, currentY + 1, {
          width: 130,
          align: "right",
        });
        doc.fillColor("#000000");

        // Draw row border with subtle color
        doc
          .moveTo(col1X - 5, currentY + 16)
          .lineTo(tableRight + 5, currentY + 16)
          .lineWidth(0.5)
          .strokeColor("#e0e0e0")
          .stroke()
          .strokeColor("#000000")
          .lineWidth(1);

        currentY += 18;
        rowIndex++;
      });
    }

    // Total section - box aligned to the right of the table
    currentY += 8;
    doc
      .moveTo(col1X - 5, currentY)
      .lineTo(tableRight + 5, currentY)
      .lineWidth(2)
      .strokeColor("#666666")
      .stroke()
      .lineWidth(1)
      .strokeColor("#000000");
    currentY += 14;

    // Background for totals box - aligned to the right of the table
    const totalsBoxWidth = 200;
    const totalsBoxX = tableRight - totalsBoxWidth;
    const totalsBoxHeight = 40; // Reduced height (removed TVA line)
    doc
      .rect(totalsBoxX, currentY - 4, totalsBoxWidth, totalsBoxHeight)
      .fillColor("#f0f0f0")
      .fill()
      .fillColor("#000000");

    doc.fontSize(10.5).font("Helvetica-Bold").fillColor("#1a1a1a");
    const totalHTText = `Total HT FCFA: ${formatCurrency(totalHT)}`;
    doc.text(
      totalHTText,
      totalsBoxX + 5,
      currentY + 2,
      { width: totalsBoxWidth - 10, align: "right" }
    );
    currentY += 17;

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000");
    const ttcText = `TTC A PAYER: ${formatCurrency(totalHT)}`;
    doc.text(
      ttcText,
      totalsBoxX + 5,
      currentY + 2,
      { width: totalsBoxWidth - 10, align: "right" }
    );

    // Draw border around totals with better styling
    doc
      .rect(totalsBoxX, currentY - 19, totalsBoxWidth, totalsBoxHeight)
      .lineWidth(1.5)
      .strokeColor("#333333")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);
    currentY += 8;
    doc.fillColor("#000000");

    // Section 2: Tarifs par quartier (centered) - improved spacing
    currentY += 35;
    if (currentY > 650) {
      doc.addPage();
      currentY = 50;
    }

    const section2Title = "TARIFS PAR LIVRAISON";
    const section2TitleWidth = doc.widthOfString(section2Title, {
      fontSize: 17,
      font: "Helvetica-Bold",
    });
    const section2TitleX = (pageWidth - section2TitleWidth) / 2;

    doc
      .fontSize(17)
      .font("Helvetica-Bold")
      .fillColor("#1a1a1a")
      .text(section2Title, section2TitleX, currentY);

    // Subtle underline
    doc
      .moveTo(section2TitleX - 5, currentY + 20)
      .lineTo(section2TitleX + section2TitleWidth + 5, currentY + 20)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    currentY += 32;
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
        22
      )
      .fillColor("#e8e8e8")
      .fill()
      .fillColor("#000000");

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#1a1a1a");
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

    // Draw border around header with better contrast
    doc
      .rect(
        tarifsCol1X - 5,
        tarifsTableTop - 5,
        tableRight - tarifsCol1X + 10,
        22
      )
      .lineWidth(1)
      .strokeColor("#333333")
      .stroke()
      .strokeColor("#000000");
    currentY = tarifsTableTop + 22;

    // Table rows with styling - improved readability
    doc.fontSize(9.5).font("Helvetica");
    const tarifsList = Object.values(tarifsParQuartier);
    let tarifRowIndex = 0;
    
    if (tarifsList.length === 0) {
      // Message when no tariffs
      doc.fontSize(10).font("Helvetica").fillColor("#666666");
      doc.text(
        "Aucun tarif appliqué pour cette période",
        tarifsCol1X + 3,
        currentY + 5,
        { width: tableRight - tarifsCol1X, align: "center" }
      );
      doc.fillColor("#000000");
      currentY += 25;
    } else {
      tarifsList.forEach((tarif) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
          tarifRowIndex = 0;
        }

        // Alternate row background with better color
        if (tarifRowIndex % 2 === 0) {
          doc
            .rect(
              tarifsCol1X - 5,
              currentY - 2,
              tableRight - tarifsCol1X + 10,
              18
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

        // Draw row border with subtle color
        doc
          .moveTo(tarifsCol1X - 5, currentY + 16)
          .lineTo(tableRight + 5, currentY + 16)
          .lineWidth(0.5)
          .strokeColor("#e0e0e0")
          .stroke()
          .strokeColor("#000000")
          .lineWidth(1);

        currentY += 18;
        tarifRowIndex++;
      });
    }

    // Total tarifs - box aligned to the right of the table
    if (tarifsList.length > 0) {
      currentY += 8;
      doc
        .moveTo(tarifsCol1X - 5, currentY)
        .lineTo(tableRight + 5, currentY)
        .lineWidth(2)
        .strokeColor("#666666")
        .stroke()
        .lineWidth(1)
        .strokeColor("#000000");
      currentY += 14;

      // Background for total - aligned to the right of the table
      const tarifsTotalBoxWidth = 180;
      const tarifsTotalBoxX = tableRight - tarifsTotalBoxWidth;
      const tarifsTotalBoxHeight = 24;
      doc
        .rect(tarifsTotalBoxX, currentY - 4, tarifsTotalBoxWidth, tarifsTotalBoxHeight)
        .fillColor("#f0f0f0")
        .fill()
        .fillColor("#000000");

      doc.fontSize(10.5).font("Helvetica-Bold").fillColor("#1a1a1a");
      const tarifsTotalText = `Total: ${formatCurrency(totalTarifs)}`;
      doc.text(
        tarifsTotalText,
        tarifsTotalBoxX + 5,
        currentY + 2,
        { width: tarifsTotalBoxWidth - 10, align: "right" }
      );
      doc.fillColor("#000000");

      // Draw border around total with better styling
      doc
        .rect(tarifsTotalBoxX, currentY - 4, tarifsTotalBoxWidth, tarifsTotalBoxHeight)
        .lineWidth(1.5)
        .strokeColor("#333333")
        .stroke()
        .strokeColor("#000000")
        .lineWidth(1);
      currentY += 8;
    }

    // Section 3: Résumé - improved styling and spacing
    currentY += 45;
    if (currentY > 600) {
      doc.addPage();
      currentY = 50;
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

    doc
      .fontSize(17)
      .font("Helvetica-Bold")
      .fillColor("#1a1a1a")
      .text("RÉSUMÉ", leftColumnX, currentY);

    // Subtle underline
    doc
      .moveTo(leftColumnX, currentY + 20)
      .lineTo(leftColumnX + 100, currentY + 20)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    currentY += 35;

    // Summary items with better visual hierarchy
    doc.fontSize(11).font("Helvetica").fillColor("#4a4a4a");
    doc.text(`Total encaissé: `, leftColumnX, currentY);
    doc
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text(
        `${formatCurrency(totalEncaisse)} FCFA`,
        leftColumnX + 90,
        currentY
      );
    currentY += 22;

    doc.fontSize(11).font("Helvetica").fillColor("#4a4a4a");
    doc.text(`Total tarifs (retirés): `, leftColumnX, currentY);
    doc
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text(`${formatCurrency(totalTarifs)} FCFA`, leftColumnX + 120, currentY);
    currentY += 28;

    // Highlight final amount with background box
    const summaryBoxWidth = 400;
    const summaryBoxX = leftColumnX;
    doc
      .rect(summaryBoxX, currentY - 4, summaryBoxWidth, 24)
      .fillColor("#f0f0f0")
      .fill()
      .fillColor("#000000");

    doc.fontSize(13).font("Helvetica-Bold").fillColor("#000000");
    doc.text(`Net à reverser au groupe: `, leftColumnX + 5, currentY + 2);
    doc
      .fontSize(13)
      .text(
        `${formatCurrency(netARever)} FCFA`,
        leftColumnX + 155,
        currentY + 2
      );

    // Border around final amount
    doc
      .rect(summaryBoxX, currentY - 4, summaryBoxWidth, 24)
      .lineWidth(1.5)
      .strokeColor("#333333")
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);

    doc.fillColor("#000000");

    // Add footer to first page (pageAdded event handles subsequent pages)
    addFooterToPage();

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("[Reports API] Error generating PDF:", error);
    next(error);
  }
});

module.exports = router;
