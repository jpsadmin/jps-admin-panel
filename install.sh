#!/bin/bash
#
# JPS Admin Panel Installation Script
#
# This script installs the JPS Admin Panel to an Ubuntu VPS with OpenLiteSpeed.
# Run as root or with sudo.
#
# Usage: sudo ./install.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/var/www/admin-panel"
WEB_USER="www-data"
SUDOERS_FILE="/etc/sudoers.d/jps-admin-panel"

# Print banner
echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           JPS Admin Panel Installation Script              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run: sudo ./install.sh"
    exit 1
fi

# Check if required commands exist
echo -e "${CYAN}[1/7]${NC} Checking prerequisites..."

REQUIRED_COMMANDS="php git"
for cmd in $REQUIRED_COMMANDS; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}Error: $cmd is not installed${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✓${NC} All prerequisites met"

# Determine script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if we're running from the repo directory
if [[ ! -f "$SCRIPT_DIR/public/index.php" ]]; then
    echo -e "${RED}Error: Cannot find source files. Run this script from the repository directory.${NC}"
    exit 1
fi

# Create installation directory
echo -e "${CYAN}[2/7]${NC} Creating installation directory..."

if [[ -d "$INSTALL_DIR" ]]; then
    echo -e "${YELLOW}Warning: $INSTALL_DIR already exists${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled"
        exit 1
    fi
    rm -rf "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR"
echo -e "${GREEN}✓${NC} Created $INSTALL_DIR"

# Copy files
echo -e "${CYAN}[3/7]${NC} Copying files..."

cp -r "$SCRIPT_DIR/public" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/includes" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/templates" "$INSTALL_DIR/"

# Create logs directory
mkdir -p "$INSTALL_DIR/logs"

echo -e "${GREEN}✓${NC} Files copied successfully"

# Create config from example if not exists
echo -e "${CYAN}[4/7]${NC} Setting up configuration..."

if [[ ! -f "$INSTALL_DIR/includes/config.php" ]]; then
    cp "$INSTALL_DIR/includes/config.example.php" "$INSTALL_DIR/includes/config.php"
    echo -e "${YELLOW}!${NC} Created config.php from example"
    echo -e "${YELLOW}  Please edit $INSTALL_DIR/includes/config.php and set your password hash${NC}"
else
    echo -e "${GREEN}✓${NC} Config file already exists"
fi

# Set permissions
echo -e "${CYAN}[5/8]${NC} Setting permissions..."

chown -R $WEB_USER:$WEB_USER "$INSTALL_DIR"
chmod -R 750 "$INSTALL_DIR"
chmod 640 "$INSTALL_DIR/includes/config.php" 2>/dev/null || true
chmod 640 "$INSTALL_DIR/includes/config.example.php"
chmod 770 "$INSTALL_DIR/logs"

echo -e "${GREEN}✓${NC} Permissions set"

# Install CLI scripts
echo -e "${CYAN}[6/8]${NC} Installing CLI scripts..."

if [[ -f "$SCRIPT_DIR/scripts/jps-reinstall-wp" ]]; then
    cp "$SCRIPT_DIR/scripts/jps-reinstall-wp" /usr/local/bin/jps-reinstall-wp
    chmod 755 /usr/local/bin/jps-reinstall-wp
    echo -e "${GREEN}✓${NC} Installed jps-reinstall-wp to /usr/local/bin/"
else
    echo -e "${YELLOW}Warning: jps-reinstall-wp script not found in scripts/${NC}"
fi

# Create backup directory
mkdir -p /var/backups/jps-sites
chmod 750 /var/backups/jps-sites

# Create sudoers file
echo -e "${CYAN}[7/8]${NC} Configuring sudo permissions..."

cat > "$SUDOERS_FILE" << 'EOF'
# JPS Admin Panel - Sudo permissions for www-data
# This file allows the web server to execute specific JPS commands

# JPS Server Tools commands
www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-audit
www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-status
www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-checkpoint
www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-site-suspend
www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-site-archive
www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-site-delete
www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-backup-verify
www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-deploy-site
www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-reinstall-wp

# OpenLiteSpeed control
www-data ALL=(ALL) NOPASSWD: /usr/local/lsws/bin/lswsctrl

# Git pull for server-tools only
www-data ALL=(ALL) NOPASSWD: /usr/bin/git -C /opt/jps-server-tools pull

# Permission fixes for websites (restricted to specific path pattern)
www-data ALL=(ALL) NOPASSWD: /usr/bin/chown -R nobody\:nogroup /usr/local/websites/*/html/

# Read credentials files (root-owned with 600 permissions)
www-data ALL=(ALL) NOPASSWD: /usr/bin/cat /usr/local/websites/*/CREDENTIALS.txt
www-data ALL=(ALL) NOPASSWD: /usr/bin/cat /usr/local/websites/*/.credentials
www-data ALL=(ALL) NOPASSWD: /usr/bin/test -f /usr/local/websites/*

# Read log files
www-data ALL=(ALL) NOPASSWD: /usr/bin/tail -n * /usr/local/websites/*/logs/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/tail -n * /opt/jps-server-tools/logs/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/tail -n * /var/log/lsws/*
EOF

chmod 440 "$SUDOERS_FILE"

# Validate sudoers syntax
if visudo -c -f "$SUDOERS_FILE" &>/dev/null; then
    echo -e "${GREEN}✓${NC} Sudoers file created and validated"
else
    echo -e "${RED}Error: Invalid sudoers syntax${NC}"
    rm -f "$SUDOERS_FILE"
    exit 1
fi

# Create .htaccess for security
echo -e "${CYAN}[8/8]${NC} Creating security files..."

# Root .htaccess (deny all, allow public)
cat > "$INSTALL_DIR/.htaccess" << 'EOF'
# JPS Admin Panel - Root .htaccess
# Deny access to all files by default

<IfModule mod_authz_core.c>
    Require all denied
</IfModule>

<IfModule !mod_authz_core.c>
    Order deny,allow
    Deny from all
</IfModule>
EOF

# Includes .htaccess (deny all)
cat > "$INSTALL_DIR/includes/.htaccess" << 'EOF'
# Deny all access to includes directory
<IfModule mod_authz_core.c>
    Require all denied
</IfModule>

<IfModule !mod_authz_core.c>
    Order deny,allow
    Deny from all
</IfModule>
EOF

# Templates .htaccess (deny all)
cat > "$INSTALL_DIR/templates/.htaccess" << 'EOF'
# Deny all access to templates directory
<IfModule mod_authz_core.c>
    Require all denied
</IfModule>

<IfModule !mod_authz_core.c>
    Order deny,allow
    Deny from all
</IfModule>
EOF

# Logs .htaccess (deny all)
cat > "$INSTALL_DIR/logs/.htaccess" << 'EOF'
# Deny all access to logs directory
<IfModule mod_authz_core.c>
    Require all denied
</IfModule>

<IfModule !mod_authz_core.c>
    Order deny,allow
    Deny from all
</IfModule>
EOF

# Public .htaccess (allow access, enable rewrites)
cat > "$INSTALL_DIR/public/.htaccess" << 'EOF'
# JPS Admin Panel - Public directory .htaccess

# Allow access to public files
<IfModule mod_authz_core.c>
    Require all granted
</IfModule>

<IfModule !mod_authz_core.c>
    Order allow,deny
    Allow from all
</IfModule>

# Enable rewrite engine
<IfModule mod_rewrite.c>
    RewriteEngine On

    # Force HTTPS
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

    # Remove trailing slashes
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)/$ /$1 [L,R=301]
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'"
</IfModule>

# Deny access to hidden files
<FilesMatch "^\.">
    <IfModule mod_authz_core.c>
        Require all denied
    </IfModule>
    <IfModule !mod_authz_core.c>
        Order deny,allow
        Deny from all
    </IfModule>
</FilesMatch>

# Deny access to PHP files in assets
<FilesMatch "\.php$">
    <IfModule mod_authz_core.c>
        <If "%{REQUEST_URI} =~ m#^/assets/#">
            Require all denied
        </If>
    </IfModule>
</FilesMatch>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 week"
    ExpiresByType application/javascript "access plus 1 week"
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType image/jpeg "access plus 1 month"
    ExpiresByType image/gif "access plus 1 month"
    ExpiresByType image/svg+xml "access plus 1 month"
</IfModule>
EOF

echo -e "${GREEN}✓${NC} Security files created"

# Print completion message
echo
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Installation Complete!                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${CYAN}Next Steps:${NC}"
echo
echo "1. Generate a password hash:"
echo -e "   ${YELLOW}php -r \"echo password_hash('YOUR_PASSWORD', PASSWORD_BCRYPT) . PHP_EOL;\"${NC}"
echo
echo "2. Edit the configuration file:"
echo -e "   ${YELLOW}nano $INSTALL_DIR/includes/config.php${NC}"
echo "   - Set your username"
echo "   - Paste the password hash"
echo "   - Configure allowed IPs (optional)"
echo "   - Update server info as needed"
echo
echo "3. Configure OpenLiteSpeed virtual host:"
echo "   - Document Root: $INSTALL_DIR/public"
echo "   - Enable PHP LSAPI"
echo "   - Set up SSL certificate"
echo
echo "4. Test the installation:"
echo -e "   ${YELLOW}https://admin.yourdomain.com${NC}"
echo
echo -e "${CYAN}Files Installed:${NC}"
echo "   $INSTALL_DIR/"
echo "   ├── public/         (web root)"
echo "   ├── includes/       (PHP includes)"
echo "   ├── templates/      (HTML templates)"
echo "   └── logs/           (admin panel logs)"
echo
echo -e "${CYAN}Sudoers File:${NC}"
echo "   $SUDOERS_FILE"
echo
echo -e "${YELLOW}Security Reminder:${NC}"
echo "   - Ensure HTTPS is properly configured"
echo "   - Consider restricting access by IP"
echo "   - Regularly update the admin panel password"
echo
