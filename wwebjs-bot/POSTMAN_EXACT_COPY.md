# ✅ EXACT JSON to Copy for Postman

## ⚠️ IMPORTANT: Copy ONLY the JSON, nothing else!

**Fields that match what the bot collects from WhatsApp:**

- ✅ `phone` (required) - Line 1 from WhatsApp
- ✅ `items` (required) - Line 2 from WhatsApp
- ✅ `amount_due` (required) - Line 3 from WhatsApp
- ✅ `quartier` (optional) - Line 4 from WhatsApp
- ✅ `carrier` (optional) - Sometimes added manually
- ✅ `status` - pending/pickup/delivered/failed
- ✅ `amount_paid` - For partial payments
- ✅ `notes` - Optional notes

---

## Delivery 1:

```
{
  "phone": "612345678",
  "items": "2 robes + 1 sac",
  "amount_due": 15000,
  "amount_paid": 0,
  "status": "pending",
  "quartier": "Bonapriso",
  "notes": "Customer prefers morning delivery"
}
```

---

## Delivery 2:

```
{
  "phone": "698765432",
  "items": "3 chemises",
  "amount_due": 20000,
  "amount_paid": 5000,
  "status": "pending",
  "quartier": "Akwa",
  "carrier": "Express Delivery"
}
```

---

## Delivery 3:

```
{
  "phone": "655444333",
  "items": "1 pantalon + 2 t-shirts",
  "amount_due": 25000,
  "amount_paid": 0,
  "status": "pending",
  "quartier": "Makepe",
  "notes": "Fragile items"
}
```

---

## Delivery 4:

```
{
  "phone": "677888999",
  "items": "5 articles divers",
  "amount_due": 30000,
  "amount_paid": 10000,
  "status": "pending",
  "quartier": "Bepanda"
}
```

---

## Delivery 5:

```
{
  "phone": "644555666",
  "items": "1 costume complet",
  "amount_due": 45000,
  "amount_paid": 0,
  "status": "pending",
  "quartier": "Douala Centre",
  "carrier": "Fast Track"
}
```

---

## Delivery 6:

```
{
  "phone": "611222333",
  "items": "4 robes",
  "amount_due": 35000,
  "amount_paid": 35000,
  "status": "pickup",
  "quartier": "Bali",
  "notes": "Fully paid, ready for delivery"
}
```

---

## Delivery 7:

```
{
  "phone": "622333444",
  "items": "2 pantalons",
  "amount_due": 18000,
  "amount_paid": 9000,
  "status": "pickup",
  "quartier": "New Bell",
  "carrier": "Standard Delivery"
}
```

---

## Delivery 8:

```
{
  "phone": "633444555",
  "items": "1 robe de soirée",
  "amount_due": 50000,
  "amount_paid": 25000,
  "status": "pickup",
  "quartier": "Bonanjo",
  "notes": "High value item"
}
```

---

## Delivery 9:

```
{
  "phone": "644555777",
  "items": "3 chemises + 2 cravates",
  "amount_due": 28000,
  "amount_paid": 28000,
  "status": "pickup",
  "quartier": "Logpom"
}
```

---

## Delivery 10:

```
{
  "phone": "655666888",
  "items": "6 articles enfants",
  "amount_due": 22000,
  "amount_paid": 0,
  "status": "pickup",
  "quartier": "Kotto",
  "carrier": "Express Delivery"
}
```

---

## Delivery 11:

```
{
  "phone": "666777999",
  "items": "2 costumes",
  "amount_due": 90000,
  "amount_paid": 90000,
  "status": "delivered",
  "quartier": "Deido",
  "notes": "Delivered on time"
}
```

---

## Delivery 12:

```
{
  "phone": "677888111",
  "items": "4 robes + 2 sacs",
  "amount_due": 55000,
  "amount_paid": 55000,
  "status": "delivered",
  "quartier": "Wouri"
}
```

---

## Delivery 13:

```
{
  "phone": "688999222",
  "items": "1 complet + 3 chemises",
  "amount_due": 75000,
  "amount_paid": 75000,
  "status": "delivered",
  "quartier": "Pk8",
  "carrier": "Premium Delivery"
}
```

---

## Delivery 14:

```
{
  "phone": "699111333",
  "items": "5 robes",
  "amount_due": 40000,
  "amount_paid": 40000,
  "status": "delivered",
  "quartier": "Mbanga",
  "notes": "Customer satisfied"
}
```

---

## Delivery 15:

```
{
  "phone": "611333555",
  "items": "2 pantalons + 1 veste",
  "amount_due": 32000,
  "amount_paid": 32000,
  "status": "delivered",
  "quartier": "Nkongsamba"
}
```

---

## Delivery 16:

```
{
  "phone": "622444666",
  "items": "3 chemises",
  "amount_due": 24000,
  "amount_paid": 12000,
  "status": "failed",
  "quartier": "Limbe",
  "notes": "Wrong address, customer not found"
}
```

---

## Delivery 17:

```
{
  "phone": "633555777",
  "items": "1 robe de mariée",
  "amount_due": 120000,
  "amount_paid": 60000,
  "status": "failed",
  "quartier": "Buea",
  "carrier": "Special Delivery",
  "notes": "Customer canceled order"
}
```

---

## Delivery 18:

```
{
  "phone": "644666888",
  "items": "4 t-shirts",
  "amount_due": 15000,
  "amount_paid": 0,
  "status": "failed",
  "quartier": "Kribi",
  "notes": "Package damaged, return to sender"
}
```

---

## Delivery 19:

```
{
  "phone": "655777999",
  "items": "10 articles divers",
  "amount_due": 85000,
  "amount_paid": 50000,
  "status": "pending",
  "quartier": "Edea",
  "carrier": "Bulk Delivery",
  "notes": "Large order, partial payment received"
}
```

---

## Delivery 20:

```
{
  "phone": "666888111",
  "items": "1 costume premium",
  "amount_due": 150000,
  "amount_paid": 150000,
  "status": "delivered",
  "quartier": "Yaoundé",
  "carrier": "Premium Express",
  "notes": "VIP customer, urgent delivery"
}
```

---

## 📋 Instructions:

1. Copy ONLY the content between the triple backticks (```)
2. In Postman: Body → raw → JSON
3. Paste the JSON
4. Click Send

**DO NOT copy:**

- ❌ The "Delivery X:" label
- ❌ The triple backticks (```)
- ❌ Any text before or after the JSON

**DO copy:**

- ✅ Only the JSON object from { to }

## 📝 Field Reference (matches WhatsApp format):

- **phone**: Phone number (Line 1 from WhatsApp)
- **items**: Items description (Line 2 from WhatsApp)
- **amount_due**: Amount (Line 3 from WhatsApp)
- **quartier**: Neighborhood (Line 4 from WhatsApp)
- **carrier**: Optional carrier name
- **status**: pending/pickup/delivered/failed
- **amount_paid**: Partial payment amount
- **notes**: Optional notes
