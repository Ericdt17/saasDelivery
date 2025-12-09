# 🌱 Seed Deliveries Script

This script creates 20 deliveries with different scenarios for testing and database manipulation.

## Usage

### Step 1: Start the API Server
Make sure the API server is running:
```bash
npm run api
```

### Step 2: Run the Seed Script
In a new terminal:
```bash
npm run seed
```

## What Gets Created

The script creates 20 deliveries with these scenarios:

### **Pending Deliveries** (5 deliveries)
- Different amounts and payment statuses
- Various items and neighborhoods
- Some with carriers assigned

### **Pickup Status** (5 deliveries)
- Items picked up but not yet delivered
- Mix of partial and full payments
- Ready for delivery status

### **Delivered Successfully** (5 deliveries)
- Completed deliveries
- All fully paid
- Various neighborhoods and carriers

### **Failed Deliveries** (3 deliveries)
- Various failure reasons
- Partial payments
- Different failure scenarios

### **Special Cases** (2 deliveries)
- Large orders
- VIP customers
- Bulk deliveries
- High-value items

## Scenarios Included

1. **Pending with notes** - Customer preferences
2. **Partial payment pending** - Some amount paid
3. **Fragile items** - Special handling notes
4. **High value items** - Premium pricing
5. **Fully paid pickup** - Ready for delivery
6. **Partial payment pickup** - In transit
7. **Delivered with satisfaction** - Happy customers
8. **Failed - wrong address** - Delivery issues
9. **Failed - canceled** - Customer cancellations
10. **Failed - damaged** - Package issues
11. **Large orders** - Bulk deliveries
12. **VIP customers** - Premium service

## Testing Different Statuses

After seeding, you can test:

1. **Filter by status**:
   ```
   GET /api/v1/deliveries?status=pending
   GET /api/v1/deliveries?status=delivered
   GET /api/v1/deliveries?status=failed
   GET /api/v1/deliveries?status=pickup
   ```

2. **Update statuses**:
   ```
   PUT /api/v1/deliveries/{id}
   { "status": "delivered" }
   ```

3. **View statistics**:
   ```
   GET /api/v1/stats/daily
   ```

4. **Search deliveries**:
   ```
   GET /api/v1/search?q=612345678
   ```

## Data Created

- **Total**: 20 deliveries
- **Statuses**: pending (8), pickup (5), delivered (5), failed (3)
- **Neighborhoods**: 20 different quartiers
- **Payment range**: 0 FCFA to 150,000 FCFA
- **Various carriers**: Express, Standard, Premium, etc.

Perfect for testing filters, statistics, updates, and different delivery scenarios!

