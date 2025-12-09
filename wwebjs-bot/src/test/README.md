# 🧪 Test Suite

This test suite covers all scenarios from `TEST_SCENARIOS.md`.

## Why 59 Tests?

The test suite contains **59 individual test assertions** organized into **9 main test scenarios**:

- Each scenario tests multiple aspects (parsing, extraction, validation, database operations)
- Each assertion validates a specific behavior or edge case
- The 9 main scenarios are high-level workflows, but each contains 3-8 detailed tests

For example, "Scenario 1: Create Delivery" has 7 tests that verify:

- Message parsing works
- Each field (phone, items, amount, quartier) is extracted correctly
- The message is identified as a delivery message
- The delivery can be created in the database

This granular testing ensures every feature works correctly!

## Running Tests

```bash
npm test
```

Or directly:

```bash
node src/test/scenarios.test.js
```

## Test Coverage

The test suite has **59 individual test assertions** organized into **9 main scenarios** plus error handling and edge cases.

### ✅ Success Scenarios (9 main scenarios, ~47 tests)

#### Scenario 1: Create Delivery (7 tests)

- ✅ Parse delivery message correctly
- ✅ Extract phone number
- ✅ Extract items
- ✅ Extract amount (15k = 15000)
- ✅ Extract quartier
- ✅ Detect as delivery message
- ✅ Create delivery in database

#### Scenario 2: Mark as Delivered (7 tests)

- ✅ Detect as status update
- ✅ NOT detect as delivery message
- ✅ Parse status update
- ✅ Identify as 'delivered' type
- ✅ Extract phone number
- ✅ Find delivery by phone
- ✅ Update status to 'delivered'

#### Scenario 3: Mark as Failed (6 tests)

- ✅ Parse delivery message
- ✅ Identify as 'failed' type
- ✅ Extract phone number
- ✅ Identify 'Numéro ne passe pas' as failed (alternative format)
- ✅ Update status to 'failed'

#### Scenario 4: Collect Payment (8 tests)

- ✅ Identify as 'payment' type
- ✅ Extract amount (5k = 5000)
- ✅ Extract phone number
- ✅ Update amount_paid to 5000
- ✅ Keep amount_due as 12000
- ✅ Extract amount (7k = 7000)
- ✅ Update to full payment
- ✅ Auto-mark as delivered when fully paid

#### Scenario 5: Customer Pickup (4 tests)

- ✅ Identify as 'pickup' type
- ✅ Identify 'Pickup' as pickup type (English variant)
- ✅ Identify 'Ramassage' as pickup type (French variant)
- ✅ Update status to 'pickup'

#### Scenario 6: Modify Items/Amount (6 tests)

- ✅ Identify as 'modify' type
- ✅ Extract new items from modify message
- ✅ Update items
- ✅ Extract new amount (20000)
- ✅ Update amount_due

#### Scenario 7: Change Phone Number (5 tests)

- ✅ Identify as 'number_change' type
- ✅ Extract old phone number
- ✅ Extract new phone number
- ✅ Find delivery by new phone number
- ✅ Update phone number

#### Scenario 8: Mark as Pending (3 tests)

- ✅ Identify as 'pending' type
- ✅ Extract phone number
- ✅ Update status to 'pending'

#### Scenario 9: Multiple Payments (7 tests)

- ✅ First payment: 10k
- ✅ Record first payment
- ✅ Second payment: 15k
- ✅ Accumulate to 25000
- ✅ Final payment: 5k
- ✅ Reach full payment
- ✅ Auto-mark as delivered

### ❌ Error Scenarios (5 tests)

1. ✅ Status update without phone number
2. ✅ Status update for non-existent delivery
3. ✅ Invalid phone number format (not starting with 6)
4. ✅ Invalid delivery message format
5. ✅ Parse phone number even in error case

### 📋 Edge Cases (7 tests)

- ✅ Various amount formats (15k, 15000, 15.000, etc.)
- ✅ Various phone number formats (612345678, 6xx345678, +237, etc.)
- ✅ Status message variations

**Total: 59 test assertions** across all scenarios

## Test Results

The test suite will output:

- ✅ Passed tests
- ❌ Failed tests (with details)
- Summary statistics
- Success rate

## Notes

- Tests use mock data for isolation
- All tests are deterministic and can be run multiple times
- Tests validate both parsing and database operations (via mocks)
- Each scenario matches the examples in `TEST_SCENARIOS.md`
