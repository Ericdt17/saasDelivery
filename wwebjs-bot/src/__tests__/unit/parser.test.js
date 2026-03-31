'use strict';

const { parseDeliveryMessage, isDeliveryMessage } = require('../../parser');

// ---------------------------------------------------------------------------
// parseDeliveryMessage
// ---------------------------------------------------------------------------
describe('parseDeliveryMessage', () => {
  describe('multi-line format (phone / items / amount / quartier)', () => {
    it('parses a standard 4-line delivery message', () => {
      const msg = '612345678\n2 robes + 1 sac\n15k\nBonapriso';
      const result = parseDeliveryMessage(msg);
      expect(result.valid).toBe(true);
      expect(result.phone).toBe('612345678');
      expect(result.items).toBe('2 robes + 1 sac');
      expect(result.amount_due).toBe(15000);
      expect(result.quartier).toBe('Bonapriso');
    });

    it('converts k-suffix amounts (15k → 15000)', () => {
      const msg = '690000001\n1 pantalon\n15k\nAkwa';
      const result = parseDeliveryMessage(msg);
      expect(result.amount_due).toBe(15000);
    });

    it('accepts plain numeric amounts (20000)', () => {
      const msg = '699999999\n3 chemises\n20000\nAkwa';
      const result = parseDeliveryMessage(msg);
      expect(result.valid).toBe(true);
      expect(result.amount_due).toBe(20000);
    });

    it('extracts quartier from the predefined list', () => {
      const msg = '655555555\n1 sac\n12000\nMakepe';
      const result = parseDeliveryMessage(msg);
      expect(result.quartier).toBe('Makepe');
    });

    it('extracts quartier Bepanda', () => {
      const msg = '688888888\n5 articles\n30000\nBepanda';
      const result = parseDeliveryMessage(msg);
      expect(result.quartier).toBe('Bepanda');
    });
  });

  describe('invalid / unrecognised messages', () => {
    // The parser is permissive and always returns an object — check that
    // required fields (phone, amount_due) are absent for unrecognised input.

    it('extracts no valid phone from a plain greeting', () => {
      const result = parseDeliveryMessage('bonjour comment tu vas');
      // A greeting has no Cameroon phone number (6XXXXXXXX)
      expect(!result || !result.phone).toBe(true);
    });

    it('extracts no amount from an empty string', () => {
      const result = parseDeliveryMessage('');
      expect(!result || !result.amount_due).toBe(true);
    });

    it('isDeliveryMessage rejects a plain greeting', () => {
      // The high-level guard (isDeliveryMessage) is the correct API for checking
      // whether a WhatsApp message should be treated as a new delivery.
      expect(isDeliveryMessage('bonjour comment tu vas')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// isDeliveryMessage
// ---------------------------------------------------------------------------
describe('isDeliveryMessage', () => {
  it('returns true for a valid delivery message', () => {
    const msg = '612345678\n2 robes\n15k\nBonapriso';
    expect(isDeliveryMessage(msg)).toBe(true);
  });

  it('returns false for a status keyword "Livré"', () => {
    expect(isDeliveryMessage('Livré 612345678')).toBe(false);
  });

  it('returns false for a status keyword "Échec"', () => {
    expect(isDeliveryMessage('Échec 699999999')).toBe(false);
  });

  it('returns false for a plain text message', () => {
    expect(isDeliveryMessage('ok merci')).toBe(false);
  });

  it('returns false for a long free-text paragraph containing a phone and amount', () => {
    // Regression: a conversational message that happens to contain a phone-like
    // number and an amount must NOT be treated as a delivery order.
    const msg =
      "@52127 svp j'ai besoin qu'on me fasse le dépôt de la totalité de mon argent ce matin , " +
      "bientôt mes publicités seront désactivées et j'aimerais payer à l'avance. " +
      "Actuellement j'ai un solde publicitaire de 151000fr et je n'ai même pas la moitié entre les mains.";
    expect(isDeliveryMessage(msg)).toBe(false);
  });

  it('returns false for a message with only 3 lines', () => {
    expect(isDeliveryMessage('612345678\n2 robes\n15k')).toBe(false);
  });

  it('returns false for a 4-line message starting with a @mention', () => {
    // Regression: @mention as first line was treated as "quartier" by the
    // alternative format parser, allowing conversational messages through.
    const msg = '@223355697397803 vous m\'avez parlez de combien ?\n3 appels\n500fr\n697397803';
    expect(isDeliveryMessage(msg)).toBe(false);
  });

  it('returns true for a delivery whose items contain the word "livre" (book/pound)', () => {
    // Regression: "livre" was in the status keyword list causing deliveries
    // with product names like "2 livres" or "1 livre de café" to be silently dropped.
    const msg = '612345678\n2 livres de café\n8000\nBonapriso';
    expect(isDeliveryMessage(msg)).toBe(true);
  });

  it('returns true for a delivery whose items contain "change" mid-message', () => {
    // Regression: bare "change" keyword check blocked product descriptions like
    // "1 change de vêtements".  Only "change" at the START of a message is a status.
    const msg = '691234567\n1 change de vêtements\n12000\nAkwa';
    expect(isDeliveryMessage(msg)).toBe(true);
  });

  it('returns false for a status message that starts with "change"', () => {
    expect(isDeliveryMessage('change numéro 691234567')).toBe(false);
  });
});
