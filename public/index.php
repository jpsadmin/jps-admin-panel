<?php
/**
 * JPS Admin Panel - Main Entry Point
 *
 * This is the main dashboard page. All requests are routed through here.
 */

define('JPS_ADMIN', true);

// Error handling - log errors, don't display them
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Load dependencies
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';

// Enforce HTTPS
enforce_https();

// Check IP restrictions
if (!check_ip_allowed()) {
    http_response_code(403);
    die('Access denied');
}

// Initialize session
init_session();

// Require authentication
if (!is_authenticated()) {
    header('Location: login.php');
    exit;
}

// Load command functions for potential use
require_once __DIR__ . '/../includes/commands.php';

// Load component templates
require_once __DIR__ . '/../templates/components/server-status.php';
require_once __DIR__ . '/../templates/components/site-table.php';
require_once __DIR__ . '/../templates/components/actions-panel.php';
require_once __DIR__ . '/../templates/components/logs-viewer.php';

// Render the page
require_once __DIR__ . '/../templates/header.php';
require_once __DIR__ . '/../templates/dashboard.php';
require_once __DIR__ . '/../templates/footer.php';
