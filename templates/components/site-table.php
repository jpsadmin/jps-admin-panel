<?php
/**
 * JPS Admin Panel - Site Table Component
 *
 * This component renders the sites table rows.
 * Used for AJAX partial updates.
 */

defined('JPS_ADMIN') or die('Direct access not permitted');

/**
 * Render a site table row
 */
function render_site_row(array $site): string
{
    $domain = h($site['domain']);
    $size = h($site['size']);
    $wp_version = h($site['wp_version']);
    $ssl_expiry = h($site['ssl_expiry']);
    $status = strtolower($site['status'] ?? 'active');

    $status_class = $status === 'suspended' ? 'status-warning' : 'status-ok';
    $status_text = ucfirst($status);

    // Determine which suspend/resume button to show
    $suspend_btn = $status === 'suspended'
        ? '<button type="button" class="btn-icon btn-resume" data-domain="' . $domain . '" title="Resume Site">&#x25B6;&#xFE0F;</button>'
        : '<button type="button" class="btn-icon btn-suspend" data-domain="' . $domain . '" title="Suspend Site">&#x23F8;&#xFE0F;</button>';

    return <<<HTML
<tr data-domain="{$domain}">
    <td class="domain-cell">
        <a href="https://{$domain}" target="_blank" rel="noopener noreferrer">{$domain}</a>
    </td>
    <td>{$size}</td>
    <td>{$wp_version}</td>
    <td>{$ssl_expiry}</td>
    <td><span class="status-badge {$status_class}">{$status_text}</span></td>
    <td class="actions-cell">
        <div class="btn-group">
            <button type="button" class="btn-icon btn-credentials" data-domain="{$domain}" title="View Credentials">&#x1F4CB;</button>
            <button type="button" class="btn-icon btn-checkpoint" data-domain="{$domain}" title="Create Checkpoint">&#x1F4BE;</button>
            {$suspend_btn}
            <button type="button" class="btn-icon btn-archive" data-domain="{$domain}" title="Archive Site">&#x1F4E6;</button>
            <button type="button" class="btn-icon btn-logs" data-domain="{$domain}" title="View Logs">&#x1F4C1;</button>
            <button type="button" class="btn-icon btn-delete btn-danger" data-domain="{$domain}" title="Delete Site">&#x1F5D1;&#xFE0F;</button>
        </div>
    </td>
</tr>
HTML;
}

/**
 * Render empty state
 */
function render_sites_empty(): string
{
    return <<<HTML
<tr>
    <td colspan="6" class="empty-row">
        <p>No sites found</p>
    </td>
</tr>
HTML;
}

/**
 * Render error state
 */
function render_sites_error(string $error): string
{
    $error = h($error);
    return <<<HTML
<tr>
    <td colspan="6" class="error-row">
        <p>Error loading sites: {$error}</p>
    </td>
</tr>
HTML;
}
