<?php
/**
 * JPS Admin Panel - API Endpoint
 *
 * Handles all AJAX requests from the frontend.
 * All requests must include a valid CSRF token.
 */

define('JPS_ADMIN', true);

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/commands.php';

// Set JSON content type
header('Content-Type: application/json');

// Enforce HTTPS
enforce_https();

// Check IP restrictions
if (!check_ip_allowed()) {
    json_response(['success' => false, 'error' => 'Access denied'], 403);
}

// Initialize session
init_session();

// Check authentication
if (!is_authenticated()) {
    json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

// Get JSON input if content type is JSON
$input = [];
if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
} else {
    $input = $_POST;
}

// Verify CSRF token
$csrf_token = $input['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!verify_csrf_token($csrf_token)) {
    json_response(['success' => false, 'error' => 'Invalid CSRF token'], 403);
}

// Get action
$action = $input['action'] ?? '';

// Handle actions
switch ($action) {
    case 'get_status':
        $result = cmd_get_status();
        json_response($result);
        break;

    case 'get_sites':
        $result = cmd_get_sites();
        json_response($result);
        break;

    case 'get_full_audit':
        $result = cmd_get_full_audit();
        json_response($result);
        break;

    case 'restart_ols':
        $result = cmd_restart_ols();
        json_response($result);
        break;

    case 'get_credentials':
        $domain = $input['domain'] ?? '';
        $result = cmd_get_credentials($domain);
        json_response($result);
        break;

    case 'create_checkpoint':
        set_time_limit(300); // 5 minute timeout for checkpoint creation
        $domain = $input['domain'] ?? '';
        $result = cmd_create_checkpoint($domain);
        json_response($result);
        break;

    case 'suspend_site':
        $domain = $input['domain'] ?? '';
        $result = cmd_suspend_site($domain);
        json_response($result);
        break;

    case 'resume_site':
        $domain = $input['domain'] ?? '';
        $result = cmd_resume_site($domain);
        json_response($result);
        break;

    case 'archive_site':
        $domain = $input['domain'] ?? '';
        $result = cmd_archive_site($domain);
        json_response($result);
        break;

    case 'delete_site':
        $domain = $input['domain'] ?? '';
        $confirmation = $input['confirmation'] ?? '';
        $result = cmd_delete_site($domain, $confirmation);
        json_response($result);
        break;

    case 'get_site_logs':
        $domain = $input['domain'] ?? '';
        $lines = (int)($input['lines'] ?? 100);
        $result = cmd_get_site_logs($domain, $lines);
        json_response($result);
        break;

    case 'get_lifecycle_log':
        $lines = (int)($input['lines'] ?? 10);
        $result = cmd_get_lifecycle_log($lines);
        json_response($result);
        break;

    case 'git_pull':
        $result = cmd_git_pull();
        json_response($result);
        break;

    case 'fix_permissions':
        $domain = $input['domain'] ?? '';
        $result = cmd_fix_permissions($domain);
        json_response($result);
        break;

    case 'verify_backup':
        $domain = $input['domain'] ?? '';
        $result = cmd_verify_backup($domain);
        json_response($result);
        break;

    case 'get_csrf_token':
        // Refresh CSRF token
        json_response(['success' => true, 'token' => generate_csrf_token()]);
        break;

    case 'deploy_site':
        set_time_limit(300); // 5 minute timeout for site deployment
        $domain = $input['domain'] ?? '';
        $result = cmd_deploy_site($domain);
        json_response($result);
        break;

    case 'save_audit_snapshot':
        $result = cmd_save_audit_snapshot();
        json_response($result);
        break;

    case 'compare_drift':
        $result = cmd_compare_drift();
        json_response($result);
        break;

    case 'get_site_info':
        $domain = $input['domain'] ?? '';
        $result = cmd_get_site_info($domain);
        json_response($result);
        break;

    case 'reinstall_wordpress':
        set_time_limit(600); // 10 minute timeout for reinstall
        $domain = $input['domain'] ?? '';
        $preserve_uploads = $input['preserve_uploads'] ?? true;
        $result = cmd_reinstall_wordpress($domain, $preserve_uploads);
        json_response($result);
        break;

<<<<<<< HEAD
    case 'validate_site':
        $domain = $input['domain'] ?? '';
        $result = cmd_validate_site($domain);
        json_response($result);
        break;

    case 'validate_all_sites':
        set_time_limit(600); // 10 minute timeout for validating all sites
        $result = cmd_validate_all_sites();
        json_response($result);
        break;

=======
    case 'filemanager_assets_view':
        $result = cmd_filemanager_assets_view();
        json_response($result);
        break;
    case 'filemanager_sites_view':
        $result = cmd_filemanager_sites_view();
        json_response($result);
        break;
>>>>>>> 373c8451820fbd15b3c5dd0aed65e371b1f50e3c
    default:
        json_response(['success' => false, 'error' => 'Unknown action'], 400);
}
