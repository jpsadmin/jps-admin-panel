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
    // Use --force to skip all interactive confirmations (API/automated use)
    $cmd = escapeshellcmd($config['commands']['jps-site-delete']) . ' ' . escapeshellarg($domain) . ' --force';

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

/**
 * Get site information for reinstall modal
 */
function cmd_get_site_info(string $domain): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();
    $site_path = $config['websites_root'] . '/' . $domain . '/html';

    $data = [
        'wp_version' => 'Unknown',
        'site_size' => 'Unknown',
        'uploads_size' => 'Unknown',
        'db_size' => 'Unknown',
    ];

    // Get WordPress version
    $version_file = $site_path . '/wp-includes/version.php';
    if (file_exists($version_file)) {
        $version_content = file_get_contents($version_file);
        if (preg_match("/\\\$wp_version\\s*=\\s*'([^']+)'/", $version_content, $matches)) {
            $data['wp_version'] = $matches[1];
        }
    }

    // Get site size
    $result = execute_command('/usr/bin/du -sh ' . escapeshellarg($site_path) . ' 2>/dev/null | cut -f1', false);
    if ($result['success'] && !empty(trim($result['output']))) {
        $data['site_size'] = trim($result['output']);
    }

    // Get uploads size
    $uploads_path = $site_path . '/wp-content/uploads';
    $result = execute_command('/usr/bin/du -sh ' . escapeshellarg($uploads_path) . ' 2>/dev/null | cut -f1');
    if ($result['success'] && !empty(trim($result['output']))) {
        $data['uploads_size'] = trim($result['output']);
    }

    // Get database info from wp-config.php
    $wp_config = $site_path . '/wp-config.php';
    if (file_exists($wp_config)) {
        $config_content = file_get_contents($wp_config);

        // Extract DB credentials
        $db_name = '';
        $db_user = '';
        $db_password = '';
        $db_host = 'localhost';

        if (preg_match("/define\\s*\\(\\s*['\"]DB_NAME['\"]\\s*,\\s*['\"]([^'\"]+)['\"]/", $config_content, $m)) {
            $db_name = $m[1];
        }
        if (preg_match("/define\\s*\\(\\s*['\"]DB_USER['\"]\\s*,\\s*['\"]([^'\"]+)['\"]/", $config_content, $m)) {
            $db_user = $m[1];
        }
        if (preg_match("/define\\s*\\(\\s*['\"]DB_PASSWORD['\"]\\s*,\\s*['\"]([^'\"]+)['\"]/", $config_content, $m)) {
            $db_password = $m[1];
        }
        if (preg_match("/define\\s*\\(\\s*['\"]DB_HOST['\"]\\s*,\\s*['\"]([^'\"]+)['\"]/", $config_content, $m)) {
            $db_host = $m[1];
        }

        // Get database size
        if (!empty($db_name) && !empty($db_user)) {
            $mysql_cmd = sprintf(
                'mysql -u %s -p%s -h %s -N -e "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) FROM information_schema.tables WHERE table_schema = %s;" 2>/dev/null',
                escapeshellarg($db_user),
                escapeshellarg($db_password),
                escapeshellarg($db_host),
                escapeshellarg($db_name)
            );
            $result = execute_command($mysql_cmd, false);
            if ($result['success'] && !empty(trim($result['output']))) {
                $size = trim($result['output']);
                if (is_numeric($size)) {
                    $data['db_size'] = $size . ' MB';
                }
            }
        }
    }

    return [
        'success' => true,
        'data' => $data,
    ];
}

/**
 * Validate a single site
 */
function cmd_validate_site(string $domain): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $cmd = '/usr/local/bin/jps-validate-site ' . escapeshellarg($domain) . ' --json';

    log_action('validate_site', $domain);

    return execute_command($cmd, true);
}

/**
 * Validate all sites
 */
function cmd_validate_all_sites(): array
{
    $sites = get_site_list();
    $results = [];

    foreach ($sites as $site) {
        $cmd = '/usr/local/bin/jps-validate-site ' . escapeshellarg($site) . ' --json';
        $result = execute_command($cmd, true);
        $results[$site] = $result;
    }

    log_action('validate_all_sites', 'Validated ' . count($sites) . ' sites');

    return ['success' => true, 'results' => $results];
}

/**
 * Reinstall WordPress
 */
function cmd_reinstall_wordpress(string $domain, bool $preserve_uploads = true): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();

    // Build command with options
    $cmd = escapeshellcmd($config['commands']['jps-reinstall-wp']) . ' ' . escapeshellarg($domain);
    $cmd .= ' --force --json';

    if ($preserve_uploads) {
        $cmd .= ' --preserve-uploads';
    }

    log_action('reinstall_wordpress', $domain . ($preserve_uploads ? ' (preserving uploads)' : ''));

    $result = execute_command($cmd);

    // Parse JSON output if successful
    if (!empty($result['output'])) {
        $json = json_decode($result['output'], true);
        if ($json !== null) {
            return [
                'success' => $json['success'] ?? false,
                'error' => $json['message'] ?? null,
                'data' => $json['data'] ?? [],
                'output' => $result['output'],
            ];
        }
    }

    return $result;
}

/**
 * Switch File Manager to assets view
 */
function cmd_filemanager_assets_view(): array
{
    $filemanager_path = '/var/www/admin-panel/public/filemanager.php';
    $content = file_get_contents($filemanager_path);
    $content = str_replace('$root_path = \'/usr/local/websites\'', '$root_path = \'/usr/local\'', $content);
    file_put_contents($filemanager_path, $content);
    
    log_action('filemanager_assets_view', 'File Manager switched to assets view');
    
    return ['success' => true, 'output' => 'Switched to assets view'];
}

/**
 * Switch File Manager back to sites view
 */
function cmd_filemanager_sites_view(): array
{
    $filemanager_path = '/var/www/admin-panel/public/filemanager.php';
    $content = file_get_contents($filemanager_path);
    $content = str_replace('$root_path = \'/usr/local\'', '$root_path = \'/usr/local/websites\'', $content);
    file_put_contents($filemanager_path, $content);

    log_action('filemanager_sites_view', 'File Manager switched to sites view');

    return ['success' => true, 'output' => 'Switched to sites view'];
}

/**
 * Get latest daily monitor report
 */
function cmd_get_monitor_report(): array
{
    $report_dir = '/opt/jps-server-tools/logs/daily-monitor';

    if (!is_dir($report_dir)) {
        return ['success' => false, 'error' => 'Report directory not found'];
    }

    // Find the most recent report
    $reports = glob($report_dir . '/*.json');
    if (empty($reports)) {
        return ['success' => false, 'error' => 'No reports found'];
    }

    // Sort by filename (date) descending
    rsort($reports);
    $latest_report = $reports[0];

    $content = file_get_contents($latest_report);
    if ($content === false) {
        return ['success' => false, 'error' => 'Failed to read report'];
    }

    $data = json_decode($content, true);
    if ($data === null) {
        return ['success' => false, 'error' => 'Invalid report format'];
    }

    return [
        'success' => true,
        'report' => $data,
        'report_file' => basename($latest_report),
    ];
}

/**
 * Get list of available monitor reports
 */
function cmd_list_monitor_reports(): array
{
    $report_dir = '/opt/jps-server-tools/logs/daily-monitor';

    if (!is_dir($report_dir)) {
        return ['success' => true, 'reports' => []];
    }

    $reports = glob($report_dir . '/*.json');
    rsort($reports);

    $report_list = [];
    foreach (array_slice($reports, 0, 30) as $report) {
        $filename = basename($report);
        $date = str_replace('.json', '', $filename);
        $report_list[] = [
            'filename' => $filename,
            'date' => $date,
            'size' => filesize($report),
        ];
    }

    return ['success' => true, 'reports' => $report_list];
}

/**
 * Run daily monitor now
 */
function cmd_run_daily_monitor(): array
{
    $cmd = '/usr/local/bin/jps-daily-monitor --json';

    log_action('run_daily_monitor', 'Manual daily monitor run');

    return execute_command($cmd, true);
}

/**
 * Check DNS for a domain
 */
function cmd_check_dns(string $domain): array
{
    // Basic domain validation
    if (empty($domain)) {
        return ['success' => false, 'error' => 'Domain is required'];
    }

    $domain = preg_replace('/[^a-zA-Z0-9.-]/', '', $domain);
    if (empty($domain) || strlen($domain) < 4 || !preg_match('/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$/', $domain)) {
        return ['success' => false, 'error' => 'Invalid domain format'];
    }

    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-dns-check']) . ' --json ' . escapeshellarg($domain);

    $result = execute_command($cmd);

    // Parse JSON output from jps-dns-check
    if (!empty($result['output'])) {
        $dns_data = json_decode($result['output'], true);
        if ($dns_data) {
            $result['dns'] = $dns_data;
            $result['success'] = ($dns_data['status'] === 'ok');
        }
    }

    return $result;
}

/**
 * Start site deployment (background job)
 */
function cmd_deploy_site_start(string $domain, string $email = '', string $username = ''): array
{
    // Basic domain validation
    if (empty($domain)) {
        return ['success' => false, 'error' => 'Domain is required'];
    }

    $domain = preg_replace('/[^a-zA-Z0-9.-]/', '', $domain);
    if (empty($domain) || strlen($domain) < 4 || !preg_match('/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$/', $domain)) {
        return ['success' => false, 'error' => 'Invalid domain format'];
    }

    // Validate email if provided
    if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['success' => false, 'error' => 'Invalid email format'];
    }

    // Generate job ID
    $job_id = 'deploy_' . bin2hex(random_bytes(8));
    $log_file = "/tmp/{$job_id}.log";
    $status_file = "/tmp/{$job_id}.status";

    // Build command
    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-deploy-site']);
    $cmd .= ' --progress';
    $cmd .= ' -d ' . escapeshellarg($domain);

    if (!empty($email)) {
        $cmd .= ' -e ' . escapeshellarg($email);
    }

    if (!empty($username)) {
        $username = preg_replace('/[^a-zA-Z0-9_]/', '', $username);
        if (!empty($username)) {
            $cmd .= ' -u ' . escapeshellarg($username);
        }
    }

    // Run in background
    $background_cmd = "nohup sudo {$cmd} > " . escapeshellarg($log_file) . " 2>&1 & echo $!";

    exec($background_cmd, $output, $return_code);

    $pid = !empty($output[0]) ? trim($output[0]) : '';

    // Write initial status
    $status = [
        'job_id' => $job_id,
        'domain' => $domain,
        'pid' => $pid,
        'started' => date('Y-m-d H:i:s'),
        'status' => 'running',
    ];
    file_put_contents($status_file, json_encode($status));

    log_action('deploy_site_start', "Started deployment for {$domain} (job: {$job_id})");

    return [
        'success' => true,
        'job_id' => $job_id,
        'pid' => $pid,
        'message' => 'Deployment started',
    ];
}

/**
 * Get deployment job status
 */
function cmd_deploy_site_status(string $job_id): array
{
    // Validate job ID format
    if (empty($job_id) || !preg_match('/^deploy_[a-f0-9]+$/', $job_id)) {
        return ['success' => false, 'error' => 'Invalid job ID'];
    }

    $log_file = "/tmp/{$job_id}.log";
    $status_file = "/tmp/{$job_id}.status";

    if (!file_exists($log_file)) {
        return ['success' => false, 'error' => 'Job not found'];
    }

    // Read log file
    $log_content = file_get_contents($log_file);
    $lines = explode("\n", trim($log_content));

    // Parse progress updates
    $progress = [];
    $credentials = null;
    $result_status = null;

    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line)) continue;

        $json = json_decode($line, true);
        if ($json) {
            if (isset($json['step'])) {
                if ($json['step'] === 'credentials') {
                    $credentials = $json;
                } elseif ($json['step'] === 'result') {
                    $result_status = $json;
                } else {
                    $progress[] = $json;
                }
            }
        }
    }

    // Check if process is still running
    $status_data = [];
    if (file_exists($status_file)) {
        $status_data = json_decode(file_get_contents($status_file), true) ?: [];
    }

    $pid = $status_data['pid'] ?? '';
    $is_running = false;
    if (!empty($pid)) {
        exec("ps -p " . escapeshellarg($pid) . " > /dev/null 2>&1", $_, $ps_code);
        $is_running = ($ps_code === 0);
    }

    // Determine overall status
    $complete = false;
    $failed = false;

    if ($result_status) {
        $complete = ($result_status['status'] === 'success');
        $failed = ($result_status['status'] === 'failed');
    } elseif (!$is_running && !empty($progress)) {
        // Process ended without result - check last progress
        $last = end($progress);
        if ($last && $last['status'] === 'error') {
            $failed = true;
        }
    }

    return [
        'success' => true,
        'job_id' => $job_id,
        'running' => $is_running,
        'complete' => $complete,
        'failed' => $failed,
        'progress' => $progress,
        'credentials' => $credentials,
        'raw' => $log_content,
    ];
}

/**
 * List available optimization presets
 */
function cmd_list_optimization_presets(): array
{
    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-optimize-site']) . ' --list-presets';

    $result = execute_command($cmd);

    if ($result['success']) {
        // Parse preset list from output
        $lines = explode("\n", trim($result['output']));
        $presets = [];

        foreach ($lines as $line) {
            $line = trim($line);
            // Skip header lines and empty lines
            if (empty($line) || strpos($line, '===') !== false) {
                continue;
            }

            // Parse "name  description" format
            if (preg_match('/^(\w+)\s+(.+)$/', $line, $matches)) {
                $presets[] = [
                    'name' => $matches[1],
                    'description' => $matches[2],
                ];
            }
        }

        $result['presets'] = $presets;
    }

    return $result;
}

/**
 * Get optimization status for a site
 */
function cmd_get_optimization_status(string $domain): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();
    $vhconf_path = '/usr/local/lsws/conf/vhosts/' . $domain . '/vhconf.conf';

    // Read current PHP settings from vhconf.conf
    $php_settings = [];
    $cmd = '/usr/bin/cat ' . escapeshellarg($vhconf_path);
    $result = execute_command($cmd);

    if ($result['success']) {
        // Parse phpIniOverride section
        if (preg_match('/phpIniOverride\s*\{([^}]+)\}/s', $result['output'], $matches)) {
            $override_block = $matches[1];
            preg_match_all('/php_value\s+(\S+)\s+(\S+)/', $override_block, $value_matches, PREG_SET_ORDER);
            foreach ($value_matches as $match) {
                $php_settings[$match[1]] = $match[2];
            }
        }
    }

    // Check LiteSpeed Cache status via WP-CLI
    $site_path = $config['websites_root'] . '/' . $domain . '/html';
    $lscache_status = 'unknown';

    if (file_exists($site_path . '/wp-config.php')) {
        $wp_cmd = '/usr/local/bin/wp --path=' . escapeshellarg($site_path) . ' --allow-root plugin is-active litespeed-cache 2>/dev/null && echo active || echo inactive';
        $wp_result = execute_command($wp_cmd);
        $lscache_status = trim($wp_result['output']);
    }

    return [
        'success' => true,
        'domain' => $domain,
        'php_settings' => $php_settings,
        'lscache_status' => $lscache_status,
    ];
}

/**
 * Apply optimization preset to a site
 */
function cmd_optimize_site(string $domain, string $preset, bool $audit = false): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    // Validate preset name
    $valid_presets = ['woo', 'blog', 'docs', 'brochure'];
    if (!in_array($preset, $valid_presets, true)) {
        return ['success' => false, 'error' => 'Invalid preset. Valid options: ' . implode(', ', $valid_presets)];
    }

    $config = get_config();
    $cmd = escapeshellcmd($config['commands']['jps-optimize-site']);
    $cmd .= ' ' . escapeshellarg($domain);
    $cmd .= ' --preset=' . escapeshellarg($preset);
    $cmd .= ' --json';

    if ($audit) {
        $cmd .= ' --audit';
    }

    log_action('optimize_site', "{$domain} with preset {$preset}");

    $result = execute_command($cmd);

    // Parse JSON output
    if ($result['success'] && !empty($result['output'])) {
        $json = json_decode($result['output'], true);
        if ($json !== null) {
            $result['optimization'] = $json;
        }
    }

    return $result;
}

/**
 * Get optimization audit for a site
 */
function cmd_audit_optimization(string $domain): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();

    // We'll run a dry-run with audit to see current status
    $cmd = escapeshellcmd($config['commands']['jps-optimize-site']);
    $cmd .= ' ' . escapeshellarg($domain);
    $cmd .= ' --preset=blog --audit --dry-run';

    $result = execute_command($cmd);

    return $result;
}

/**
 * Run performance audit on a site using PageSpeed Insights
 */
function cmd_run_perf_audit(string $domain, string $strategy = 'mobile'): array
{
    $domain = validate_domain($domain);
    if (!$domain) {
        return ['success' => false, 'error' => 'Invalid domain'];
    }

    $config = get_config();
    $strategy = in_array($strategy, ['mobile', 'desktop'], true) ? $strategy : 'mobile';

    $cmd = escapeshellcmd($config['commands']['jps-perf-audit']);
    $cmd .= ' ' . escapeshellarg($domain);
    $cmd .= ' --strategy ' . escapeshellarg($strategy);
    $cmd .= ' --json --save';

    log_action('perf_audit', "{$domain} ({$strategy})");

    $result = execute_command($cmd);

    // jps-perf-audit returns exit codes based on performance score:
    // 0 = good (90+), 1 = needs improvement (50-89), 2 = poor/error (<50)
    // Exit codes 0 and 1 are valid audit results, only 2 indicates an error
    if (!empty($result['output'])) {
        $audit = json_decode($result['output'], true);
        if ($audit !== null && isset($audit['scores'])) {
            return ['success' => true, 'audit' => $audit];
        }
    }

    // If we get here, there was an actual error
    return [
        'success' => false,
        'error' => $result['error'] ?? 'Performance audit failed',
        'output' => $result['output'] ?? '',
    ];
}
