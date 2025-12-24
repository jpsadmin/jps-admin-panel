<?php
/**
 * JPS Admin Panel - Logs Viewer Component
 *
 * Contains log rendering helpers.
 */

defined('JPS_ADMIN') or die('Direct access not permitted');

/**
 * Render a log entry
 */
function render_log_entry(string $line): string
{
    // Parse common log formats
    // Format: [timestamp] [level] message
    $html_line = h($line);

    // Highlight timestamps
    $html_line = preg_replace(
        '/\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[^\]]*)\]/',
        '<span class="log-timestamp">[$1]</span>',
        $html_line
    );

    // Highlight log levels
    $html_line = preg_replace('/\[(ERROR|FATAL|CRITICAL)\]/i', '<span class="log-error">[$1]</span>', $html_line);
    $html_line = preg_replace('/\[(WARN|WARNING)\]/i', '<span class="log-warning">[$1]</span>', $html_line);
    $html_line = preg_replace('/\[(INFO)\]/i', '<span class="log-info">[$1]</span>', $html_line);
    $html_line = preg_replace('/\[(DEBUG)\]/i', '<span class="log-debug">[$1]</span>', $html_line);

    // Highlight actions
    $html_line = preg_replace('/(created|completed|success|started)/i', '<span class="log-success">$1</span>', $html_line);
    $html_line = preg_replace('/(deleted|removed|failed|error)/i', '<span class="log-error">$1</span>', $html_line);
    $html_line = preg_replace('/(suspended|archived|updated)/i', '<span class="log-warning">$1</span>', $html_line);

    return '<div class="log-line">' . $html_line . '</div>';
}

/**
 * Render activity log
 */
function render_activity_log(string $log_content): string
{
    $lines = array_filter(explode("\n", trim($log_content)));

    if (empty($lines)) {
        return '<div class="empty-log">No recent activity</div>';
    }

    $html = '<div class="log-entries">';
    foreach ($lines as $line) {
        $html .= render_log_entry($line);
    }
    $html .= '</div>';

    return $html;
}

/**
 * Render error log viewer
 */
function render_error_log(string $domain, string $log_content): string
{
    $domain = h($domain);
    $lines = array_filter(explode("\n", trim($log_content)));

    if (empty($lines)) {
        return <<<HTML
<div class="log-viewer">
    <div class="log-header">
        <h4>Error Log: {$domain}</h4>
    </div>
    <div class="log-content empty-log">
        No errors found
    </div>
</div>
HTML;
    }

    $entries = '';
    foreach ($lines as $line) {
        $entries .= render_log_entry($line);
    }

    return <<<HTML
<div class="log-viewer">
    <div class="log-header">
        <h4>Error Log: {$domain}</h4>
        <span class="log-count">{count($lines)} entries</span>
    </div>
    <div class="log-content">
        {$entries}
    </div>
</div>
HTML;
}
