# X-IDE New Project: Penpot-Based Clone Setup Guide

## Overview
This guide provides step-by-step instructions to clone Penpot and rebrand it as **X-IDE** - a completely NEW, separate product/project.

This creates an entirely new design tool product called X-IDE based on Penpot's architecture.

## Prerequisites
- Git installed and configured
- Docker and Docker Compose installed
- Node.js 16+ installed
- At least 10GB free disk space
- 4GB RAM minimum (8GB recommended)

## Step 1: Create New Project Directory
```bash
# Create X-IDE product directory
cd c:\Users\sales\thex
mkdir X-IDE-product
cd X-IDE-product
```

## Step 2: Clone Penpot Repository
```bash
# Clone Penpot into this new product folder
git clone https://github.com/penpot/penpot.git .

# This will be the foundation for the new X-IDE product
```

## Step 3: Examine Repository Structure
```bash
# List main folders
ls -la

# Key folders to understand:
# - /frontend      - React/TypeScript UI (THIS IS WHAT YOU'LL CUSTOMIZE)
# - /backend       - Clojure server (backend logic)
# - /exporter      - Export functionality (Node.js)
# - /docker        - Docker configuration
```

## Step 4: Choose Setup Method

### Option A: Docker Setup (Recommended - Full Product)
```bash
# Navigate to the new X-IDE product directory
cd c:\Users\sales\thex\X-IDE-product

# Start the application with Docker Compose
docker-compose -f docker-compose.yml up

# Wait for services to start (2-3 minutes)
# Access the new X-IDE product at: http://localhost:80

# To stop:
# Ctrl+C or run: docker-compose down
```

### Option B: Local Development Setup (For Customization & Branding)
```bash
# Install backend dependencies (Clojure)
cd c:\Users\sales\thex\X-IDE-product\backend
lein deps

# Install frontend dependencies
cd ..\frontend
npm install

# Build frontend
npm run build

# Run frontend dev server (hot reload for changes)
npm run dev

# In another terminal, run backend (requires JVM/Clojure)
cd ..\backend
lein run
```

## Step 5: Verify Installation
```bash
# After Docker compose or local setup is running:
# Visit http://localhost:80 in browser
# Create account or login
# Test: Create a new file, draw a shape
# Congratulations! You now have the X-IDE product foundation running!
```

## Step 6: Start Rebranding to "X-IDE"

### Change App Title & Branding
Edit `frontend/src/index.html`:
```html
<title>X-IDE - Professional Design Tool</title>
<meta name="description" content="X-IDE: Create stunning vector designs and illustrations">
```

### Change App Logo & Favicon
Replace files in `frontend/resources/images/`:
- `logo.png` - Your X-IDE logo
- `favicon.ico` - Your X-IDE favicon

### Update About/Settings
Edit `frontend/src/app/main/ui/settings/` to show "X-IDE" instead of "Penpot":
- Change copyright text
- Change product name in settings
- Add X-IDE branding colors

## Step 7: Key Rebranding Changes

### 1. File Structure
```
X-IDE-product/
├── frontend/          # React UI - CUSTOMIZE THIS
│   ├── src/
│   │   ├── index.html (Change title to "X-IDE")
│   │   ├── app/main/ui/ (Change "Penpot" mentions)
│   │   └── resources/images/ (Replace logo/favicon)
│   └── package.json (Change name to "x-ide-frontend")
│
├── backend/           # Clojure server - OPTIONAL
│   └── project.clj (Change name to "x-ide-backend")
│
└── docker-compose.yml (Already references the app correctly)
```

### 2. Top Priority: Frontend Branding Changes
```
frontend/src/
  ├── index.html                    # Change title & description
  ├── app/main/ui/
  │   ├── header/                   # Change product name in header
  │   ├── settings/                 # Update "About X-IDE"
  │   ├── login/                    # Change "Penpot" → "X-IDE"
  │   └── dashboard/                # Update welcome message
  │
  └── resources/
      ├── images/logo.png           # Replace with X-IDE logo
      ├── images/favicon.ico        # Replace with X-IDE favicon
      └── locales/en.json          # Replace "Penpot" strings with "X-IDE"
```

### 3. Secondary: Features to Keep/Remove
Keep:
- ✅ Vector drawing tools
- ✅ Layers panel
- ✅ Properties editor
- ✅ Export (SVG, PNG, PDF)
- ✅ Components/Symbols

Remove (optional):
- ❌ Collaboration features (if not needed)
- ❌ Plugins marketplace
- ❌ Penpot-specific branding

## Step 9: Environment Configuration (Optional)

Create `.env` file in root directory (only needed for production):
```bash
# Database Configuration
PENPOT_DATABASE_URI=postgresql://xide_user:xide_password@localhost:5432/xide_db

# Redis
PENPOT_REDIS_URI=redis://localhost:6379/0

# Email (optional for notifications)
PENPOT_SMTP_DEFAULT_FROM=noreply@x-ide.com
PENPOT_SMTP_HOST=localhost
PENPOT_SMTP_PORT=25

# App settings
PENPOT_ALLOW_INSECURE_HEADERS=true
PENPOT_HTTP_SERVER_PORT=6063
```

For local development, Docker Compose handles this automatically.

## Step 10: Troubleshooting

### Docker won't start
```bash
# Clear Docker containers and prune
docker-compose down -v
docker system prune -a
docker-compose up  # Try again
```

### Port already in use
```bash
# Change port in docker-compose.yml
# From: 80:8080
# To:   8080:8080 (or another free port like 3000)
```

### Out of memory
```bash
# Increase Docker memory:
# - Open Docker Desktop Settings
# - Resources → Memory: Set to 8GB or more
```

### Git clone too slow
```bash
# Use shallow clone (faster)
git clone --depth 1 https://github.com/penpot/penpot.git X-IDE-product
cd X-IDE-product
git fetch --unshallow  # Get full history later if needed
```

### Frontend dev server won't start
```bash
cd frontend
rm -r node_modules package-lock.json
npm install
npm run dev
```

## Next Steps After Setup

1. **Clone Penpot** - Follow Step 1-2 above
2. **Start with Docker** - Get it running first (Step 4 Option A)
3. **Quick Branding** - Change title, logo, favicon (Step 6)
4. **Switch to Frontend Dev** - Use hot reload for fast iteration (Step 8)
5. **Make first commit** - Save your X-IDE branding to git
6. **Expand features** - Add custom features as needed
7. **Deploy** - Build for production when ready

## Resources

- **Penpot Documentation**: https://help.penpot.app/
- **Penpot GitHub**: https://github.com/penpot/penpot
- **Penpot Community**: https://community.penpot.app/
- **Contributing Guide**: https://github.com/penpot/penpot/blob/main/CONTRIBUTING.md

## Quick Reference Commands

```bash
# Clone Penpot for X-IDE
cd c:\Users\sales\thex
mkdir X-IDE-product
cd X-IDE-product
git clone https://github.com/penpot/penpot.git .

# Start with Docker (Full App)
docker-compose up

# Or Frontend Dev (Hot Reload)
cd frontend
npm install
npm run dev

# Check if running
# - Docker: http://localhost:80
# - Frontend Dev: http://localhost:3000

# Stop
docker-compose down
```

## Timeline Estimate

- **Clone + Docker setup**: 30-60 minutes
- **Initial branding (title, logo)**: 30 minutes
- **Understanding Penpot codebase**: 2-4 hours
- **Frontend customizations**: 1-3 weeks (depending on scope)
- **Full product launch**: 4-8 weeks

## Project Structure

```
X-IDE-product/          # New, separate product
├── frontend/            # React/TypeScript UI (CUSTOMIZE HERE)
├── backend/             # Clojure server (keep as-is or modify)
├── exporter/            # Export to PDF/PNG (optional)
├── docker-compose.yml   # Docker configuration
└── README.md            # Penpot original docs
```

---

**Start cloning, then rebrand to make it your own X-IDE product!**
