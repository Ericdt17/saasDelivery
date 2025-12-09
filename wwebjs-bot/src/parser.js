// Parser functions to extract delivery information from messages

/**
 * Extract phone number from text
 * Looks for patterns like: 6xx, 6xxxxx, +237, etc.
 */
function extractPhone(text) {
  // First, try to find phone after keywords like "Livraison:", "Numéro:", etc.
  const keywordPatterns = [
    /livraison[:\s]+([6x\d]+)/i,
    /num[ée]ro[:\s]+([6x\d]+)/i,
    /phone[:\s]+([6x\d]+)/i,
    /t[ée]l[ée]phone[:\s]+([6x\d]+)/i,
  ];

  for (const pattern of keywordPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const phone = match[1].replace(/[^\d]/g, "");
      if (phone.startsWith("6") && phone.length >= 7) {
        return phone.padEnd(9, "0"); // Pad to 9 digits if needed
      }
    }
  }

  // Remove all spaces and common separators
  const cleaned = text.replace(/[\s\-\.]/g, "");

  // Pattern 1: 6 followed by 8 digits (Cameroon mobile: 6xxxxxxxx)
  const pattern1 = /6\d{8}/;
  const match1 = cleaned.match(pattern1);
  if (match1) {
    return match1[0];
  }

  // Pattern 2: 6xx followed by digits (handles 6xx345678 format)
  const pattern2 = /6[x\d]{7,8}/;
  const match2 = cleaned.match(pattern2);
  if (match2) {
    // Replace x with 0 for matching, but keep original format
    return match2[0].replace(/x/gi, "0");
  }

  // Pattern 3: +237 followed by 9 digits
  const pattern3 = /\+237\d{9}/;
  const match3 = cleaned.match(pattern3);
  if (match3) {
    return match3[0].replace("+237", "6");
  }

  // Pattern 4: Just numbers (6xxxxxxxx format)
  const numbers = cleaned.match(/\d+/g);
  if (numbers) {
    for (const num of numbers) {
      if (num.startsWith("6") && num.length === 9) {
        return num;
      }
    }
  }

  return null;
}

/**
 * Extract amount from text
 * Looks for patterns like: 15k, 15000, 15.000, etc.
 */
function extractAmount(text) {
  // Remove spaces
  const cleaned = text.replace(/\s/g, "");

  // Pattern 1: Number followed by k/K (e.g., 15k, 20K)
  const pattern1 = /(\d+(?:\.\d+)?)\s*k/gi;
  const match1 = cleaned.match(pattern1);
  if (match1) {
    const num = parseFloat(match1[0].replace(/k/gi, ""));
    return num * 1000;
  }

  // Pattern 2: Numbers with dots or commas as thousands separator
  const pattern2 = /(\d{1,3}(?:[.,]\d{3})*)/g;
  const matches = cleaned.match(pattern2);
  if (matches) {
    // Get the largest number (likely the amount)
    const amounts = matches.map((m) =>
      parseFloat(m.replace(/[.,]/g, ""))
    );
    return Math.max(...amounts);
  }

  // Pattern 3: Just plain numbers
  const numbers = cleaned.match(/\d+/g);
  if (numbers) {
    // Filter out phone numbers (9 digits starting with 6)
    const amounts = numbers
      .map((n) => parseInt(n))
      .filter((n) => !(n.toString().startsWith("6") && n.toString().length === 9))
      .filter((n) => n > 100); // Amounts should be > 100 FCFA

    if (amounts.length > 0) {
      return Math.max(...amounts);
    }
  }

  return null;
}

/**
 * Extract quartier (neighborhood) from text
 * Common quartiers in Douala/Cameroon
 */
const COMMON_QUARTIERS = [
  "bonapriso",
  "akwa",
  "douala",
  "makepe",
  "logpom",
  "pk8",
  "pk12",
  "wouri",
  "deido",
  "bessengue",
  "new-bell",
  "newbell",
  "bonanjo",
  "kotto",
  "ndokotti",
  "bepanda",
  "denver",
];

function extractQuartier(text) {
  const lowerText = text.toLowerCase();

  for (const quartier of COMMON_QUARTIERS) {
    if (lowerText.includes(quartier)) {
      return quartier;
    }
  }

  return null;
}

/**
 * Extract carrier/expedition info
 */
function extractCarrier(text) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("men travel") || lowerText.includes("mentravel")) {
    return "Men Travel";
  }
  if (
    lowerText.includes("general voyage") ||
    lowerText.includes("generalvoyage")
  ) {
    return "General Voyage";
  }
  if (lowerText.includes("expedition") || lowerText.includes("expédition")) {
    return "Expedition";
  }

  return null;
}

/**
 * Extract customer name (if mentioned)
 */
function extractCustomerName(text) {
  // Look for patterns like "Client: Name" or "Nom: Name"
  const patterns = [
    /client[:\s]+([a-zéèêëàâäôöùûüç\s]+)/i,
    /nom[:\s]+([a-zéèêëàâäôöùûüç\s]+)/i,
    /name[:\s]+([a-zéèêëàâäôöùûüç\s]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Parse Option 3 format: Compact Structured
 * Format:
 *   Line 1: Phone number (6xx123456)
 *   Line 2: Items/products (2 robes + 1 sac)
 *   Line 3: Amount (15k or 15000)
 *   Line 4: Quartier (Bonapriso)
 */
function parseCompactStructuredFormat(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0); // Remove empty lines

  // Need at least 4 lines
  if (lines.length < 4) {
    return {
      valid: false,
      error: `Format invalide: Besoin de 4 lignes, reçu ${lines.length}`,
      expectedFormat: "Ligne 1: Numéro\nLigne 2: Produits\nLigne 3: Montant\nLigne 4: Quartier",
    };
  }

  // Line 1: Phone number
  const phoneLine = lines[0];
  let phone = phoneLine.replace(/[^\dx]/gi, ""); // Keep only digits and x
  if (!phone.startsWith("6")) {
    return {
      valid: false,
      error: `Numéro invalide: "${phoneLine}" - Doit commencer par 6`,
    };
  }
  // Normalize phone (replace x with 0 for storage, but keep original for display)
  phone = phone.replace(/x/gi, "0");
  if (phone.length !== 9) {
    return {
      valid: false,
      error: `Numéro invalide: "${phoneLine}" - Doit avoir 9 chiffres`,
    };
  }

  // Line 2: Items
  const items = lines[1];
  if (!items || items.length < 2) {
    return {
      valid: false,
      error: `Produits invalides: "${items}" - Doit contenir la description des produits`,
    };
  }

  // Line 3: Amount
  const amountLine = lines[2];
  let amount = null;
  
  // Try to extract amount
  const amountMatch = amountLine.match(/(\d+(?:\.\d+)?)\s*k?/i);
  if (amountMatch) {
    const num = parseFloat(amountMatch[1]);
    if (amountLine.toLowerCase().includes("k")) {
      amount = num * 1000;
    } else {
      amount = num;
    }
  } else {
    // Try to find any number in the line
    const numbers = amountLine.match(/\d+/g);
    if (numbers) {
      const amounts = numbers.map((n) => parseInt(n)).filter((n) => n > 100);
      if (amounts.length > 0) {
        amount = Math.max(...amounts);
      }
    }
  }

  if (!amount || amount < 100) {
    return {
      valid: false,
      error: `Montant invalide: "${amountLine}" - Doit être un montant valide (ex: 15k, 15000)`,
    };
  }

  // Line 4: Quartier
  const quartierLine = lines[3];
  const quartier = quartierLine.trim();
  if (!quartier || quartier.length < 2) {
    return {
      valid: false,
      error: `Quartier invalide: "${quartierLine}" - Doit spécifier le quartier`,
    };
  }

  // Check for carrier in any line (optional)
  const carrier = extractCarrier(text);

  return {
    valid: true,
    phone,
    items,
    amount_due: amount,
    quartier,
    carrier,
    customer_name: null, // Not in this format
    hasPhone: true,
    hasAmount: true,
  };
}

/**
 * Main parser function - extracts all delivery info from a message
 * Tries Option 3 format first, then falls back to flexible parsing
 */
function parseDeliveryMessage(text) {
  // First, try Option 3: Compact Structured format
  const compactResult = parseCompactStructuredFormat(text);
  if (compactResult.valid) {
    return compactResult;
  }

  // If not valid compact format, check if it's close (has 4+ lines)
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length >= 4) {
    // It looks like compact format but has errors
    return {
      ...compactResult,
      error: compactResult.error || "Format invalide",
    };
  }

  // Fallback to flexible parsing (for backward compatibility)
  const phone = extractPhone(text);
  const amount = extractAmount(text);
  const quartier = extractQuartier(text);
  const carrier = extractCarrier(text);
  const customer_name = extractCustomerName(text);

  // Extract items
  let items = text;
  if (phone) {
    items = items.replace(new RegExp(phone, "gi"), "");
  }
  if (amount) {
    items = items.replace(new RegExp(amount.toString(), "gi"), "");
    items = items.replace(new RegExp((amount / 1000) + "k", "gi"), "");
  }
  if (quartier) {
    items = items.replace(new RegExp(quartier, "gi"), "");
  }
  if (carrier) {
    items = items.replace(new RegExp(carrier, "gi"), "");
  }

  items = items
    .replace(/client[:\s]+[^\n]+/gi, "")
    .replace(/nom[:\s]+[^\n]+/gi, "")
    .replace(/name[:\s]+[^\n]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (items.length < 5) {
    items = text.substring(0, 200);
  }

  return {
    valid: true,
    phone,
    amount_due: amount,
    quartier,
    carrier,
    customer_name,
    items: items || text.substring(0, 200),
    hasPhone: !!phone,
    hasAmount: !!amount,
  };
}

/**
 * Check if a message looks like a new delivery
 * Prioritizes Option 3 format (4-line structured)
 */
function isDeliveryMessage(text) {
  // Check if it's a status update first
  const statusKeywords = [
    "livré",
    "livre",
    "échec",
    "echec",
    "collecté",
    "collecte",
    "modifier",
    "change",
    "vient chercher",
    "pickup",
    "ramassage",
  ];

  const lowerText = text.toLowerCase();
  const isStatusUpdate = statusKeywords.some((keyword) =>
    lowerText.includes(keyword)
  );

  if (isStatusUpdate) {
    return false;
  }

  // Check if it follows Option 3 format (4 lines)
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  
  // If it has 4+ lines, it's likely Option 3 format
  if (lines.length >= 4) {
    const parsed = parseDeliveryMessage(text);
    return parsed.valid === true; // Only return true if valid Option 3 format
  }

  // Fallback: check for phone or amount (flexible format)
  const parsed = parseDeliveryMessage(text);
  return parsed.valid && (parsed.hasPhone || parsed.hasAmount);
}

module.exports = {
  parseDeliveryMessage,
  isDeliveryMessage,
  extractPhone,
  extractAmount,
  extractQuartier,
  extractCarrier,
  extractCustomerName,
};

