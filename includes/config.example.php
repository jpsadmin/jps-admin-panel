<?php
/**
 * JPS Admin Panel Configuration
 *
 * Copy this file to config.php and update the values.
 * Generate password hash with: php -r "echo password_hash('yourpassword', PASSWORD_BCRYPT) . PHP_EOL;"
 */

return [
    // Authentication
    'username' => 'admin',
    'password_hash' => '', // REQUIRED: Generate with command above

    // Session settings
    'session_timeout' => 1800, // 30 minutes in seconds
    'session_name' => 'jps_admin_session',

    // Security
    'allowed_ips' => [], // Empty array = allow all, or ['192.168.1.1', '10.0.0.1']
    'https_required' => true, // Redirect HTTP to HTTPS

    // Server info (displayed in header)
    'server_ip' => '69.62.67.12',
    'server_os' => 'Ubuntu 24.04',
    'web_server' => 'OpenLiteSpeed',
    'php_version' => '8.4',

    // Paths
    'websites_root' => '/usr/local/websites',
    'tools_path' => '/opt/jps-server-tools',
    'lifecycle_log' => '/opt/jps-server-tools/logs/lifecycle.log',

    // UI settings
    'auto_refresh' => 60, // Status auto-refresh interval in seconds, 0 to disable
    'site_name' => 'JPS Admin Panel',
    'items_per_page' => 20,

    // External links
    'external_links' => [
        'OLS Admin Panel' => 'https://69.62.67.12:7080',
        'Cloudflare Dashboard' => 'https://dash.cloudflare.com',
        'Hostinger hPanel' => 'https://hpanel.hostinger.com',
        'GitHub Repos' => 'https://github.com/JPSHosting',
    ],

    // Command paths (should not need to change these)
    'commands' => [
        'jps-audit' => '/usr/local/bin/jps-audit',
        'jps-status' => '/usr/local/bin/jps-status',
        'jps-checkpoint' => '/usr/local/bin/jps-checkpoint',
        'jps-site-suspend' => '/usr/local/bin/jps-site-suspend',
        'jps-site-archive' => '/usr/local/bin/jps-site-archive',
        'jps-site-delete' => '/usr/local/bin/jps-site-delete',
        'jps-backup-verify' => '/usr/local/bin/jps-backup-verify',
        'jps-deploy-site' => '/usr/local/bin/jps-deploy-site',
        'jps-dns-check' => '/usr/local/bin/jps-dns-check',
        'jps-reinstall-wp' => '/usr/local/bin/jps-reinstall-wp',
        'lswsctrl' => '/usr/local/lsws/bin/lswsctrl',
        'git' => '/usr/bin/git',
        'chown' => '/usr/bin/chown',
    ],
];
