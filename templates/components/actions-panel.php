<?php
/**
 * JPS Admin Panel - Actions Panel Component
 *
 * Contains action button rendering helpers.
 */

defined('JPS_ADMIN') or die('Direct access not permitted');

/**
 * Render an action button
 */
function render_action_button(string $id, string $icon, string $label, string $class = ''): string
{
    $class = $class ? "action-btn {$class}" : 'action-btn';

    return <<<HTML
<button type="button" class="{$class}" id="{$id}">
    <span class="action-icon">{$icon}</span>
    <span class="action-label">{$label}</span>
</button>
HTML;
}

/**
 * Render confirmation dialog content
 */
function render_confirmation_dialog(string $title, string $message, string $confirm_text = 'Confirm', string $cancel_text = 'Cancel'): string
{
    return <<<HTML
<div class="confirmation-dialog">
    <h4>{$title}</h4>
    <p>{$message}</p>
    <div class="dialog-actions">
        <button type="button" class="btn btn-secondary btn-cancel">{$cancel_text}</button>
        <button type="button" class="btn btn-danger btn-confirm">{$confirm_text}</button>
    </div>
</div>
HTML;
}

/**
 * Render delete confirmation dialog with domain input
 */
function render_delete_confirmation(string $domain): string
{
    $domain = h($domain);

    return <<<HTML
<div class="delete-confirmation">
    <div class="warning-banner">
        <span class="warning-icon">&#x26A0;&#xFE0F;</span>
        <strong>Warning: This action cannot be undone!</strong>
    </div>

    <p>You are about to permanently delete the site:</p>
    <p class="domain-display"><strong>{$domain}</strong></p>

    <p>This will remove:</p>
    <ul>
        <li>All site files and directories</li>
        <li>Database and database user</li>
        <li>Virtual host configuration</li>
        <li>SSL certificates</li>
    </ul>

    <div class="form-group">
        <label>
            <input type="checkbox" id="delete-understand-checkbox" required>
            I understand this action cannot be undone
        </label>
    </div>

    <div class="form-group">
        <label for="delete-domain-input">Type the domain name to confirm:</label>
        <input type="text" id="delete-domain-input" placeholder="{$domain}" autocomplete="off">
    </div>

    <div class="dialog-actions">
        <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
        <button type="button" class="btn btn-danger btn-confirm-delete" disabled data-domain="{$domain}">
            Delete Permanently
        </button>
    </div>
</div>
HTML;
}
