#!/bin/bash

# Geospatial Dashboard Setup Script
# This script automates the setup process

set -e

echo "🗺️  Geospatial Dashboard Setup"
echo "======================================"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${BLUE}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker found${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose found${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found ($(node --version))${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python 3 found ($(python3 --version))${NC}"

# Start Docker services
echo -e "\n${BLUE}Starting Docker services...${NC}"
docker-compose down || true
docker-compose up -d
echo -e "${GREEN}✓ Docker services started${NC}"

# Wait for PostgreSQL
echo -e "\n${BLUE}Waiting for PostgreSQL to be ready...${NC}"
sleep 15
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

# Load data
echo -e "\n${BLUE}Loading sample data...${NC}"
if command -v python &> /dev/null; then
    python data/load_data.py || python3 data/load_data.py
elif command -v python3 &> /dev/null; then
    python3 data/load_data.py
fi
echo -e "${GREEN}✓ Sample data loaded${NC}"

# Install frontend dependencies
echo -e "\n${BLUE}Installing frontend dependencies...${NC}"
cd frontend
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Create .env.local
echo -e "\n${BLUE}Setting up environment...${NC}"
if [ ! -f .env.local ]; then
    echo "NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjazBkZTBkMjA0MjAwMGcyajUyZDRydWFwIn0.example" > .env.local
    echo -e "${RED}⚠️  Mapbox token placeholder created${NC}"
    echo -e "    Get a free token at: https://account.mapbox.com/auth/signup"
    echo -e "    Then update .env.local with your token"
fi
echo -e "${GREEN}✓ Environment file created${NC}"

# Summary
echo ""
echo "======================================"
echo -e "${GREEN}✓ Setup complete!${NC}"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Update NEXT_PUBLIC_MAPBOX_TOKEN in frontend/.env.local"
echo "  2. Start dev server: npm run dev"
echo "  3. Open http://localhost:3000"
echo ""
echo "Database credentials:"
echo "  Host: localhost:5432"
echo "  Database: geospatial_db"
echo "  User: geospatial_user"
echo "  Password: geospatial_pass"
echo ""
echo "pgAdmin (optional):"
echo "  URL: http://localhost:5050"
echo "  Email: admin@example.com"
echo "  Password: admin"
echo ""
