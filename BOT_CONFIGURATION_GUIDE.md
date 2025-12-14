# WhatsApp Bot Configuration Guide

## Overview

The WhatsApp bot is configured using **WhatsApp Web.js** library with the following key components:

1. **WhatsApp Client** - Connects to WhatsApp Web
2. **Local Authentication** - Saves session locally
3. **Database** - SQLite (local) or PostgreSQL (production)
4. **Message Parsing** - Processes delivery messages from WhatsApp
5. **API Server** - REST API for frontend integration

## Configuration Files

### 1. Main Configuration (`src/config.js`)

This file reads environment variables and provides configuration:

```javascript
// Database type: 'sqlite' or 'postgres'
DB_TYPE: process.env.DB_TYPE || "sqlite"

// SQLite database path
DB_PATH: process.env.DB_PATH || "./data/bot.db"

// PostgreSQL connection string
DATABASE_URL: process.env.DATABASE_URL || null

// WhatsApp Group ID (optional - if not set, listens to all groups)
GROUP_ID: process.env.GROUP_ID || null

// Daily report settings
REPORT_TIME: process.env.REPORT_TIME || "20:00"
REPORT_ENABLED: process.env.REPORT_ENABLED !== "false"
```

### 2. Bot Initialization (`src/index.js`)

The bot is initialized with these settings:

```javascript
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: process.env.WHATSAPP_SESSION_PATH || "./auth-dev"
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // ... other optimization flags
    ],
    timeout: 60000
  }
});
```

## Environment Variables Setup

### Local Development (`.env` file)

Create a `.env` file in `wwebjs-bot/` directory:

```bash
# Database Configuration
DB_TYPE=sqlite
DB_PATH=./data/bot.db

# OR for PostgreSQL:
# DB_TYPE=postgres
# DATABASE_URL=postgresql://user:password@localhost:5432/deliverybot

# API Configuration
API_PORT=3000
NODE_ENV=development

# JWT Secret (required for authentication)
JWT_SECRET=your-secret-key-here

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173

# WhatsApp Bot Configuration (optional)
GROUP_ID=                    # Leave empty to listen to all groups
REPORT_TIME=20:00          # Time to send daily report
REPORT_ENABLED=false        # Enable/disable automatic reports
SEND_CONFIRMATIONS=false   # Send confirmation messages to group

# WhatsApp Session Path (optional)
WHATSAPP_SESSION_PATH=./auth-dev  # Where to save WhatsApp session
```

### Production (Render/Environment Variables)

For production deployment on Render:

```bash
NODE_ENV=production
DB_TYPE=postgres
DATABASE_URL=<from-render-database>
JWT_SECRET=<secure-random-secret>
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

## Bot Features Configuration

### 1. WhatsApp Session Management

**Location**: `./auth-dev/` (local) or `./auth/` (production)

- Session is saved locally using `LocalAuth`
- QR code is generated for first-time authentication
- Session persists across restarts
- QR code saved as `qr-code.png` for easy scanning

**Configuration**:
```javascript
authStrategy: new LocalAuth({
  dataPath: process.env.WHATSAPP_SESSION_PATH || "./auth-dev"
})
```

### 2. Database Configuration

**SQLite (Default for Local)**:
- File: `./data/bot.db`
- No setup required
- Automatically created on first run

**PostgreSQL (Production)**:
- Requires `DATABASE_URL` environment variable
- Format: `postgresql://user:password@host:port/database`
- Schema automatically migrated on startup

**Configuration**:
```javascript
DB_TYPE: process.env.DB_TYPE || "sqlite"
DATABASE_URL: process.env.DATABASE_URL || null
```

### 3. Message Listening

**Group Filtering**:
- If `GROUP_ID` is set: Only listens to that specific group
- If `GROUP_ID` is empty: Listens to all groups

**Message Types Handled**:
1. **Delivery Messages** - Parsed and saved to database
2. **Status Updates** - Updates existing deliveries
3. **Commands** - Special commands (if implemented)

### 4. Daily Reports

**Configuration**:
```bash
REPORT_TIME=20:00          # 24-hour format (HH:MM)
REPORT_ENABLED=true        # Enable automatic reports
REPORT_SEND_TO_GROUP=true # Send to WhatsApp group
REPORT_RECIPIENT=          # Or send to specific number
```

**Features**:
- Automatic daily reports at specified time
- Can send to group or specific number
- Includes delivery statistics

### 5. Puppeteer Configuration

**Optimizations for Server Deployment**:
```javascript
puppeteer: {
  headless: true,           // No GUI (required for servers)
  args: [
    "--no-sandbox",        // Required for Docker/servers
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    // ... more optimization flags
  ],
  timeout: 60000           // 60 seconds to launch browser
}
```

## How the Bot Works

### 1. Startup Sequence

1. **Load Configuration** - Reads `.env` and `config.js`
2. **Initialize Database** - Connects to SQLite or PostgreSQL
3. **Create WhatsApp Client** - Sets up WhatsApp Web.js client
4. **Load Session** - Tries to load existing session from `auth-dev/`
5. **Generate QR Code** - If no session, generates QR code for authentication
6. **Start Listening** - Begins listening for messages once authenticated

### 2. Message Processing Flow

```
WhatsApp Message Received
    ↓
Check if it's a delivery message
    ↓
Parse message (phone, amount, address, etc.)
    ↓
Check if delivery already exists
    ↓
Create or update delivery in database
    ↓
Add history entry
    ↓
(Optional) Send confirmation to group
```

### 3. API Integration

The bot runs alongside an Express API server:

- **Bot Process**: `npm start` or `npm run dev` (runs `src/index.js`)
- **API Server**: `npm run api` (runs `src/api/server.js`)

Both can run simultaneously or separately.

## Running the Bot

### Development Mode

```bash
# Start bot with auto-reload
npm run dev

# OR start bot normally
npm start

# Start API server separately
npm run api
```

### Production Mode

```bash
# Start bot
npm start

# OR start API only (if bot not needed)
npm run api
```

## Authentication Process

### First Time Setup

1. Run `npm start` or `npm run dev`
2. Bot generates QR code (shown in terminal and saved as `qr-code.png`)
3. Open WhatsApp on your phone
4. Go to: **Settings → Linked Devices → Link a Device**
5. Scan the QR code
6. Session is saved to `./auth-dev/` directory
7. Bot stays authenticated across restarts

### Session Management

- **Session Location**: `./auth-dev/session/` (local) or `./auth/session/` (production)
- **Session Persistence**: Session persists until you log out from WhatsApp
- **Multiple Sessions**: Can have separate sessions for dev/prod using `WHATSAPP_SESSION_PATH`

## Troubleshooting

### Bot Not Starting

1. **Check Node.js version**: Requires Node.js 18+
2. **Check dependencies**: Run `npm install`
3. **Check environment variables**: Ensure `.env` file exists
4. **Check database**: Ensure database file/database is accessible

### QR Code Not Appearing

1. **Check console output**: QR code appears in terminal
2. **Check file**: `qr-code.png` should be created in project root
3. **Check permissions**: Ensure write permissions for session directory

### Session Issues

1. **Delete session**: Remove `./auth-dev/` directory
2. **Re-authenticate**: Restart bot and scan new QR code
3. **Check WhatsApp**: Ensure phone has internet connection

### Database Issues

1. **SQLite**: Check file permissions for `./data/bot.db`
2. **PostgreSQL**: Verify `DATABASE_URL` is correct
3. **Schema**: Run migrations if needed

## Configuration Examples

### Example 1: Local Development (SQLite)

```bash
# .env file
DB_TYPE=sqlite
DB_PATH=./data/bot.db
API_PORT=3000
NODE_ENV=development
JWT_SECRET=dev-secret-key
WHATSAPP_SESSION_PATH=./auth-dev
REPORT_ENABLED=false
```

### Example 2: Local Development (PostgreSQL)

```bash
# .env file
DB_TYPE=postgres
DATABASE_URL=postgresql://postgres:password@localhost:5432/deliverybot
API_PORT=3000
NODE_ENV=development
JWT_SECRET=dev-secret-key
WHATSAPP_SESSION_PATH=./auth-dev
```

### Example 3: Production (Render)

```bash
# Environment variables in Render dashboard
NODE_ENV=production
DB_TYPE=postgres
DATABASE_URL=<from-render-database>
JWT_SECRET=<secure-random-secret>
ALLOWED_ORIGINS=https://your-frontend.com
WHATSAPP_SESSION_PATH=./auth
REPORT_ENABLED=true
REPORT_TIME=20:00
REPORT_SEND_TO_GROUP=true
```

## Key Files

- `src/index.js` - Main bot entry point
- `src/config.js` - Configuration loader
- `src/parser.js` - Message parsing logic
- `src/db/index.js` - Database operations
- `src/api/server.js` - API server
- `.env` - Environment variables (not in git)
- `package.json` - Dependencies and scripts

## Next Steps

1. **Set up `.env` file** with your configuration
2. **Run `npm install`** to install dependencies
3. **Start the bot** with `npm start` or `npm run dev`
4. **Scan QR code** to authenticate
5. **Test message parsing** by sending a delivery message to WhatsApp

For more details, see:
- `README.md` - General overview
- `HOW_TO_USE.md` - Usage instructions
- `API_SETUP_GUIDE.md` - API configuration

