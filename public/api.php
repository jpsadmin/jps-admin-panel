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

    case 'validate_site':
        $domain = $input['domain'] ?? '';
        $result = cmd_validate_site($domain);
        json_response($result);
        break;
    case 'validate_all_sites':
        set_time_limit(600);
        $result = cmd_validate_all_sites();
        json_response($result);
        break;
    case 'filemanager_assets_view':
        $result = cmd_filemanager_assets_view();
        json_response($result);
        break;
    case 'filemanager_sites_view':
        $result = cmd_filemanager_sites_view();
        json_response($result);
        break;

    case 'get_monitor_report':
        $result = cmd_get_monitor_report();
        json_response($result);
        break;

    case 'list_monitor_reports':
        $result = cmd_list_monitor_reports();
        json_response($result);
        break;

    case 'run_daily_monitor':
        set_time_limit(300); // 5 minute timeout
        $result = cmd_run_daily_monitor();
        json_response($result);
        break;

    case 'check_dns':
        $domain = $input['domain'] ?? '';
        $result = cmd_check_dns($domain);
        json_response($result);
        break;

    case 'deploy_site_start':
        $domain = $input['domain'] ?? '';
        $email = $input['email'] ?? '';
        $username = $input['username'] ?? '';
        $result = cmd_deploy_site_start($domain, $email, $username);
        json_response($result);
        break;

    case 'deploy_site_status':
        $job_id = $input['job_id'] ?? '';
        $result = cmd_deploy_site_status($job_id);
        json_response($result);
        break;

    case 'list_optimization_presets':
        $result = cmd_list_optimization_presets();
        json_response($result);
        break;

    case 'get_optimization_status':
        $domain = $input['domain'] ?? '';
        $result = cmd_get_optimization_status($domain);
        json_response($result);
        break;

    case 'optimize_site':
        set_time_limit(120); // 2 minute timeout
        $domain = $input['domain'] ?? '';
        $preset = $input['preset'] ?? '';
        $audit = $input['audit'] ?? false;
        $result = cmd_optimize_site($domain, $preset, $audit);
        json_response($result);
        break;

    case 'audit_optimization':
        $domain = $input['domain'] ?? '';
        $result = cmd_audit_optimization($domain);
        json_response($result);
        break;

    case 'run_perf_audit':
        set_time_limit(180); // 3 minute timeout for PageSpeed API
        $domain = $input['domain'] ?? '';
        $strategy = $input['strategy'] ?? 'mobile';
        $result = cmd_run_perf_audit($domain, $strategy);
        json_response($result);
        break;

    case 'regen_password':
        $domain = $input['domain'] ?? '';
        $username = $input['username'] ?? '';
        $result = cmd_regen_password($domain, $username);
        json_response($result);
        break;

    case 'show_credentials_info':
        $domain = $input['domain'] ?? '';
        $result = cmd_show_credentials($domain);
        json_response($result);
        break;

    case 'install_stack':
        set_time_limit(600); // 10 minute timeout for plugin/theme installation
        $domain = $input['domain'] ?? '';
        $include_ecomm = $input['include_ecomm'] ?? false;
        $result = cmd_install_stack($domain, $include_ecomm);
        json_response($result);
        break;

    case 'migrate_site_start':
        set_time_limit(1800); // 30 minute timeout for migration
        $domain = $input['domain'] ?? '';
        $source = $input['source'] ?? '';
        $source_type = $input['source_type'] ?? '';
        $note = $input['note'] ?? '';
        $result = cmd_migrate_site_start($domain, $source, $source_type, $note);
        json_response($result);
        break;

    case 'get_migration_log':
        $limit = (int)($input['limit'] ?? 20);
        $result = cmd_get_migration_log($limit);
        json_response($result);
        break;

    case 'get_migration_config':
        $result = cmd_get_migration_config();
        json_response($result);
        break;

    case 'list_migration_backups':
        $result = cmd_list_migration_backups();
        json_response($result);
        break;

    case 'cleanup_migration_backups':
        $delete_all = $input['delete_all'] ?? false;
        $days = (int)($input['days'] ?? 7);
        $domain = $input['domain'] ?? '';
        $result = cmd_cleanup_migration_backups($delete_all, $days, $domain);
        json_response($result);
        break;

    default:
        json_response(['success' => false, 'error' => 'Unknown action'], 400);
}
