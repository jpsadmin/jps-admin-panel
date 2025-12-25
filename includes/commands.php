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

    // Try multiple credential file locations (CREDENTIALS.txt is the primary one)
    $creds_locations = [
        $config['websites_root'] . '/' . $domain . '/CREDENTIALS.txt',
        $config['websites_root'] . '/' . $domain . '/.credentials',
        $config['websites_root'] . '/' . $domain . '/credentials.txt',
    ];

    $creds_file = null;
    foreach ($creds_locations as $location) {
        // Use sudo to check if file exists (may be root-owned with 600 permissions)
        $check_cmd = '/usr/bin/test -f ' . escapeshellarg($location) . ' && echo exists';
        $check_result = execute_command($check_cmd);
        if (strpos($check_result['output'], 'exists') !== false) {
            $creds_file = $location;
            break;
        }
    }

    if (!$creds_file) {
        return ['success' => false, 'error' => 'Credentials file not found'];
    }

    // Read credentials with sudo (file is root-owned with 600 permissions)
    $cmd = '/usr/bin/cat ' . escapeshellarg($creds_file);
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

    // Log file locations to check
    $log_locations = [
        $config['websites_root'] . '/' . $domain . '/logs/error.log',
        $config['websites_root'] . '/' . $domain . '/logs/php_error.log',
        '/var/log/lsws/' . $domain . '.error.log',
    ];

    $log_file = null;
    foreach ($log_locations as $location) {
        // Use sudo to check if file exists (may be root-owned)
        $check_cmd = '/usr/bin/test -f ' . escapeshellarg($location) . ' && echo exists';
        $check_result = execute_command($check_cmd);
        if (strpos($check_result['output'], 'exists') !== false) {
            $log_file = $location;
            break;
        }
    }

    if (!$log_file) {
        return ['success' => false, 'error' => 'No log file found for this site'];
    }

    $lines = min(max(10, $lines), 500); // Limit to 10-500 lines
    $cmd = '/usr/bin/tail -n ' . (int)$lines . ' ' . escapeshellarg($log_file);

    return execute_command($cmd);
}

/**
 * Get lifecycle log entries
 */
function cmd_get_lifecycle_log(int $limit = 20): array
{
    $log_dir = '/opt/jps-server-tools/logs/lifecycle';
    $all_entries = [];

    // Read all log files in the lifecycle directory
    if (is_dir($log_dir)) {
        $files = glob($log_dir . '/*.log');
        foreach ($files as $file) {
            $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines) {
                $all_entries = array_merge($all_entries, $lines);
            }
        }
    }

    // Sort by timestamp descending (entries start with [YYYY-MM-DD HH:MM:SS])
    usort($all_entries, function($a, $b) {
        preg_match('/\[([^\]]+)\]/', $a, $ma);
        preg_match('/\[([^\]]+)\]/', $b, $mb);
        return strcmp($mb[1] ?? '', $ma[1] ?? '');
    });

    // Limit entries
    $entries = array_slice($all_entries, 0, min(max(5, $limit), 100));

    return [
        'success' => true,
        'output' => implode("\n", $entries),
        'entries' => $entries,
    ];
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

/**
 * Deploy a new site
 */
function cmd_deploy_site(string $domain): array
{
    // Validate domain format (not against existing sites since it's new)
    if (empty($domain)) {
        return ['success' => false, 'error' => 'Domain is required'];
    }

    // Basic domain validation
    $domain = preg_replace('/[^a-zA-Z0-9.-]/', '', $domain);
    if (empty($domain) || strlen($domain) < 4 || !preg_match('/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$/', $domain)) {
        return ['success' => false, 'error' => 'Invalid domain format'];
    }

    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-deploy-site']) . ' ' . escapeshellarg($domain);

    log_action('deploy_site', $domain);

    return execute_command($cmd);
}

/**
 * Save audit snapshot
 */
function cmd_save_audit_snapshot(): array
{
    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-audit']) . ' --save';

    log_action('save_audit_snapshot', 'Audit snapshot saved');

    return execute_command($cmd);
}

/**
 * Compare drift (audit diff)
 */
function cmd_compare_drift(): array
{
    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-audit']) . ' --diff';

    log_action('compare_drift', 'Audit drift comparison');

    return execute_command($cmd);
}
