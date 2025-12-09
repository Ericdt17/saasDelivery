# 📱 How to Use the WhatsApp Delivery Bot

This guide will help you test and use the WhatsApp Delivery Bot as an end user.

---

## 🚀 Quick Start

### 1. Start the Bot

```bash
npm run dev
```

Or for production:

```bash
npm start
```

### 2. Connect WhatsApp

1. A QR code will appear in your terminal
2. Open WhatsApp on your **PHONE** (not computer)
3. Go to **Settings → Linked Devices → Link a Device**
4. Scan the QR code shown in the terminal
5. Wait for the success message: `✅ Bot is ready!`

💡 **Tip**: The QR code is also saved as `qr-code.png` in the project folder - you can open this file and scan it!

### 3. Configure Your Group (Optional)

If you want the bot to only listen to a specific WhatsApp group:

1. Send any message in your target group
2. Look in the terminal logs for the `groupId`
3. Copy the group ID
4. Add it to your `.env` file: `GROUP_ID=your-group-id-here`
5. Restart the bot

---

## 📦 Creating a Delivery

### Format: 4-Line Message

Send a message in the WhatsApp group (or configured group) with this format:

```
612345678
2 robes + 1 sac
15k
Bonapriso
```

**Line by line:**

1. **Phone Number** - Must start with `6`, 9 digits (e.g., `612345678`)
2. **Items/Products** - Description of what's being delivered
3. **Amount** - Can be in format: `15k`, `15000`, `15.000`, or `15,000`
4. **Quartier** - Neighborhood/location name

### Example Messages

**Example 1:**

```
699999999
3 chemises
20000
Akwa
```

**Example 2:**

```
655555555
1 pantalon
12000
Makepe
```

**Example 3:**

```
688888888
5 articles
30000
Bepanda
```

### ✅ What to Expect

When you send a delivery message, you should see in the terminal:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📨 Message from Target Group:
   ✅ Detected as DELIVERY message

============================================================
   ✅ LIVRAISON #1 ENREGISTRÉE AVEC SUCCÈS!
============================================================
   📱 Numéro: 612345678
   📦 Produits: 2 robes + 1 sac
   💰 Montant: 15000 FCFA
   📍 Quartier: Bonapriso
   💾 Sauvegardé dans la base de données
============================================================
```

---

## 🔄 Updating Delivery Status

After creating a delivery, you can update its status by sending status messages.

### 1. Mark as Delivered ✅

**Format:** `Livré [phone_number]`

**Examples:**

- `Livré 612345678`
- `Livré 699999999`

**What you'll see:**

```
🔄 Detected as STATUS UPDATE
✅ Livraison #1 marquée comme LIVRÉE
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

### 2. Mark as Failed ❌

**Format:** `Échec [phone_number]` OR `Numéro ne passe pas [phone_number]`

**Examples:**

- `Échec 699999999`
- `Numéro ne passe pas 699999999`

**What you'll see:**

```
🔄 Detected as STATUS UPDATE
❌ Livraison #2 marquée comme ÉCHEC
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

### 3. Collect Payment 💰

**Format:** `Collecté [amount] [phone_number]`

**Examples:**

- `Collecté 5k 655555555`
- `Collecté 5000 655555555`
- `Collecté 7k 655555555`

**What you'll see (Partial Payment):**

```
🔄 Detected as STATUS UPDATE
💰 Paiement collecté: 5000 FCFA
💵 Total payé: 5000 FCFA / 12000 FCFA
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

**What you'll see (Full Payment - Auto-Delivered):**

```
💰 Paiement collecté: 7000 FCFA
💵 Total payé: 12000 FCFA / 12000 FCFA
✅ Livraison complètement payée - marquée comme LIVRÉE
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

💡 **Tip:** You can collect multiple partial payments. The bot will automatically mark as delivered when fully paid!

---

### 4. Mark as Customer Pickup 📦

**Format:** Any of these:

- `Elle passe chercher [phone_number]`
- `Pickup [phone_number]`
- `Ramassage [phone_number]`

**Examples:**

- `Elle passe chercher 644444444`
- `Pickup 644444444`
- `Ramassage 644444444`

**What you'll see:**

```
🔄 Detected as STATUS UPDATE
📦 Livraison #4 marquée comme PICKUP
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

### 5. Modify Delivery Details ✏️

**Format:** `Modifier: [details] [phone_number]`

**Modify Items:**

- `Modifier: elle prend finalement 3 robes 633333333`

**Modify Amount:**

- `Modifier: nouveau montant 20000 633333333`

**What you'll see:**

```
🔄 Detected as STATUS UPDATE
✏️  Livraison #5 MODIFIÉE
📦 Nouveaux produits: 3 robes
💰 Nouveau montant: 20000 FCFA
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

### 6. Change Phone Number 📱

**Format:** `Changer numéro [old_phone] [new_phone]`

**Example:**

- `Changer numéro 622222222 699999999`

**What you'll see:**

```
🔄 Detected as STATUS UPDATE
📱 Numéro changé: 622222222 → 699999999
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

### 7. Mark as Pending ⏳

**Format:** `En attente [phone_number]`

**Example:**

- `En attente 611111111`

**What you'll see:**

```
🔄 Detected as STATUS UPDATE
⏳ Livraison #7 marquée comme EN ATTENTE
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
```

---

## 📊 Viewing Deliveries

### View Today's Deliveries

```bash
npm run view
```

Shows only deliveries created today with daily statistics.

### View ALL Deliveries

```bash
npm run view:all
```

Shows **all deliveries** in your database with complete statistics.

### Filter Deliveries

You can filter deliveries using command-line options:

**Filter by Status:**

```bash
npm run view:all -- --status=pending
npm run view:all -- --status=delivered
npm run view:all -- --status=failed
npm run view:all -- --status=pickup
```

**Filter by Date:**

```bash
npm run view:all -- --date=2024-01-15
```

**Search by Phone Number:**

```bash
npm run view:all -- --phone=612345678
```

**Combine Filters:**

```bash
npm run view:all -- --status=pending --date=2024-01-15
```

### Example Output:

```
📊 Statistiques Globales:
   📦 Total de livraisons: 25
   ✅ Livrées: 15
   ⏳ En attente: 5
   📦 Pickup: 3
   ❌ Échecs: 2
   💰 Total dû: 350000 FCFA
   💵 Total collecté: 280000 FCFA
   💸 Restant: 70000 FCFA

📋 Livraisons trouvées (25):

1. Livraison #25
   📱 Numéro: 612345678
   📦 Produits: 2 robes + 1 sac
   💰 Montant dû: 15000 FCFA
   💵 Payé: 15000 FCFA
   📍 Quartier: Bonapriso
   ✅ Statut: delivered
   🕐 Créé: 15/01/2024 10:30:00
   🕐 Modifié: 15/01/2024 14:20:00
```

---

## 🧪 Testing All Features

Follow these scenarios to test everything:

### Test 1: Complete Delivery Flow

1. Create delivery: `612345678` / `2 robes` / `15k` / `Bonapriso`
2. Mark as delivered: `Livré 612345678`
3. Check terminal for success messages

### Test 2: Payment Collection

1. Create delivery: `655555555` / `1 pantalon` / `12000` / `Makepe`
2. Collect partial: `Collecté 5k 655555555`
3. Collect remaining: `Collecté 7k 655555555`
4. Should auto-mark as delivered

### Test 3: Multiple Payments

1. Create delivery: `688888888` / `5 articles` / `30000` / `Bepanda`
2. First payment: `Collecté 10k 688888888`
3. Second payment: `Collecté 15k 688888888`
4. Final payment: `Collecté 5k 688888888`
5. Should auto-mark as delivered when fully paid

### Test 4: Status Updates

1. Create delivery
2. Try different status updates:
   - `Pickup [phone]`
   - `En attente [phone]`
   - `Échec [phone]`
   - `Livré [phone]`

---

## ❌ Common Errors & Solutions

### Error: "Format invalide"

**Problem:** Delivery message doesn't have 4 lines
**Solution:** Make sure your message has exactly 4 lines:

1. Phone number
2. Items
3. Amount
4. Quartier

### Error: "Numéro de téléphone non trouvé"

**Problem:** Status update doesn't include a phone number
**Solution:** Always include the phone number in status updates:

- ✅ `Livré 612345678`
- ❌ `Livré` (missing phone)

### Error: "Aucune livraison trouvée"

**Problem:** Status update for a delivery that doesn't exist
**Solution:** Create the delivery first before updating its status

### Error: Phone number not recognized

**Problem:** Phone number doesn't start with `6` or wrong format
**Solution:** Use Cameroon format: 9 digits starting with `6` (e.g., `612345678`)

---

## 💡 Tips & Best Practices

1. **Use Different Phone Numbers** for each test to avoid confusion
2. **Check Terminal Logs** after each message to see if it was processed
3. **Run `npm run view`** regularly to verify database updates
4. **Phone Number Location** - The phone number can be anywhere in the status update message
5. **Amount Formats** - All these work: `15k`, `15000`, `15.000`, `15,000`
6. **Group Filtering** - If configured, the bot only processes messages from your target group

---

## 🔍 Debugging

### Check if Bot is Running

Look for: `✅ Bot is ready!` in terminal

### Check Message Processing

After sending a message, look for:

- `📨 Message from Target Group:` - Message was received
- `✅ Detected as DELIVERY message` - Delivery was parsed
- `🔄 Detected as STATUS UPDATE` - Status update was parsed

### View Database

```bash
npm run view
```

### Check Logs

All processing details are shown in the terminal with clear indicators:

- ✅ Success
- ❌ Error
- ⚠️ Warning
- 📊 Information

---

## 📝 Quick Reference

### Delivery Format

```
[phone_number]
[items]
[amount]
[quartier]
```

### Status Update Formats

- Delivered: `Livré [phone]`
- Failed: `Échec [phone]` or `Numéro ne passe pas [phone]`
- Payment: `Collecté [amount] [phone]`
- Pickup: `Pickup [phone]` or `Elle passe chercher [phone]`
- Pending: `En attente [phone]`
- Modify: `Modifier: [details] [phone]`
- Change Phone: `Changer numéro [old] [new]`

---

## 🆘 Need Help?

1. Check terminal logs for error messages
2. Verify your message format matches the examples
3. Run `npm run view` to check if delivery exists
4. Make sure the bot is running and connected (`✅ Bot is ready!`)

---

**Happy Testing! 🚀**
