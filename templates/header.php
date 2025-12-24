<?php
/**
 * JPS Admin Panel - Header Template
 */

defined('JPS_ADMIN') or die('Direct access not permitted');

$config = get_config();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo h($config['site_name']); ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/style.css">
    <meta name="csrf-token" content="<?php echo h(generate_csrf_token()); ?>">
</head>
<body>
    <header class="main-header">
        <div class="header-left">
            <h1 class="logo"><?php echo h($config['site_name']); ?></h1>
            <div class="server-badges">
                <span class="badge badge-info"><?php echo h($config['server_ip']); ?></span>
                <span class="badge badge-secondary"><?php echo h($config['server_os']); ?></span>
                <span class="badge badge-secondary"><?php echo h($config['web_server']); ?></span>
                <span class="badge badge-secondary">PHP <?php echo h($config['php_version']); ?></span>
            </div>
        </div>
        <div class="header-right">
            <span class="user-info">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <?php echo h($_SESSION['username'] ?? 'Admin'); ?>
            </span>
            <a href="logout.php" class="btn btn-secondary btn-sm">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Logout
            </a>
        </div>
    </header>
    <main class="main-content">
