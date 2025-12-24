<?php
/**
 * JPS Admin Panel - Server Status Component
 *
 * This component renders the server health metrics.
 * Used for AJAX partial updates.
 */

defined('JPS_ADMIN') or die('Direct access not permitted');

/**
 * Render health bar HTML
 */
function render_health_bar(string $label, float $value, string $status): string
{
    $status_class = 'status-' . $status;

    return <<<HTML
<div class="health-item">
    <div class="health-label">{$label}</div>
    <div class="health-bar">
        <div class="health-bar-fill {$status_class}" style="width: {$value}%"></div>
    </div>
    <div class="health-value">{$value}%</div>
</div>
HTML;
}

/**
 * Render service status HTML
 */
function render_service_status(string $name, string $display_name, bool $running): string
{
    $status_class = $running ? 'status-ok' : 'status-critical';
    $status_text = $running ? 'Running' : 'Stopped';

    return <<<HTML
<div class="service-item" id="service-{$name}">
    <span class="service-indicator {$status_class}"></span>
    <span class="service-name">{$display_name}</span>
    <span class="service-status">{$status_text}</span>
</div>
HTML;
}
