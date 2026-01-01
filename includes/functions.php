<?php
/**
 * JPS Admin Panel - Helper Functions
 */

defined('JPS_ADMIN') or die('Direct access not permitted');

// Store config globally
$_jps_config = null;

/**
 * Load and cache configuration
 */
function get_config(): array
{
    global $_jps_config;

    if ($_jps_config === null) {
        $config_file = __DIR__ . '/config.php';

        if (!file_exists($config_file)) {
            die('Configuration file not found. Copy config.example.php to config.php and configure it.');
        }

        $_jps_config = require $config_file;
    }

    return $_jps_config;
}

/**
 * Escape HTML output
 */
function h(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

/**
 * Send JSON response
 */
function json_response(array $data, int $status_code = 200): void
{
    http_response_code($status_code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Strip ANSI color codes from output
 */
function strip_ansi(string $text): string
{
    return preg_replace('/\e\[[0-9;]*m/', '', $text);
}

/**
 * Convert ANSI color codes to HTML spans
 */
function ansi_to_html(string $text): string
{
    // Color mapping
    $colors = [
        '30' => '#000000',
        '31' => '#ff4444',
        '32' => '#00ff88',
        '33' => '#ffaa00',
        '34' => '#00d4ff',
        '35' => '#ff66ff',
        '36' => '#00ffff',
        '37' => '#ffffff',
        '90' => '#888888',
        '91' => '#ff6666',
        '92' => '#88ff88',
        '93' => '#ffff88',
        '94' => '#8888ff',
        '95' => '#ff88ff',
        '96' => '#88ffff',
        '97' => '#ffffff',
    ];

    // Escape HTML first
    $text = h($text);

    // Replace ANSI codes with spans
    $text = preg_replace_callback('/\033\[([0-9;]+)m/', function ($matches) use ($colors) {
        $codes = explode(';', $matches[1]);
        $styles = [];

        foreach ($codes as $code) {
            if ($code === '0') {
                return '</span>';
            } elseif ($code === '1') {
                $styles[] = 'font-weight:bold';
            } elseif (isset($colors[$code])) {
                $styles[] = 'color:' . $colors[$code];
            }
        }

        if (empty($styles)) {
            return '';
        }

        return '<span style="' . implode(';', $styles) . '">';
    }, $text);

    // Close any unclosed spans
    $open_spans = substr_count($text, '<span');
    $close_spans = substr_count($text, '</span>');
    $text .= str_repeat('</span>', $open_spans - $close_spans);

    return $text;
}

/**
 * Parse jps-status output into structured data
 */
function parse_status_output(string $output): array
{
    $sites = [];
    $lines = explode("\n", trim($output));
    $in_table = false;

    foreach ($lines as $line) {
        $line = strip_ansi($line);

        // Skip header lines and separators
        if (empty($line) || strpos($line, '─') !== false || strpos($line, '═') !== false) {
            continue;
        }

        // Check if we're in the table section
        if (strpos($line, 'Domain') !== false && strpos($line, 'Size') !== false) {
            $in_table = true;
            continue;
        }

        if (!$in_table) {
            continue;
        }

        // Parse table row - expected format: Domain | Size | WP Ver | SSL Expiry | Status
        // Handle pipe-separated or space-separated formats
        if (strpos($line, '│') !== false) {
            $parts = array_map('trim', explode('│', $line));
            $parts = array_values(array_filter($parts));
        } else {
            // Space-separated fallback
            $parts = preg_split('/\s{2,}/', trim($line));
        }

        if (count($parts) >= 4) {
            $site = [
                'domain' => $parts[0] ?? '',
                'size' => $parts[1] ?? '',
                'wp_version' => $parts[2] ?? 'N/A',
                'ssl_expiry' => $parts[3] ?? '',
                'status' => $parts[4] ?? 'active',
            ];

            // Skip if domain looks invalid
            if (!empty($site['domain']) && strpos($site['domain'], '.') !== false) {
                $sites[] = $site;
            }
        }
    }

    return $sites;
}

/**
 * Parse jps-audit --brief output into structured data
 *
 * Brief output format example:
 *   JPS Server Audit Summary
 *   ========================
 *   Host: server.example.com (69.62.67.12)
 *   Resources: CPU 5.2% | Memory 45%
 *   Services: OLS running | MariaDB running
 *   Websites: 5
 */
function parse_audit_brief(string $output): array
{
    $data = [
        'cpu' => ['usage' => 0, 'status' => 'ok'],
        'memory' => ['usage' => 0, 'total' => '', 'used' => '', 'status' => 'ok'],
        'disk' => ['usage' => 0, 'total' => '', 'used' => '', 'status' => 'ok'],
        'services' => [
            'ols' => false,
            'mariadb' => false,
            'fail2ban' => false,
        ],
        'raw' => $output,
    ];

    // Strip ANSI codes from entire output first
    $clean_output = strip_ansi($output);
    $lines = explode("\n", $clean_output);

    foreach ($lines as $line) {
        // Parse CPU usage - handle multiple formats:
        // - Brief format: "Resources: CPU 5.2% | Memory 45%"
        // - Standard format: "CPU Usage: 0.0%" or "CPU: 5%"
        // Match "CPU" followed by space and number (brief format)
        if (preg_match('/CPU\s+(\d+(?:\.\d+)?)\s*%/', $line, $m)) {
            $data['cpu']['usage'] = (float)$m[1];
            $data['cpu']['status'] = get_status_level($data['cpu']['usage']);
        }
        // Match "CPU Usage:" or "CPU:" format (standard format)
        elseif (preg_match('/CPU(?:\s+Usage)?:\s*(\d+(?:\.\d+)?)\s*%/', $line, $m)) {
            $data['cpu']['usage'] = (float)$m[1];
            $data['cpu']['status'] = get_status_level($data['cpu']['usage']);
        }

        // Parse Memory usage - handle multiple formats:
        // - Brief format: "Memory 45%"
        // - Standard format with percentage: "Memory: 45%" or "(45%)"
        // - Standard format with size: "Memory Used: 1.12 GB / 15.61 GB (7.2%)"
        // Match "Memory" followed by space and number% (brief format)
        if (preg_match('/Memory\s+(\d+(?:\.\d+)?)\s*%/', $line, $m)) {
            $data['memory']['usage'] = (float)$m[1];
            $data['memory']['status'] = get_status_level($data['memory']['usage']);
        }
        // Match percentage in parentheses (standard format with size)
        elseif (preg_match('/Memory.*\((\d+(?:\.\d+)?)\s*%\)/', $line, $m)) {
            $data['memory']['usage'] = (float)$m[1];
            $data['memory']['status'] = get_status_level($data['memory']['usage']);
        }
        // Match "Memory:" with percentage
        elseif (preg_match('/Memory:\s*(\d+(?:\.\d+)?)\s*%/', $line, $m)) {
            $data['memory']['usage'] = (float)$m[1];
            $data['memory']['status'] = get_status_level($data['memory']['usage']);
        }
        // Extract memory used/total if present
        if (preg_match('/Memory[^:]*:\s*([0-9.]+\s*[GMK]?i?B?)\s*\/\s*([0-9.]+\s*[GMK]?i?B?)/', $line, $m)) {
            $data['memory']['used'] = trim($m[1]);
            $data['memory']['total'] = trim($m[2]);
        }

        // Parse Disk usage
        // Match "Disk" followed by space and number% (brief format - if added)
        if (preg_match('/Disk\s+(\d+(?:\.\d+)?)\s*%/', $line, $m)) {
            $data['disk']['usage'] = (float)$m[1];
            $data['disk']['status'] = get_status_level($data['disk']['usage']);
        }
        // Match percentage in parentheses (standard format)
        elseif (preg_match('/(?:Disk|\/):.*\((\d+(?:\.\d+)?)\s*%\)/', $line, $m)) {
            $data['disk']['usage'] = (float)$m[1];
            $data['disk']['status'] = get_status_level($data['disk']['usage']);
        }
        // Match "Disk:" with percentage
        elseif (preg_match('/Disk:\s*(\d+(?:\.\d+)?)\s*%/', $line, $m)) {
            $data['disk']['usage'] = (float)$m[1];
            $data['disk']['status'] = get_status_level($data['disk']['usage']);
        }
        // Extract disk used/total if present
        if (preg_match('/(?:Disk|\/)[^:]*:\s*([0-9.]+\s*[GMK]?i?B?)\s*\/\s*([0-9.]+\s*[GMK]?i?B?)/', $line, $m)) {
            $data['disk']['used'] = trim($m[1]);
            $data['disk']['total'] = trim($m[2]);
        }

        // Parse service statuses - check for positive indicators (running/active/ok/checkmarks)
        // and negative indicators (stopped/inactive/failed/error/✗/✕)
        $line_lower = strtolower($line);

        // Check for positive status indicators (case-insensitive)
        $is_running = preg_match('/\b(running|active|ok|up)\b/i', $line) === 1
                   || preg_match('/[✓✔]/u', $line) === 1;

        // Check for negative status indicators (case-insensitive)
        $is_stopped = preg_match('/\b(stopped|inactive|failed|error|down|dead)\b/i', $line) === 1
                   || preg_match('/[✗✕]/u', $line) === 1;

        // Service is running if positive indicator found and no negative indicator
        $service_status = $is_running && !$is_stopped;

        if (strpos($line_lower, 'openlitespeed') !== false || strpos($line_lower, 'ols') !== false || strpos($line_lower, 'lsws') !== false) {
            $data['services']['ols'] = $service_status;
        }
        if (strpos($line_lower, 'mariadb') !== false || strpos($line_lower, 'mysql') !== false) {
            $data['services']['mariadb'] = $service_status;
        }
        if (strpos($line_lower, 'fail2ban') !== false) {
            $data['services']['fail2ban'] = $service_status;
        }
    }

    // Disk is NOT in the brief output, so fetch it directly from df
    if ($data['disk']['usage'] === 0) {
        $df_output = shell_exec('df -h / 2>/dev/null | tail -1');
        if ($df_output && preg_match('/(\d+)%/', $df_output, $m)) {
            $data['disk']['usage'] = (float)$m[1];
            $data['disk']['status'] = get_status_level($data['disk']['usage']);
        }
        // Also get used/total
        if ($df_output && preg_match('/\s+([0-9.]+[GMK]?)\s+([0-9.]+[GMK]?)\s+[0-9.]+[GMK]?\s+\d+%/', $df_output, $m)) {
            $data['disk']['total'] = $m[1];
            $data['disk']['used'] = $m[2];
        }
    }

    // Direct service status checks as fallbacks
    $ols_status = trim(shell_exec('pgrep -x lshttpd >/dev/null 2>&1 && echo active || pgrep -f litespeed >/dev/null 2>&1 && echo active || echo inactive') ?? '');
    if ($ols_status === 'active') {
        $data['services']['ols'] = true;
    }

    $mariadb_status = trim(shell_exec('systemctl is-active mariadb 2>/dev/null || systemctl is-active mysql 2>/dev/null') ?? '');
    if ($mariadb_status === 'active') {
        $data['services']['mariadb'] = true;
    }

    $fail2ban_status = trim(shell_exec('systemctl is-active fail2ban 2>/dev/null') ?? '');
    $data['services']['fail2ban'] = ($fail2ban_status === 'active');

    return $data;
}

/**
 * Get status level based on percentage
 */
function get_status_level(float $percentage): string
{
    if ($percentage < 50) {
        return 'ok';
    } elseif ($percentage < 80) {
        return 'warning';
    } else {
        return 'critical';
    }
}

/**
 * Format bytes to human readable
 */
function format_bytes(int $bytes, int $precision = 2): string
{
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);

    return round($bytes, $precision) . ' ' . $units[$pow];
}

/**
 * Get relative time string
 */
function time_ago(string $datetime): string
{
    $time = strtotime($datetime);
    $diff = time() - $time;

    if ($diff < 60) {
        return 'just now';
    } elseif ($diff < 3600) {
        $mins = floor($diff / 60);
        return $mins . ' minute' . ($mins > 1 ? 's' : '') . ' ago';
    } elseif ($diff < 86400) {
        $hours = floor($diff / 3600);
        return $hours . ' hour' . ($hours > 1 ? 's' : '') . ' ago';
    } elseif ($diff < 604800) {
        $days = floor($diff / 86400);
        return $days . ' day' . ($days > 1 ? 's' : '') . ' ago';
    } else {
        return date('M j, Y', $time);
    }
}

/**
 * Read last N lines from a file
 */
function tail_file(string $filepath, int $lines = 10): string
{
    if (!file_exists($filepath) || !is_readable($filepath)) {
        return '';
    }

    $result = [];
    $fp = fopen($filepath, 'r');

    if (!$fp) {
        return '';
    }

    // Move to end of file
    fseek($fp, 0, SEEK_END);
    $pos = ftell($fp);
    $buffer = '';
    $line_count = 0;

    while ($pos > 0 && $line_count < $lines) {
        $pos--;
        fseek($fp, $pos);
        $char = fgetc($fp);

        if ($char === "\n") {
            if (!empty($buffer)) {
                $result[] = $buffer;
                $line_count++;
                $buffer = '';
            }
        } else {
            $buffer = $char . $buffer;
        }
    }

    if (!empty($buffer) && $line_count < $lines) {
        $result[] = $buffer;
    }

    fclose($fp);

    return implode("\n", array_reverse($result));
}

/**
 * Get list of site directories
 */
function get_site_list(): array
{
    $config = get_config();
    $sites_dir = $config['websites_root'];
    $sites = [];

    if (!is_dir($sites_dir)) {
        return $sites;
    }

    $dirs = scandir($sites_dir);

    foreach ($dirs as $dir) {
        if ($dir === '.' || $dir === '..') {
            continue;
        }

        $site_path = $sites_dir . '/' . $dir;
        if (is_dir($site_path) && strpos($dir, '.') !== false) {
            $sites[] = $dir;
        }
    }

    sort($sites);
    return $sites;
}

/**
 * Log an action to the admin panel log
 */
function log_action(string $action, string $details = ''): void
{
    $log_file = dirname(__DIR__) . '/logs/admin-panel.log';
    $log_dir = dirname($log_file);

    if (!is_dir($log_dir)) {
        mkdir($log_dir, 0755, true);
    }

    $entry = sprintf(
        "[%s] [%s] [%s] %s%s\n",
        date('Y-m-d H:i:s'),
        get_client_ip(),
        $_SESSION['username'] ?? 'anonymous',
        $action,
        $details ? ": $details" : ''
    );

    file_put_contents($log_file, $entry, FILE_APPEND | LOCK_EX);
}

/**
 * Generate a secure random token
 */
function generate_token(int $length = 32): string
{
    return bin2hex(random_bytes($length));
}
