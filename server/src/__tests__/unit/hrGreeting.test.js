'use strict';

const {
  firstNameFromFullName,
  successGreeting,
  isNetworkErrorMessage,
} = require('../../lib/hrGreeting');

describe('hrGreeting', () => {
  it('extracts the first given name', () => {
    expect(firstNameFromFullName('Marie Dupont')).toBe('Marie');
    expect(firstNameFromFullName('  Jean  Claude  ')).toBe('Jean');
  });

  it('builds a warm success greeting', () => {
    expect(successGreeting('Marie Dupont')).toBe('Bonjour Marie, bonne journée !');
    expect(successGreeting('')).toBe('Bonne journée !');
  });

  it('detects network-style error messages for retry UX', () => {
    expect(isNetworkErrorMessage('Connexion impossible pour le moment.')).toBe(true);
    expect(isNetworkErrorMessage('Vous n\'êtes pas au bureau.')).toBe(false);
  });
});
