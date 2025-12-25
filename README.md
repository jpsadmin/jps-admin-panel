# JPS Admin Panel

A secure, single-page web admin panel for JPS VPS server management. Provides a GUI interface for existing JPS server management CLI tools with a dark theme featuring cyan/orange accents.

## Features

- **Server Health Monitoring**: Real-time CPU, memory, and disk usage with color-coded status indicators
- **Service Status**: OpenLiteSpeed, MariaDB, and Fail2ban status monitoring
- **Sites Management**: View all hosted sites with quick actions
- **Quick Actions**: Restart OLS, run audits, pull Git updates, save audit snapshots, compare drift
- **Site Deployment**: Deploy new sites directly from the panel
- **Activity Log**: Recent server activity from lifecycle logs
- **Secure Authentication**: bcrypt passwords, session management, CSRF protection
- **IP Restrictions**: Optional IP whitelist support
- **Mobile Responsive**: Works on desktop, tablet, and mobile devices

## Requirements

- Ubuntu 24.04 (or compatible Linux distribution)
- OpenLiteSpeed web server
- PHP 8.4 with LSAPI
- JPS Server Tools installed (/opt/jps-server-tools)
- sudo privileges configured for www-data user

## Installation

### Quick Install

    git clone https://github.com/JPSHosting/jps-admin-panel.git
    cd jps-admin-panel
    sudo ./install.sh

### Manual Installation

1. Copy files to web directory
2. Create configuration from example  
3. Set permissions
4. Configure sudoers (see install.sh)

## Configuration

### Generate Password Hash

    php -r "echo password_hash('YOUR_PASSWORD', PASSWORD_BCRYPT);"

### Edit config.php with your settings

## Security

1. HTTPS Required - Always access via HTTPS
2. Strong Passwords - Use secure passwords
3. IP Restrictions - Limit access to known IPs (optional)
4. Session Timeout - 30 minute inactivity timeout
5. CSRF Protection - All requests require CSRF tokens
6. Rate Limiting - 5 attempts before 15-min lockout
7. Secure Headers - X-Frame-Options, CSP enabled

## File Structure

    jps-admin-panel/
    ├── public/           # Web root (document root)
    │   ├── index.php     # Main entry point
    │   ├── login.php     # Login page
    │   ├── logout.php    # Logout handler
    │   ├── api.php       # AJAX API endpoint
    │   └── assets/       # CSS and JavaScript
    ├── includes/         # PHP includes (protected)
    │   ├── config.example.php
    │   ├── auth.php
    │   ├── functions.php
    │   └── commands.php
    ├── templates/        # HTML templates (protected)
    ├── install.sh        # Installation script
    └── README.md

## API Endpoints

All API requests are POST to /api.php with CSRF token:

- get_status - Get server health status
- get_sites - Get list of all sites  
- get_full_audit - Run full server audit
- restart_ols - Restart OpenLiteSpeed
- get_credentials - Get site credentials (domain param)
- create_checkpoint - Create site checkpoint (domain param)
- suspend_site - Suspend a site (domain param)
- resume_site - Resume a site (domain param)
- archive_site - Create archive (domain param)
- delete_site - Delete site (domain + confirmation)
- get_site_logs - Get error logs (domain param)
- get_lifecycle_log - Get activity log
- git_pull - Pull server tools updates
- fix_permissions - Fix site permissions (domain param)
- deploy_site - Deploy a new site (domain param)
- save_audit_snapshot - Save current audit state as baseline
- compare_drift - Compare current state to saved snapshot

## Sudoers Configuration

The admin panel requires specific sudo permissions. Create `/etc/sudoers.d/jps-admin-panel`:

    # JPS Admin Panel - Sudo permissions for www-data

    # JPS Server Tools commands
    www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-audit
    www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-status
    www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-checkpoint
    www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-site-suspend
    www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-site-archive
    www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-site-delete
    www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-backup-verify
    www-data ALL=(ALL) NOPASSWD: /usr/local/bin/jps-deploy-site

    # OpenLiteSpeed control
    www-data ALL=(ALL) NOPASSWD: /usr/local/lsws/bin/lswsctrl

    # Git pull for server-tools only
    www-data ALL=(ALL) NOPASSWD: /usr/bin/git -C /opt/jps-server-tools pull

    # Permission fixes for websites
    www-data ALL=(ALL) NOPASSWD: /usr/bin/chown -R nobody\:nogroup /usr/local/websites/*/html/

    # Read credentials files (root-owned with 600 permissions)
    www-data ALL=(ALL) NOPASSWD: /usr/bin/cat /usr/local/websites/*/CREDENTIALS.txt
    www-data ALL=(ALL) NOPASSWD: /usr/bin/cat /usr/local/websites/*/.credentials
    www-data ALL=(ALL) NOPASSWD: /usr/bin/test -f /usr/local/websites/*

    # Read log files
    www-data ALL=(ALL) NOPASSWD: /usr/bin/tail -n * /usr/local/websites/*/logs/*
    www-data ALL=(ALL) NOPASSWD: /usr/bin/tail -n * /opt/jps-server-tools/logs/*
    www-data ALL=(ALL) NOPASSWD: /usr/bin/tail -n * /var/log/lsws/*

Set proper permissions: `chmod 440 /etc/sudoers.d/jps-admin-panel`

## Troubleshooting

### Access denied on login
- Check password hash is correct
- Verify username matches
- Check IP restrictions

### Commands not executing
- Verify sudoers configuration
- Test commands as www-data user

### Credentials not loading
- Ensure CREDENTIALS.txt exists in site directory
- Verify sudoers has `/usr/bin/cat` and `/usr/bin/test` entries
- Check file ownership is root:root with 600 permissions

### Blank page / 500 error
- Check PHP error logs
- Verify file permissions

## License

MIT License

## Support

For issues and feature requests, use the GitHub issue tracker.
