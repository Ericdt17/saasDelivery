# 📮 Postman JSON Bodies - 20 Deliveries

Use these JSON bodies to POST deliveries via Postman.

**Endpoint**: `POST http://localhost:3000/api/v1/deliveries`  
**Headers**: `Content-Type: application/json`

---

## Delivery 1 - Pending (Notes)

```json
{
  "phone": "612345678",
  "customer_name": "Jean Dupont",
  "items": "2 robes + 1 sac",
  "amount_due": 15000,
  "amount_paid": 0,
  "status": "pending",
  "quartier": "Bonapriso",
  "notes": "Customer prefers morning delivery"
}
```

## Delivery 2 - Pending (Partial Payment + Carrier)

```json
{
  "phone": "698765432",
  "customer_name": "Marie Martin",
  "items": "3 chemises",
  "amount_due": 20000,
  "amount_paid": 5000,
  "status": "pending",
  "quartier": "Akwa",
  "carrier": "Express Delivery"
}
```

## Delivery 3 - Pending (Fragile Items)

```json
{
  "phone": "655444333",
  "customer_name": "Pierre Kouam",
  "items": "1 pantalon + 2 t-shirts",
  "amount_due": 25000,
  "amount_paid": 0,
  "status": "pending",
  "quartier": "Makepe",
  "notes": "Fragile items"
}
```

## Delivery 4 - Pending (Partial Payment)

```json
{
  "phone": "677888999",
  "customer_name": "Sophie Ngono",
  "items": "5 articles divers",
  "amount_due": 30000,
  "amount_paid": 10000,
  "status": "pending",
  "quartier": "Bepanda"
}
```

## Delivery 5 - Pending (High Value)

```json
{
  "phone": "644555666",
  "customer_name": "David Mbarga",
  "items": "1 costume complet",
  "amount_due": 45000,
  "amount_paid": 0,
  "status": "pending",
  "quartier": "Douala Centre",
  "carrier": "Fast Track"
}
```

## Delivery 6 - Pickup (Fully Paid)

```json
{
  "phone": "611222333",
  "customer_name": "Anna Tchouassi",
  "items": "4 robes",
  "amount_due": 35000,
  "amount_paid": 35000,
  "status": "pickup",
  "quartier": "Bali",
  "notes": "Fully paid, ready for delivery"
}
```

## Delivery 7 - Pickup (Partial Payment)

```json
{
  "phone": "622333444",
  "customer_name": "Paul Fokou",
  "items": "2 pantalons",
  "amount_due": 18000,
  "amount_paid": 9000,
  "status": "pickup",
  "quartier": "New Bell",
  "carrier": "Standard Delivery"
}
```

## Delivery 8 - Pickup (High Value Item)

```json
{
  "phone": "633444555",
  "customer_name": "Lucie Bikoko",
  "items": "1 robe de soirée",
  "amount_due": 50000,
  "amount_paid": 25000,
  "status": "pickup",
  "quartier": "Bonanjo",
  "notes": "High value item"
}
```

## Delivery 9 - Pickup (Fully Paid)

```json
{
  "phone": "644555777",
  "customer_name": "Eric Nkeng",
  "items": "3 chemises + 2 cravates",
  "amount_due": 28000,
  "amount_paid": 28000,
  "status": "pickup",
  "quartier": "Logpom"
}
```

## Delivery 10 - Pickup (No Payment)

```json
{
  "phone": "655666888",
  "customer_name": "Grace Manga",
  "items": "6 articles enfants",
  "amount_due": 22000,
  "amount_paid": 0,
  "status": "pickup",
  "quartier": "Kotto",
  "carrier": "Express Delivery"
}
```

## Delivery 11 - Delivered (Large Amount)

```json
{
  "phone": "666777999",
  "customer_name": "Thomas Ndi",
  "items": "2 costumes",
  "amount_due": 90000,
  "amount_paid": 90000,
  "status": "delivered",
  "quartier": "Deido",
  "notes": "Delivered on time"
}
```

## Delivery 12 - Delivered

```json
{
  "phone": "677888111",
  "customer_name": "Claire Mboumba",
  "items": "4 robes + 2 sacs",
  "amount_due": 55000,
  "amount_paid": 55000,
  "status": "delivered",
  "quartier": "Wouri"
}
```

## Delivery 13 - Delivered (Premium)

```json
{
  "phone": "688999222",
  "customer_name": "Marc Ebongue",
  "items": "1 complet + 3 chemises",
  "amount_due": 75000,
  "amount_paid": 75000,
  "status": "delivered",
  "quartier": "Pk8",
  "carrier": "Premium Delivery"
}
```

## Delivery 14 - Delivered (Satisfied Customer)

```json
{
  "phone": "699111333",
  "customer_name": "Jacqueline Ngué",
  "items": "5 robes",
  "amount_due": 40000,
  "amount_paid": 40000,
  "status": "delivered",
  "quartier": "Mbanga",
  "notes": "Customer satisfied"
}
```

## Delivery 15 - Delivered

```json
{
  "phone": "611333555",
  "customer_name": "Daniel Mfoumbou",
  "items": "2 pantalons + 1 veste",
  "amount_due": 32000,
  "amount_paid": 32000,
  "status": "delivered",
  "quartier": "Nkongsamba"
}
```

## Delivery 16 - Failed (Wrong Address)

```json
{
  "phone": "622444666",
  "customer_name": "Patrice Ngo",
  "items": "3 chemises",
  "amount_due": 24000,
  "amount_paid": 12000,
  "status": "failed",
  "quartier": "Limbe",
  "notes": "Wrong address, customer not found"
}
```

## Delivery 17 - Failed (Canceled)

```json
{
  "phone": "633555777",
  "customer_name": "Ruth Mbeki",
  "items": "1 robe de mariée",
  "amount_due": 120000,
  "amount_paid": 60000,
  "status": "failed",
  "quartier": "Buea",
  "carrier": "Special Delivery",
  "notes": "Customer canceled order"
}
```

## Delivery 18 - Failed (Damaged)

```json
{
  "phone": "644666888",
  "customer_name": "Samuel Tcheuko",
  "items": "4 t-shirts",
  "amount_due": 15000,
  "amount_paid": 0,
  "status": "failed",
  "quartier": "Kribi",
  "notes": "Package damaged, return to sender"
}
```

## Delivery 19 - Pending (Large Order + Partial Payment)

```json
{
  "phone": "655777999",
  "customer_name": "Esther Mbala",
  "items": "10 articles divers",
  "amount_due": 85000,
  "amount_paid": 50000,
  "status": "pending",
  "quartier": "Edea",
  "carrier": "Bulk Delivery",
  "notes": "Large order, partial payment received"
}
```

## Delivery 20 - Delivered (VIP Customer)

```json
{
  "phone": "666888111",
  "customer_name": "André Mvondo",
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

## 📋 Postman Setup

1. **Method**: POST
2. **URL**: `http://localhost:3000/api/v1/deliveries`
3. **Headers**:
   - `Content-Type: application/json`
4. **Body**: Select "raw" and "JSON", then paste one of the JSON bodies above

## ✅ Quick Copy for Postman Collection

You can copy all 20 deliveries and save them in Postman as a collection, or post them one by one.

---

## 🎯 Summary by Status

- **Pending**: 8 deliveries (IDs: 1-5, 19)
- **Pickup**: 5 deliveries (IDs: 6-10)
- **Delivered**: 5 deliveries (IDs: 11-15, 20)
- **Failed**: 3 deliveries (IDs: 16-18)
