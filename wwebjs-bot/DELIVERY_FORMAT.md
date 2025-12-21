# Format de Livraison - Option 3

## Format Standard (4 lignes)

Utilisez ce format exact pour créer une nouvelle livraison :

```
612345678
2 robes + 1 sac
15k
Bonapriso
```

## Structure

**Ligne 1:** Numéro de téléphone (commence par 6, 9 chiffres)
- ✅ Correct: `612345678`
- ✅ Correct: `6xx123456` (xx sera remplacé par 00)
- ❌ Incorrect: `123456789` (doit commencer par 6)

**Ligne 2:** Description des produits
- ✅ Correct: `2 robes + 1 sac`
- ✅ Correct: `3 chemises`
- ✅ Correct: `1 pantalon + 2 paires de chaussures`

**Ligne 3:** Montant
- ✅ Correct: `15k` (15 000 FCFA)
- ✅ Correct: `15000` (15 000 FCFA)
- ✅ Correct: `25k` (25 000 FCFA)
- ❌ Incorrect: `15` (trop petit, minimum 100 FCFA)

**Ligne 4:** Quartier
- ✅ Correct: `Bonapriso`
- ✅ Correct: `Akwa`
- ✅ Correct: `Makepe`
- ✅ Correct: `PK8`

## Exemples

### Exemple 1: Livraison simple
```
612345678
2 robes
15k
Bonapriso
```

### Exemple 2: Plusieurs produits
```
678901234
3 chemises + 2 pantalons + 1 sac
25000
Akwa
```

### Exemple 3: Avec montant en chiffres
```
655432109
1 robe
12000
Makepe
```

## Notes Importantes

- ⚠️ **4 lignes exactement** (une ligne vide entre chaque est OK)
- ⚠️ Le numéro **doit commencer par 6**
- ⚠️ Le montant **minimum est 100 FCFA**
- ⚠️ Le quartier **doit être spécifié**

## Transporteurs (Optionnel)

Si c'est une expédition, vous pouvez ajouter le transporteur dans n'importe quelle ligne :
- `Men Travel`
- `General Voyage`
- `Expedition`

Exemple:
```
612345678
2 robes
15k
Bonapriso
Men Travel
```

Le bot détectera automatiquement le transporteur.










