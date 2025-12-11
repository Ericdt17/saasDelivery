# Test Scenarios - Detailed Use Cases

This document provides detailed test scenarios with step-by-step instructions and expected results.

---

## Scenario 1: Initial Setup and Super Admin Creation

### Objective
Verify that the system can be set up from scratch and a super admin account can be created.

### Prerequisites
- Fresh database (SQLite or PostgreSQL)
- Node.js and npm installed
- Environment variables configured

### Steps
1. Navigate to `wwebjs-bot` directory
2. Install dependencies: `npm install`
3. Run seed script: `npm run seed:admin`
4. Verify output shows super admin created
5. Start API server: `npm run api`
6. Test login via API or frontend

### Expected Results
- ✅ Seed script completes without errors
- ✅ Console shows: "Super admin created successfully!"
- ✅ Super admin credentials work for login
- ✅ API server starts without errors
- ✅ Health check endpoint returns 200

### Test Command
```bash
cd wwebjs-bot
npm run seed:admin
# Expected output includes: "✅ Super admin created successfully!"
```

---

## Scenario 2: Complete Authentication Flow

### Objective
Test the complete authentication flow from login to accessing protected resources.

### Steps
1. **Login as Super Admin**
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@livrexpress.com","password":"admin123"}'
   ```
   - Save the `token` from response

2. **Get Current User**
   ```bash
   curl http://localhost:3000/api/v1/auth/me \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Access Protected Resource**
   ```bash
   curl http://localhost:3000/api/v1/deliveries \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. **Test Invalid Token**
   ```bash
   curl http://localhost:3000/api/v1/deliveries \
     -H "Authorization: Bearer invalid_token"
   ```

### Expected Results
- ✅ Login returns 200 with token
- ✅ `/auth/me` returns user info
- ✅ Protected routes work with valid token
- ✅ Invalid token returns 401
- ✅ Missing token returns 401

---

## Scenario 3: Multi-Agency Data Isolation

### Objective
Verify that agency admins can only see their own data and super admin can see all data.

### Setup
1. Create Agency A: "Test Agency A" (email: `agencya@test.com`, password: `pass123`)
2. Create Agency B: "Test Agency B" (email: `agencyb@test.com`, password: `pass123`)
3. Create 5 deliveries for Agency A
4. Create 3 deliveries for Agency B
5. Create 2 groups for Agency A
6. Create 1 group for Agency B

### Test Steps

#### 3.1 Agency A Admin View
1. Login as Agency A admin
2. GET `/api/v1/deliveries`
   - **Expected**: Only 5 deliveries (Agency A's)
3. GET `/api/v1/groups`
   - **Expected**: Only 2 groups (Agency A's)
4. GET `/api/v1/stats/daily`
   - **Expected**: Stats only for Agency A's deliveries

#### 3.2 Agency B Admin View
1. Login as Agency B admin
2. GET `/api/v1/deliveries`
   - **Expected**: Only 3 deliveries (Agency B's)
3. GET `/api/v1/groups`
   - **Expected**: Only 1 group (Agency B's)
4. GET `/api/v1/stats/daily`
   - **Expected**: Stats only for Agency B's deliveries

#### 3.3 Super Admin View
1. Login as super admin
2. GET `/api/v1/deliveries`
   - **Expected**: All 8 deliveries (from both agencies)
3. GET `/api/v1/groups`
   - **Expected**: All 3 groups (from both agencies)
4. GET `/api/v1/stats/daily`
   - **Expected**: Aggregated stats from all agencies

### Expected Results
- ✅ Each agency admin sees only their data
- ✅ Super admin sees all data
- ✅ No data leakage between agencies
- ✅ Statistics are correctly filtered

---

## Scenario 4: Super Admin Agency Management

### Objective
Test complete CRUD operations for agencies by super admin.

### Steps

#### 4.1 Create Agency
1. Login as super admin
2. POST `/api/v1/agencies`:
   ```json
   {
     "name": "New Agency",
     "email": "newagency@test.com",
     "password": "securepass123",
     "role": "agency",
     "is_active": true
   }
   ```
3. Verify agency created
4. Login with new agency credentials

#### 4.2 Update Agency
1. GET `/api/v1/agencies` to find agency ID
2. PUT `/api/v1/agencies/{id}`:
   ```json
   {
     "name": "Updated Agency Name",
     "is_active": true
   }
   ```
3. Verify name updated
4. GET `/api/v1/agencies/{id}` to confirm

#### 4.3 Update Agency Password
1. PUT `/api/v1/agencies/{id}`:
   ```json
   {
     "password": "newpassword123"
   }
   ```
2. Try login with old password (should fail)
3. Try login with new password (should succeed)

#### 4.4 Deactivate Agency
1. PUT `/api/v1/agencies/{id}`:
   ```json
   {
     "is_active": false
   }
   ```
2. Try login as deactivated agency (should fail)
3. Verify agency still exists in database

#### 4.5 Delete Agency (Soft Delete)
1. DELETE `/api/v1/agencies/{id}`
2. Verify `is_active` set to `false`
3. Verify agency cannot login
4. Verify data still exists

### Expected Results
- ✅ All CRUD operations work correctly
- ✅ Password updates work
- ✅ Deactivation prevents login
- ✅ Soft delete preserves data

---

## Scenario 5: WhatsApp Group Auto-Registration

### Objective
Test automatic group registration when messages are received from WhatsApp groups.

### Prerequisites
- WhatsApp bot running and connected
- `DEFAULT_AGENCY_ID` set in environment or config
- Access to WhatsApp groups for testing

### Steps

#### 5.1 New Group Registration
1. Send a delivery message from a new WhatsApp group
2. Check database:
   ```sql
   SELECT * FROM groups WHERE whatsapp_group_id = 'group_id_from_whatsapp';
   ```
3. Check delivery:
   ```sql
   SELECT * FROM deliveries WHERE group_id = (SELECT id FROM groups WHERE whatsapp_group_id = '...');
   ```

#### 5.2 Existing Group Reuse
1. Send another message from the same group
2. Check database for duplicate groups
3. Verify delivery linked to existing group

#### 5.3 Group Name Extraction
1. Send message from group with a clear name
2. Verify group `name` field populated

### Expected Results
- ✅ New groups automatically created
- ✅ Groups linked to correct agency
- ✅ Deliveries linked to correct group
- ✅ No duplicate groups created
- ✅ Group names extracted correctly

### Database Verification Queries
```sql
-- Check all groups
SELECT g.id, g.name, g.whatsapp_group_id, g.agency_id, a.name as agency_name
FROM groups g
LEFT JOIN agencies a ON g.agency_id = a.id;

-- Check deliveries with groups
SELECT d.id, d.phone, d.items, g.name as group_name, a.name as agency_name
FROM deliveries d
LEFT JOIN groups g ON d.group_id = g.id
LEFT JOIN agencies a ON d.agency_id = a.id
ORDER BY d.created_at DESC
LIMIT 10;
```

---

## Scenario 6: Frontend Authentication Flow

### Objective
Test complete authentication flow in the frontend application.

### Steps

#### 6.1 Initial Access
1. Open frontend application (e.g., `http://localhost:5173`)
2. Try to access `/livraisons` directly
3. **Expected**: Redirected to `/login`

#### 6.2 Login
1. Enter super admin credentials
2. Click "Se connecter"
3. **Expected**: 
   - Redirects to dashboard
   - Header shows user info
   - Sidebar shows "Agences" menu (super admin)

#### 6.3 Navigation
1. Navigate to different pages:
   - Dashboard (`/`)
   - Livraisons (`/livraisons`)
   - Groupes (`/groupes`)
   - Agences (`/agences`) - super admin only
2. **Expected**: All pages accessible, no redirects

#### 6.4 Logout
1. Click user menu in header
2. Click "Déconnexion"
3. **Expected**: 
   - Redirected to `/login`
   - Token cleared from localStorage
   - Cannot access protected routes

#### 6.5 Agency Admin Login
1. Login as agency admin
2. Check sidebar
3. **Expected**: 
   - "Agences" menu NOT visible
   - "Groupes" menu visible
   - Can access deliveries, stats, etc.

### Expected Results
- ✅ All authentication flows work correctly
- ✅ Role-based UI displayed correctly
- ✅ Protected routes work as expected
- ✅ Logout clears session properly

---

## Scenario 7: Error Handling and Edge Cases

### Objective
Test error handling and edge cases to ensure system robustness.

### Test Cases

#### 7.1 Invalid Login Credentials
- **Test**: Login with wrong password
- **Expected**: 401 error, clear message, no token

#### 7.2 Expired Token
- **Test**: Use expired token (modify JWT expiry or wait)
- **Expected**: 401 error, message about expired session

#### 7.3 Missing Required Fields
- **Test**: Create agency without email
- **Expected**: 400 error, validation message

#### 7.4 Duplicate Email
- **Test**: Create two agencies with same email
- **Expected**: 409 error, "already exists" message

#### 7.5 Access Denied
- **Test**: Agency admin tries to access `/api/v1/agencies`
- **Expected**: 403 error, "Access denied" message

#### 7.6 Database Connection Loss
- **Test**: Stop database, make API request
- **Expected**: 503 error, "Database connection failed"

#### 7.7 Empty Results
- **Test**: Query with no matching data
- **Expected**: 200 with empty array, no errors

#### 7.8 Invalid JSON
- **Test**: Send malformed JSON in request body
- **Expected**: 400 error, "Invalid JSON format"

### Expected Results
- ✅ All errors return appropriate status codes
- ✅ Error messages are clear and helpful
- ✅ System doesn't crash on errors
- ✅ Errors logged for debugging

---

## Scenario 8: Performance and Load Testing

### Objective
Test system performance with multiple requests and concurrent users.

### Test Cases

#### 8.1 Multiple Concurrent Logins
- **Test**: 10 simultaneous login requests
- **Expected**: All succeed, no race conditions

#### 8.2 Large Data Sets
- **Test**: Query deliveries with 1000+ records
- **Expected**: Pagination works, response time acceptable

#### 8.3 Rapid API Calls
- **Test**: 100 rapid requests to same endpoint
- **Expected**: All succeed, no timeouts

### Expected Results
- ✅ System handles concurrent requests
- ✅ Pagination works for large datasets
- ✅ Response times acceptable (< 1s for most requests)

---

## Scenario 9: Integration Testing

### Objective
Test complete workflows from start to finish.

### Workflow 1: New Agency Setup
1. Super admin creates new agency
2. Agency admin logs in
3. Agency admin views empty dashboard
4. WhatsApp group sends delivery message
5. Group auto-registered
6. Delivery created and linked to group
7. Agency admin sees delivery in dashboard
8. Agency admin views delivery details

### Workflow 2: Multi-Agency Operations
1. Super admin creates 3 agencies
2. Each agency admin logs in
3. Each creates/view their own data
4. Super admin views all data
5. Super admin deactivates one agency
6. Deactivated agency cannot login
7. Super admin can still see their data

### Expected Results
- ✅ Complete workflows function correctly
- ✅ No data leakage between agencies
- ✅ All features work together seamlessly

---

## Scenario 10: Security Testing

### Objective
Test security features and prevent common vulnerabilities.

### Test Cases

#### 10.1 SQL Injection
- **Test**: Try SQL injection in search/query parameters
- **Expected**: Input sanitized, no SQL executed

#### 10.2 XSS (Cross-Site Scripting)
- **Test**: Try XSS in input fields
- **Expected**: Input sanitized, no scripts executed

#### 10.3 CSRF Protection
- **Test**: Make request without proper headers
- **Expected**: CORS policy prevents unauthorized requests

#### 10.4 Password Security
- **Test**: Check password storage
- **Expected**: Passwords hashed (bcrypt), never in plain text

#### 10.5 Token Security
- **Test**: Try to modify or forge JWT token
- **Expected**: Invalid signature detected, request rejected

### Expected Results
- ✅ Common vulnerabilities prevented
- ✅ Security headers present
- ✅ Sensitive data protected

---

## Test Execution Log Template

Use this template to track test execution:

```
Date: ___________
Tester: ___________
Environment: [ ] Development [ ] Staging [ ] Production

Scenario 1: [ ] Pass [ ] Fail [ ] Skipped
Notes: _________________________________

Scenario 2: [ ] Pass [ ] Fail [ ] Skipped
Notes: _________________________________

Scenario 3: [ ] Pass [ ] Fail [ ] Skipped
Notes: _________________________________

...

Issues Found:
1. _________________________________
2. _________________________________
3. _________________________________

Overall Status: [ ] Ready for Production [ ] Needs Fixes
```

---

## Troubleshooting Guide

### Issue: Cannot login
- **Check**: Database connection
- **Check**: Super admin exists (`npm run seed:admin`)
- **Check**: Password correct
- **Check**: Agency is active (`is_active = true`)

### Issue: CORS errors
- **Check**: `ALLOWED_ORIGINS` environment variable
- **Check**: Frontend URL matches allowed origins
- **Check**: CORS middleware configured correctly

### Issue: Data not filtered
- **Check**: `agency_id` set correctly on records
- **Check**: User `agencyId` in JWT token
- **Check**: Middleware filtering logic

### Issue: Groups not auto-registering
- **Check**: WhatsApp bot running
- **Check**: `DEFAULT_AGENCY_ID` set
- **Check**: Group manager utility working
- **Check**: Database connection

### Issue: Token expired immediately
- **Check**: JWT secret configured
- **Check**: Token expiry time in config
- **Check**: System clock correct

---

**Last Updated**: Phase 6 - Step 3
**Version**: 1.0.0
