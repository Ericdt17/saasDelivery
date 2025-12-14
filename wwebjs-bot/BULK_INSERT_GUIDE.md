# 📦 Bulk Insert Guide

## How to Insert Multiple Deliveries at Once

### Endpoint
```
POST http://localhost:3000/api/v1/deliveries/bulk
```

### Request Format

**Headers:**
- `Content-Type: application/json`

**Body:**
```json
{
  "deliveries": [
    {
      "phone": "612345678",
      "items": "2 robes + 1 sac",
      "amount_due": 15000,
      "amount_paid": 0,
      "status": "pending",
      "quartier": "Bonapriso"
    },
    {
      "phone": "698765432",
      "items": "3 chemises",
      "amount_due": 20000,
      "amount_paid": 5000,
      "status": "pending",
      "quartier": "Akwa",
      "carrier": "Express Delivery"
    },
    {
      "phone": "655444333",
      "items": "1 pantalon",
      "amount_due": 25000,
      "status": "pending",
      "quartier": "Makepe"
    }
  ]
}
```

### Response Format

**Success Response (201):**
```json
{
  "success": true,
  "message": "Created 3 delivery/deliveries, 0 failed",
  "created": 3,
  "failed": 0,
  "results": {
    "success": [
      {
        "index": 0,
        "id": 1,
        "data": { /* delivery object */ }
      },
      {
        "index": 1,
        "id": 2,
        "data": { /* delivery object */ }
      }
    ],
    "failed": []
  }
}
```

**Partial Success (201):**
If some deliveries fail validation:
```json
{
  "success": true,
  "message": "Created 2 delivery/deliveries, 1 failed",
  "created": 2,
  "failed": 1,
  "results": {
    "success": [ /* successful deliveries */ ],
    "failed": [
      {
        "index": 2,
        "data": { /* original data */ },
        "error": "Missing required fields: phone, items, amount_due"
      }
    ]
  }
}
```

### Required Fields (per delivery)
- ✅ `phone` (required)
- ✅ `items` (required)
- ✅ `amount_due` (required)

### Optional Fields (per delivery)
- `amount_paid` (default: 0)
- `status` (default: "pending")
- `quartier`
- `carrier`
- `notes`

### Limits
- **Maximum 100 deliveries** per bulk insert request
- Minimum 1 delivery required

### Example: Insert All 20 Deliveries

**Copy this JSON body to Postman:**

```json
{
  "deliveries": [
    {
      "phone": "612345678",
      "items": "2 robes + 1 sac",
      "amount_due": 15000,
      "amount_paid": 0,
      "status": "pending",
      "quartier": "Bonapriso",
      "notes": "Customer prefers morning delivery"
    },
    {
      "phone": "698765432",
      "items": "3 chemises",
      "amount_due": 20000,
      "amount_paid": 5000,
      "status": "pending",
      "quartier": "Akwa",
      "carrier": "Express Delivery"
    },
    {
      "phone": "655444333",
      "items": "1 pantalon + 2 t-shirts",
      "amount_due": 25000,
      "amount_paid": 0,
      "status": "pending",
      "quartier": "Makepe",
      "notes": "Fragile items"
    },
    {
      "phone": "677888999",
      "items": "5 articles divers",
      "amount_due": 30000,
      "amount_paid": 10000,
      "status": "pending",
      "quartier": "Bepanda"
    },
    {
      "phone": "644555666",
      "items": "1 costume complet",
      "amount_due": 45000,
      "amount_paid": 0,
      "status": "pending",
      "quartier": "Douala Centre",
      "carrier": "Fast Track"
    },
    {
      "phone": "611222333",
      "items": "4 robes",
      "amount_due": 35000,
      "amount_paid": 35000,
      "status": "pickup",
      "quartier": "Bali",
      "notes": "Fully paid, ready for delivery"
    },
    {
      "phone": "622333444",
      "items": "2 pantalons",
      "amount_due": 18000,
      "amount_paid": 9000,
      "status": "pickup",
      "quartier": "New Bell",
      "carrier": "Standard Delivery"
    },
    {
      "phone": "633444555",
      "items": "1 robe de soirée",
      "amount_due": 50000,
      "amount_paid": 25000,
      "status": "pickup",
      "quartier": "Bonanjo",
      "notes": "High value item"
    },
    {
      "phone": "644555777",
      "items": "3 chemises + 2 cravates",
      "amount_due": 28000,
      "amount_paid": 28000,
      "status": "pickup",
      "quartier": "Logpom"
    },
    {
      "phone": "655666888",
      "items": "6 articles enfants",
      "amount_due": 22000,
      "amount_paid": 0,
      "status": "pickup",
      "quartier": "Kotto",
      "carrier": "Express Delivery"
    },
    {
      "phone": "666777999",
      "items": "2 costumes",
      "amount_due": 90000,
      "amount_paid": 90000,
      "status": "delivered",
      "quartier": "Deido",
      "notes": "Delivered on time"
    },
    {
      "phone": "677888111",
      "items": "4 robes + 2 sacs",
      "amount_due": 55000,
      "amount_paid": 55000,
      "status": "delivered",
      "quartier": "Wouri"
    },
    {
      "phone": "688999222",
      "items": "1 complet + 3 chemises",
      "amount_due": 75000,
      "amount_paid": 75000,
      "status": "delivered",
      "quartier": "Pk8",
      "carrier": "Premium Delivery"
    },
    {
      "phone": "699111333",
      "items": "5 robes",
      "amount_due": 40000,
      "amount_paid": 40000,
      "status": "delivered",
      "quartier": "Mbanga",
      "notes": "Customer satisfied"
    },
    {
      "phone": "611333555",
      "items": "2 pantalons + 1 veste",
      "amount_due": 32000,
      "amount_paid": 32000,
      "status": "delivered",
      "quartier": "Nkongsamba"
    },
    {
      "phone": "622444666",
      "items": "3 chemises",
      "amount_due": 24000,
      "amount_paid": 12000,
      "status": "failed",
      "quartier": "Limbe",
      "notes": "Wrong address, customer not found"
    },
    {
      "phone": "633555777",
      "items": "1 robe de mariée",
      "amount_due": 120000,
      "amount_paid": 60000,
      "status": "failed",
      "quartier": "Buea",
      "carrier": "Special Delivery",
      "notes": "Customer canceled order"
    },
    {
      "phone": "644666888",
      "items": "4 t-shirts",
      "amount_due": 15000,
      "amount_paid": 0,
      "status": "failed",
      "quartier": "Kribi",
      "notes": "Package damaged, return to sender"
    },
    {
      "phone": "655777999",
      "items": "10 articles divers",
      "amount_due": 85000,
      "amount_paid": 50000,
      "status": "pending",
      "quartier": "Edea",
      "carrier": "Bulk Delivery",
      "notes": "Large order, partial payment received"
    },
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
  ]
}
```

---

## Postman Setup

1. **Method**: POST
2. **URL**: `http://localhost:3000/api/v1/deliveries/bulk`
3. **Headers**: `Content-Type: application/json`
4. **Body**: raw → JSON → Paste the JSON above
5. **Send**

---

## Benefits

- ✅ Insert multiple deliveries in one request
- ✅ Faster than individual requests
- ✅ Detailed results for each delivery (success/failure)
- ✅ Continues processing even if some deliveries fail
- ✅ Returns IDs of created deliveries









