# Testing Checklist - Multi-Agency Delivery System

This document provides a comprehensive testing checklist for the multi-agency, multi-group delivery management system.

## Prerequisites

Before starting tests, ensure:
- [ ] Database is set up (SQLite or PostgreSQL)
- [ ] Super admin account is created (`npm run seed:admin`)
- [ ] API server is running (`npm run api` or `npm run api:dev`)
- [ ] Frontend is running (if testing UI)
- [ ] WhatsApp bot is running (if testing group auto-registration)

---

## 1. Authentication Flow Testing

### 1.1 Super Admin Login
- [ ] **Test**: Login with valid super admin credentials
  - **Steps**: 
    1. POST to `/api/v1/auth/login` with `{ email: "admin@livrexpress.com", password: "admin123" }`
  - **Expected**: 
    - Status: 200
    - Response contains `token` and `user` object
    - User role is `"super_admin"`
    - `agencyId` is `null`

- [ ] **Test**: Login with invalid credentials
  - **Steps**: 
    1. POST to `/api/v1/auth/login` with wrong password
  - **Expected**: 
    - Status: 401
    - Error message: "Email ou mot de passe incorrect"

- [ ] **Test**: Login with missing fields
  - **Steps**: 
    1. POST to `/api/v1/auth/login` with only email
  - **Expected**: 
    - Status: 400
    - Validation error message

### 1.2 Agency Admin Login
- [ ] **Test**: Login with valid agency admin credentials
  - **Steps**: 
    1. Create an agency account (as super admin)
    2. Login with agency credentials
  - **Expected**: 
    - Status: 200
    - Response contains `token` and `user` object
    - User role is `"agency"`
    - `agencyId` matches the created agency

### 1.3 Token Validation
- [ ] **Test**: Access protected route with valid token
  - **Steps**: 
    1. Login to get token
    2. GET `/api/v1/auth/me` with `Authorization: Bearer <token>`
  - **Expected**: 
    - Status: 200
    - Returns user information

- [ ] **Test**: Access protected route with expired token
  - **Steps**: 
    1. Use an expired token (modify JWT expiry or wait)
    2. GET `/api/v1/auth/me` with expired token
  - **Expected**: 
    - Status: 401
    - Error: "Your session has expired. Please login again."

- [ ] **Test**: Access protected route with invalid token
  - **Steps**: 
    1. GET `/api/v1/auth/me` with `Authorization: Bearer invalid_token`
  - **Expected**: 
    - Status: 401
    - Error: "Invalid authentication token. Please login again."

- [ ] **Test**: Access protected route without token
  - **Steps**: 
    1. GET `/api/v1/auth/me` without Authorization header
  - **Expected**: 
    - Status: 401
    - Error: "No token provided. Please login first."

### 1.4 Get Current User
- [ ] **Test**: Get current user info
  - **Steps**: 
    1. Login
    2. GET `/api/v1/auth/me`
  - **Expected**: 
    - Status: 200
    - Returns current user's information

---

## 2. Data Isolation Testing

### 2.1 Deliveries Isolation
- [ ] **Test**: Agency admin sees only their deliveries
  - **Steps**: 
    1. Create Agency A and Agency B
    2. Create deliveries for Agency A (as super admin or via WhatsApp)
    3. Create deliveries for Agency B
    4. Login as Agency A admin
    5. GET `/api/v1/deliveries`
  - **Expected**: 
    - Only deliveries with `agency_id` matching Agency A are returned
    - No deliveries from Agency B are visible

- [ ] **Test**: Super admin sees all deliveries
  - **Steps**: 
    1. Login as super admin
    2. GET `/api/v1/deliveries`
  - **Expected**: 
    - All deliveries from all agencies are returned

- [ ] **Test**: Agency admin cannot access other agency's delivery
  - **Steps**: 
    1. Create delivery for Agency A
    2. Login as Agency B admin
    3. GET `/api/v1/deliveries/{delivery_id_from_agency_a}`
  - **Expected**: 
    - Status: 404 or 403 (delivery not found or access denied)

### 2.2 Groups Isolation
- [ ] **Test**: Agency admin sees only their groups
  - **Steps**: 
    1. Create groups for Agency A and Agency B
    2. Login as Agency A admin
    3. GET `/api/v1/groups`
  - **Expected**: 
    - Only groups with `agency_id` matching Agency A are returned

- [ ] **Test**: Super admin sees all groups
  - **Steps**: 
    1. Login as super admin
    2. GET `/api/v1/groups`
  - **Expected**: 
    - All groups from all agencies are returned

### 2.3 Statistics Isolation
- [ ] **Test**: Agency admin sees only their stats
  - **Steps**: 
    1. Create deliveries for Agency A and Agency B
    2. Login as Agency A admin
    3. GET `/api/v1/stats/daily`
  - **Expected**: 
    - Stats only include deliveries from Agency A

- [ ] **Test**: Super admin sees aggregated stats
  - **Steps**: 
    1. Login as super admin
    2. GET `/api/v1/stats/daily`
  - **Expected**: 
    - Stats include deliveries from all agencies

### 2.4 Agencies List Access
- [ ] **Test**: Agency admin cannot access agencies endpoint
  - **Steps**: 
    1. Login as agency admin
    2. GET `/api/v1/agencies`
  - **Expected**: 
    - Status: 403
    - Error: "Access denied. Required role: super_admin"

- [ ] **Test**: Super admin can access agencies endpoint
  - **Steps**: 
    1. Login as super admin
    2. GET `/api/v1/agencies`
  - **Expected**: 
    - Status: 200
    - Returns list of all agencies

---

## 3. Super Admin Features Testing

### 3.1 Create Agency
- [ ] **Test**: Create agency with valid data
  - **Steps**: 
    1. Login as super admin
    2. POST `/api/v1/agencies` with:
       ```json
       {
         "name": "Test Agency",
         "email": "test@agency.com",
         "password": "password123",
         "role": "agency"
       }
       ```
  - **Expected**: 
    - Status: 201
    - Returns created agency (without password)
    - Agency can login with provided credentials

- [ ] **Test**: Create agency with duplicate email
  - **Steps**: 
    1. Create agency with email "test@agency.com"
    2. Try to create another agency with same email
  - **Expected**: 
    - Status: 409 or 400
    - Error: Email already exists

- [ ] **Test**: Create agency with invalid data
  - **Steps**: 
    1. POST `/api/v1/agencies` with missing required fields
  - **Expected**: 
    - Status: 400
    - Validation error message

- [ ] **Test**: Create another super admin
  - **Steps**: 
    1. POST `/api/v1/agencies` with `role: "super_admin"`
  - **Expected**: 
    - Status: 201
    - New super admin can login and access all features

### 3.2 Update Agency
- [ ] **Test**: Update agency name
  - **Steps**: 
    1. Create agency
    2. PUT `/api/v1/agencies/{id}` with new name
  - **Expected**: 
    - Status: 200
    - Agency name updated
    - `updated_at` timestamp changed

- [ ] **Test**: Update agency password
  - **Steps**: 
    1. Create agency
    2. PUT `/api/v1/agencies/{id}` with new password
    3. Try to login with new password
  - **Expected**: 
    - Status: 200
    - Old password no longer works
    - New password works

- [ ] **Test**: Update agency status (deactivate)
  - **Steps**: 
    1. Create agency
    2. PUT `/api/v1/agencies/{id}` with `is_active: false`
    3. Try to login as that agency
  - **Expected**: 
    - Status: 200
    - Login fails with inactive account message

### 3.3 Delete Agency (Soft Delete)
- [ ] **Test**: Delete agency
  - **Steps**: 
    1. Create agency
    2. DELETE `/api/v1/agencies/{id}`
  - **Expected**: 
    - Status: 200
    - Agency `is_active` set to `false`
    - Agency cannot login
    - Data still exists in database

### 3.4 View All Data
- [ ] **Test**: Super admin can view all agencies
  - **Steps**: 
    1. Create multiple agencies
    2. Login as super admin
    3. GET `/api/v1/agencies`
  - **Expected**: 
    - All agencies returned (active and inactive)

- [ ] **Test**: Super admin can view all groups
  - **Steps**: 
    1. Create groups for different agencies
    2. Login as super admin
    3. GET `/api/v1/groups`
  - **Expected**: 
    - All groups from all agencies returned

- [ ] **Test**: Super admin can view all deliveries
  - **Steps**: 
    1. Create deliveries for different agencies
    2. Login as super admin
    3. GET `/api/v1/deliveries`
  - **Expected**: 
    - All deliveries from all agencies returned

---

## 4. Group Auto-Registration Testing (WhatsApp)

### 4.1 New Group Detection
- [ ] **Test**: New WhatsApp group sends message
  - **Steps**: 
    1. Send message from a new WhatsApp group
    2. Check database for new group record
  - **Expected**: 
    - New group created in `groups` table
    - Group linked to default agency (or detected agency)
    - `whatsapp_group_id` stored correctly
    - Delivery (if created) linked to this group

- [ ] **Test**: Group name extraction
  - **Steps**: 
    1. Send message from group with name
    2. Check group record
  - **Expected**: 
    - Group `name` field populated with WhatsApp group name

### 4.2 Existing Group Handling
- [ ] **Test**: Existing group sends another message
  - **Steps**: 
    1. Send message from group (creates group)
    2. Send another message from same group
    3. Check database
  - **Expected**: 
    - No duplicate group created
    - Delivery linked to existing group
    - Group record unchanged

### 4.3 Delivery-Group Linking
- [ ] **Test**: Delivery linked to correct group
  - **Steps**: 
    1. Send delivery message from WhatsApp group
    2. Check delivery record
  - **Expected**: 
    - Delivery `group_id` matches the group
    - Delivery `agency_id` matches group's agency

---

## 5. API Endpoints Testing

### 5.1 Protected Routes
- [ ] **Test**: All protected routes require authentication
  - **Routes to test**:
    - GET `/api/v1/deliveries`
    - GET `/api/v1/groups`
    - GET `/api/v1/agencies`
    - GET `/api/v1/stats/daily`
  - **Expected**: 
    - All return 401 without token
    - All return 200 with valid token

### 5.2 Role-Based Access
- [ ] **Test**: Super admin routes
  - **Routes**: 
    - GET `/api/v1/agencies`
    - POST `/api/v1/agencies`
    - PUT `/api/v1/agencies/{id}`
    - DELETE `/api/v1/agencies/{id}`
  - **Steps**: 
    1. Login as agency admin
    2. Try to access these routes
  - **Expected**: 
    - Status: 403
    - Error: "Access denied. Required role: super_admin"

- [ ] **Test**: Agency admin routes
  - **Routes**: 
    - GET `/api/v1/deliveries`
    - GET `/api/v1/groups`
    - GET `/api/v1/stats/daily`
  - **Steps**: 
    1. Login as agency admin
    2. Access these routes
  - **Expected**: 
    - Status: 200
    - Data filtered by agency

### 5.3 Public Routes
- [ ] **Test**: Health check endpoint
  - **Steps**: 
    1. GET `/api/v1/health` without authentication
  - **Expected**: 
    - Status: 200
    - Returns health status

- [ ] **Test**: Login endpoint
  - **Steps**: 
    1. POST `/api/v1/auth/login` without authentication
  - **Expected**: 
    - Status: 200 or 401 (depending on credentials)
    - No authentication required

---

## 6. CORS and Headers Testing

### 6.1 CORS Preflight
- [ ] **Test**: OPTIONS request
  - **Steps**: 
    1. Send OPTIONS request to any endpoint
    2. Check response headers
  - **Expected**: 
    - Status: 200
    - Headers include:
      - `Access-Control-Allow-Origin`
      - `Access-Control-Allow-Methods`
      - `Access-Control-Allow-Headers`
      - `Access-Control-Allow-Credentials`

### 6.2 Cross-Origin Requests
- [ ] **Test**: Request from allowed origin
  - **Steps**: 
    1. Set `ALLOWED_ORIGINS` env var
    2. Send request from allowed origin
  - **Expected**: 
    - Request succeeds
    - CORS headers present

- [ ] **Test**: Request from blocked origin
  - **Steps**: 
    1. Send request from non-allowed origin (in production)
  - **Expected**: 
    - Status: 403
    - Error: "Not allowed by CORS"

### 6.3 Security Headers
- [ ] **Test**: Security headers present
  - **Steps**: 
    1. Make any API request
    2. Check response headers
  - **Expected**: 
    - `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `X-XSS-Protection: 1; mode=block`
    - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 7. Error Handling Testing

### 7.1 Network Errors
- [ ] **Test**: Database connection error
  - **Steps**: 
    1. Stop database
    2. Make API request
  - **Expected**: 
    - Status: 503
    - Error: "Database connection failed"

### 7.2 Validation Errors
- [ ] **Test**: Missing required fields
  - **Steps**: 
    1. POST `/api/v1/agencies` without email
  - **Expected**: 
    - Status: 400
    - Validation error message

- [ ] **Test**: Invalid email format
  - **Steps**: 
    1. POST `/api/v1/agencies` with invalid email
  - **Expected**: 
    - Status: 400
    - Validation error

### 7.3 Database Errors
- [ ] **Test**: Unique constraint violation
  - **Steps**: 
    1. Create agency with email
    2. Try to create another with same email
  - **Expected**: 
    - Status: 409
    - Error: "A record with this information already exists"

---

## 8. Frontend Integration Testing

### 8.1 Login Page
- [ ] **Test**: Form validation
  - **Steps**: 
    1. Try to submit empty form
    2. Try to submit with invalid email
  - **Expected**: 
    - Form validation errors displayed
    - Submit button disabled

- [ ] **Test**: Successful login
  - **Steps**: 
    1. Enter valid credentials
    2. Submit form
  - **Expected**: 
    - Redirects to dashboard
    - User info displayed in header
    - Token stored in localStorage

- [ ] **Test**: Failed login
  - **Steps**: 
    1. Enter invalid credentials
    2. Submit form
  - **Expected**: 
    - Error message displayed
    - Stays on login page
    - No redirect

### 8.2 Protected Routes
- [ ] **Test**: Redirect to login when not authenticated
  - **Steps**: 
    1. Clear localStorage
    2. Try to access `/livraisons`
  - **Expected**: 
    - Redirects to `/login`
    - After login, redirects back to intended page

- [ ] **Test**: Access granted when authenticated
  - **Steps**: 
    1. Login
    2. Navigate to protected routes
  - **Expected**: 
    - All routes accessible
    - No redirect to login

### 8.3 Role-Based UI
- [ ] **Test**: Super admin menu
  - **Steps**: 
    1. Login as super admin
    2. Check sidebar
  - **Expected**: 
    - "Agences" menu item visible
    - "Groupes" menu item visible

- [ ] **Test**: Agency admin menu
  - **Steps**: 
    1. Login as agency admin
    2. Check sidebar
  - **Expected**: 
    - "Agences" menu item NOT visible
    - "Groupes" menu item visible

- [ ] **Test**: Header user info
  - **Steps**: 
    1. Login
    2. Check header
  - **Expected**: 
    - User name/email displayed
    - Role badge shown (for super admin)
    - Logout button works

### 8.4 Data Display
- [ ] **Test**: Deliveries filtered correctly
  - **Steps**: 
    1. Login as agency admin
    2. View deliveries page
  - **Expected**: 
    - Only agency's deliveries shown
    - Group filter works
    - Group badges displayed

- [ ] **Test**: Groups filtered correctly
  - **Steps**: 
    1. Login as agency admin
    2. View groups page
  - **Expected**: 
    - Only agency's groups shown

- [ ] **Test**: Stats filtered correctly
  - **Steps**: 
    1. Login as agency admin
    2. View dashboard/stats
  - **Expected**: 
    - Stats only for agency
    - Header shows agency name

---

## 9. Database Operations Testing

### 9.1 Seed Script
- [ ] **Test**: Create super admin
  - **Steps**: 
    1. Run `npm run seed:admin`
  - **Expected**: 
    - Super admin created
    - Can login with credentials

- [ ] **Test**: Prevent duplicate super admin
  - **Steps**: 
    1. Run seed script
    2. Run seed script again
  - **Expected**: 
    - Message: "Super admin already exists"
    - No duplicate created

- [ ] **Test**: Works with SQLite
  - **Steps**: 
    1. Use SQLite database
    2. Run seed script
  - **Expected**: 
    - Script completes successfully
    - Super admin created

- [ ] **Test**: Works with PostgreSQL
  - **Steps**: 
    1. Use PostgreSQL database
    2. Run seed script
  - **Expected**: 
    - Script completes successfully
    - Super admin created

### 9.2 Migration
- [ ] **Test**: Existing data migration
  - **Steps**: 
    1. Have existing deliveries in database
    2. Run migration script
  - **Expected**: 
    - Default agency created
    - Default group created
    - Existing deliveries linked to default agency/group

---

## 10. Edge Cases Testing

### 10.1 Empty Database
- [ ] **Test**: System works with no data
  - **Steps**: 
    1. Start with empty database
    2. Login as super admin
    3. Access all pages
  - **Expected**: 
    - No crashes
    - Empty states displayed
    - Can create new data

### 10.2 Multiple Agencies
- [ ] **Test**: Data isolation with multiple agencies
  - **Steps**: 
    1. Create 3 agencies
    2. Create data for each
    3. Login as each agency
    4. Verify data isolation
  - **Expected**: 
    - Each agency sees only their data
    - No data leakage

### 10.3 Inactive Agencies
- [ ] **Test**: Inactive agency cannot login
  - **Steps**: 
    1. Create agency
    2. Deactivate agency
    3. Try to login
  - **Expected**: 
    - Login fails
    - Error: Account inactive

- [ ] **Test**: Super admin can see inactive agencies
  - **Steps**: 
    1. Deactivate agency
    2. Login as super admin
    3. View agencies list
  - **Expected**: 
    - Inactive agency visible
    - Status shown as "Inactive"

---

## Testing Notes

### Test Data Setup
Before running tests, you may want to:
1. Create test agencies with known credentials
2. Create test deliveries for each agency
3. Create test groups for each agency
4. Document test credentials for easy access

### Test Environment
- Use a separate test database if possible
- Or use a development environment
- Clear test data between test runs if needed

### Common Issues
- **CORS errors**: Check `ALLOWED_ORIGINS` environment variable
- **Authentication fails**: Verify JWT secret is set
- **Database errors**: Check database connection and schema
- **Data not filtered**: Verify `agency_id` is set correctly

---

## Quick Verification Script

Run this quick check to verify basic functionality:

```bash
# 1. Check API health
curl http://localhost:3000/api/v1/health

# 2. Create super admin (if not exists)
cd wwebjs-bot
npm run seed:admin

# 3. Test login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@livrexpress.com","password":"admin123"}'

# 4. Test protected route (use token from step 3)
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Test Completion Criteria

All tests should pass before considering the system production-ready:
- ✅ All authentication tests pass
- ✅ Data isolation verified for all endpoints
- ✅ Super admin features work correctly
- ✅ Group auto-registration works
- ✅ CORS configured properly
- ✅ Error handling works as expected
- ✅ Frontend integration complete
- ✅ Edge cases handled

---

**Last Updated**: Phase 6 - Step 3
**Version**: 1.0.0




