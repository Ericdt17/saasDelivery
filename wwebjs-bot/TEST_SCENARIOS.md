# 🧪 Test Scenarios - Status Updates

## 📋 How to Test

1. **First, create a delivery** using the standard format
2. **Then send status updates** using the scenarios below
3. **Check terminal logs** for success messages
4. **Verify with**: `npm run view` to see updated deliveries

---

## ✅ Test Scenario 1: Create Delivery → Mark as Delivered

### Step 1: Create Delivery

```
612345678
2 robes + 1 sac
15k
Bonapriso
```

**Expected:** `✅ Livraison #X créée avec succès!`

### Step 2: Mark as Delivered

```
Livré 612345678
```

**Expected Log:**

```
🔄 Detected as STATUS UPDATE
✅ Livraison #X marquée comme LIVRÉE
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

## ✅ Test Scenario 2: Create Delivery → Mark as Failed

### Step 1: Create Delivery

```
699999999
3 chemises
20000
Akwa
```

### Step 2: Mark as Failed

```
Échec 699999999
```

OR

```
Numéro ne passe pas 699999999
```

**Expected Log:**

```
🔄 Detected as STATUS UPDATE
❌ Livraison #X marquée comme ÉCHEC
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

## ✅ Test Scenario 3: Create Delivery → Collect Payment

### Step 1: Create Delivery

```
655555555
1 pantalon
12000
Makepe
```

### Step 2: Collect Partial Payment

```
Collecté 5k 655555555
```

**Expected Log:**

```
🔄 Detected as STATUS UPDATE
💰 Paiement collecté: 5000 FCFA
💵 Total payé: 5000 FCFA / 12000 FCFA
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

### Step 3: Collect Remaining Payment

```
Collecté 7k 655555555
```

**Expected Log:**

```
💰 Paiement collecté: 7000 FCFA
💵 Total payé: 12000 FCFA / 12000 FCFA
✅ Livraison complètement payée - marquée comme LIVRÉE
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

## ✅ Test Scenario 4: Create Delivery → Customer Pickup

### Step 1: Create Delivery

```
644444444
2 paires de chaussures
18000
PK8
```

### Step 2: Mark as Pickup

```
Elle passe chercher 644444444
```

OR

```
Pickup 644444444
```

OR

```
Ramassage 644444444
```

**Expected Log:**

```
🔄 Detected as STATUS UPDATE
📦 Livraison #X marquée comme PICKUP
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

## ✅ Test Scenario 5: Create Delivery → Modify Items/Amount

### Step 1: Create Delivery

```
633333333
2 robes
15000
Bonapriso
```

### Step 2: Modify Items

```
Modifier: elle prend finalement 3 robes 633333333
```

**Expected Log:**

```
🔄 Detected as STATUS UPDATE
✏️  Livraison #X MODIFIÉE
📦 Nouveaux produits: 3 robes
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

### Step 3: Modify Amount

```
Modifier: nouveau montant 20000 633333333
```

**Expected Log:**

```
✏️  Livraison #X MODIFIÉE
💰 Nouveau montant: 20000 FCFA
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

## ✅ Test Scenario 6: Create Delivery → Change Phone Number

### Step 1: Create Delivery

```
622222222
1 sac
10000
Douala
```

### Step 2: Change Phone Number

```
Changer numéro 622222222 699999999
```

**Expected Log:**

```
🔄 Detected as STATUS UPDATE
📱 Numéro changé: 622222222 → 699999999
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

## ✅ Test Scenario 7: Create Delivery → Mark as Pending

### Step 1: Create Delivery

```
611111111
4 chemises
25000
Logpom
```

### Step 2: Mark as Pending

```
En attente 611111111
```

**Expected Log:**

```
🔄 Detected as STATUS UPDATE
⏳ Livraison #X marquée comme EN ATTENTE
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

## ✅ Test Scenario 8: Multiple Payments (Partial Payments)

### Step 1: Create Delivery

```
688888888
5 articles
30000
Bepanda
```

### Step 2: First Payment

```
Collecté 10k 688888888
```

**Expected:** Total payé: 10000 / 30000

### Step 3: Second Payment

```
Collecté 15k 688888888
```

**Expected:** Total payé: 25000 / 30000

### Step 4: Final Payment

```
Collecté 5k 688888888
```

**Expected:**

- Total payé: 30000 / 30000
- ✅ Livraison complètement payée - marquée comme LIVRÉE

---

## ❌ Error Scenarios (What NOT to do)

### Error 1: Status Update Without Phone Number

```
Collecté 5k
```

**Expected:** `⚠️ Numéro de téléphone non trouvé`

### Error 2: Status Update for Non-Existent Delivery

```
Livré 600000000
```

**Expected:** `⚠️ Aucune livraison trouvée pour le numéro: 600000000`

### Error 3: Wrong Phone Number Format

```
Livré 123456789
```

**Expected:** Phone not found (must start with 6)

---

## 📊 Verification Commands

After testing, verify updates:

```bash
npm run view
```

This shows:

- All deliveries
- Current status
- Amount paid vs amount due
- Last update time

---

## 🎯 Quick Test Checklist

- [ ] Create delivery → Mark as delivered
- [ ] Create delivery → Mark as failed
- [ ] Create delivery → Collect payment (partial)
- [ ] Create delivery → Collect full payment (auto-delivered)
- [ ] Create delivery → Mark as pickup
- [ ] Create delivery → Modify items
- [ ] Create delivery → Modify amount
- [ ] Create delivery → Change phone number
- [ ] Multiple partial payments
- [ ] Error: Status without phone number
- [ ] Error: Status for non-existent delivery

---

## 💡 Tips

1. **Use different phone numbers** for each test (612345678, 699999999, etc.)
2. **Check terminal logs** after each update
3. **Run `npm run view`** to verify database updates
4. **Phone number must be in message** for status updates to work
5. **Phone number can be anywhere** in the message (start, middle, end)




