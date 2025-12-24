<?php
/**
 * JPS Admin Panel - Logout Handler
 */

define('JPS_ADMIN', true);

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';

// Initialize session
init_session();

// Log the logout action
if (is_authenticated()) {
    log_action('logout', 'User logged out');
}

// Destroy session
logout();

// Redirect to login
header('Location: login.php');
exit;
