# JPS Admin Panel

A secure, single-page web admin panel for JPS VPS server management. Provides a GUI interface for existing JPS server management CLI tools with a dark theme featuring cyan/orange accents.

## Features

- **Server Health Monitoring**: Real-time CPU, memory, and disk usage with color-coded status indicators
- **Service Status**: OpenLiteSpeed, MariaDB, and Fail2ban status monitoring
- **Sites Management**: View all hosted sites with quick actions
- **Quick Actions**: Restart OLS, run audits, pull Git updates
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

## Troubleshooting

### Access denied on login
- Check password hash is correct
- Verify username matches
- Check IP restrictions

### Commands not executing
- Verify sudoers configuration
- Test commands as www-data user

### Blank page / 500 error
- Check PHP error logs
- Verify file permissions

## License

MIT License

## Support

For issues and feature requests, use the GitHub issue tracker.
