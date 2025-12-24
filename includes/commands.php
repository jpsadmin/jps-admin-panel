<?php
/**
 * JPS Admin Panel - Command Execution Wrappers
 *
 * All commands are executed with proper validation and escaping.
 * Commands require appropriate sudoers entries for www-data user.
 */

defined('JPS_ADMIN') or die('Direct access not permitted');

/**
 * Validate domain against existing sites
 */
function validate_domain(?string $domain): ?string
{
    if (empty($domain)) {
        return null;
    }

    // Sanitize domain
    $domain = preg_replace('/[^a-zA-Z0-9.-]/', '', $domain);

    // Check if domain exists in sites list
    $sites = get_site_list();

    if (!in_array($domain, $sites, true)) {
        return null;
    }

    return $domain;
}

/**
 * Execute a command and return result
 */
function execute_command(string $command, bool $use_sudo = true): array
{
    if ($use_sudo) {
        $command = 'sudo ' . $command;
    }

    $output = [];
    $return_code = 0;

    exec($command . ' 2>&1', $output, $return_code);

    $output_str = implode("\n", $output);

    return [
        'success' => $return_code === 0,
        'output' => $output_str,
        'return_code' => $return_code,
    ];
}

/**
 * Get server status (jps-audit --brief)
 */
function cmd_get_status(): array
{
    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-audit']) . ' --brief';

    $result = execute_command($cmd);

    if ($result['success']) {
        $parsed = parse_audit_brief($result['output']);
        $result['data'] = $parsed;
    }

    return $result;
}

/**
 * Get full audit report
 */
function cmd_get_full_audit(): array
{
    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-audit']);

    return execute_command($cmd);
}

/**
 * Get sites list (jps-status)
 */
function cmd_get_sites(): array
{
    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-status']);

    $result = execute_command($cmd);

    if ($result['success']) {
        $result['sites'] = parse_status_output($result['output']);
    }

    return $result;
}

/**
 * Restart OpenLiteSpeed
 */
function cmd_restart_ols(): array
{
    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['lswsctrl']) . ' restart';

    log_action('restart_ols', 'OpenLiteSpeed restart initiated');

    return execute_command($cmd);
}

/**
 * Get site credentials
 */
function cmd_get_credentials(string $domain): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();
    $creds_file = $config['websites_root'] . '/' . $domain . '/.credentials';

    if (!file_exists($creds_file)) {
        return ['success' => false, 'error' => 'Credentials file not found'];
    }

    // Read credentials with sudo (file may be root-owned)
    $cmd = 'cat ' . escapeshellarg($creds_file);
    $result = execute_command($cmd);

    if ($result['success']) {
        log_action('view_credentials', $domain);
    }

    return $result;
}

/**
 * Create checkpoint
 */
function cmd_create_checkpoint(string $domain): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-checkpoint']) . ' ' . escapeshellarg($domain);

    log_action('create_checkpoint', $domain);

    return execute_command($cmd);
}

/**
 * Suspend site
 */
function cmd_suspend_site(string $domain): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-site-suspend']) . ' ' . escapeshellarg($domain);

    log_action('suspend_site', $domain);

    return execute_command($cmd);
}

/**
 * Resume site
 */
function cmd_resume_site(string $domain): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-site-suspend']) . ' --resume ' . escapeshellarg($domain);

    log_action('resume_site', $domain);

    return execute_command($cmd);
}

/**
 * Archive site
 */
function cmd_archive_site(string $domain): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-site-archive']) . ' ' . escapeshellarg($domain);

    log_action('archive_site', $domain);

    return execute_command($cmd);
}

/**
 * Delete site (requires confirmation token)
 */
function cmd_delete_site(string $domain, string $confirmation): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    // Verify confirmation matches domain
    if ($confirmation !== $domain) {
        return ['success' => false, 'error' => 'Confirmation does not match domain'];
    }

    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-site-delete']) . ' ' . escapeshellarg($domain) . ' --confirm';

    log_action('delete_site', $domain);

    return execute_command($cmd);
}

/**
 * Get site error logs
 */
function cmd_get_site_logs(string $domain, int $lines = 100): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();
    $log_file = $config['websites_root'] . '/' . $domain . '/logs/error.log';

    if (!file_exists($log_file)) {
        // Try alternative locations
        $alt_locations = [
            $config['websites_root'] . '/' . $domain . '/logs/php_error.log',
            '/var/log/lsws/' . $domain . '.error.log',
        ];

        foreach ($alt_locations as $alt) {
            if (file_exists($alt)) {
                $log_file = $alt;
                break;
            }
        }
    }

    $lines = min(max(10, $lines), 500); // Limit to 10-500 lines
    $cmd = 'tail -n ' . (int)$lines . ' ' . escapeshellarg($log_file);

    return execute_command($cmd);
}

/**
 * Get lifecycle log entries
 */
function cmd_get_lifecycle_log(int $lines = 10): array
{
    $config = get_config();
    $log_file = $config['lifecycle_log'];

    $lines = min(max(5, $lines), 100); // Limit to 5-100 lines
    $cmd = 'tail -n ' . (int)$lines . ' ' . escapeshellarg($log_file);

    return execute_command($cmd, false); // No sudo needed for readable log
}

/**
 * Git pull for server tools
 */
function cmd_git_pull(): array
{
    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['git']) . ' -C ' . escapeshellarg($config['tools_path']) . ' pull';

    log_action('git_pull', 'Server tools update initiated');

    return execute_command($cmd);
}

/**
 * Fix site permissions
 */
function cmd_fix_permissions(string $domain): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();
    $site_path = $config['websites_root'] . '/' . $domain . '/html/';

    if (!is_dir($site_path)) {
        return ['success' => false, 'error' => 'Site directory not found'];
    }

    $cmd = escapeshellcmd($config['commands']['chown']) . ' -R nobody:nogroup ' . escapeshellarg($site_path);

    log_action('fix_permissions', $domain);

    return execute_command($cmd);
}

/**
 * Verify backup
 */
function cmd_verify_backup(string $domain): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-backup-verify']) . ' ' . escapeshellarg($domain);

    return execute_command($cmd);
}
