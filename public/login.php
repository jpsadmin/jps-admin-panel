<?php
/**
 * JPS Admin Panel - Login Page
 */

define('JPS_ADMIN', true);

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

// Redirect if already authenticated
if (is_authenticated()) {
    header('Location: index.php');
    exit;
}

$error = '';
$config = get_config();

// Handle login form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Verify CSRF token
    if (!verify_csrf_token($_POST['csrf_token'] ?? '')) {
        $error = 'Invalid request. Please try again.';
    } elseif (is_locked_out()) {
        $remaining = ceil(get_lockout_remaining() / 60);
        $error = "Too many failed attempts. Try again in {$remaining} minute(s).";
    } else {
        $username = $_POST['username'] ?? '';
        $password = $_POST['password'] ?? '';

        if (authenticate($username, $password)) {
            log_action('login', 'Successful login');
            header('Location: index.php');
            exit;
        } else {
            log_action('login_failed', 'Failed login attempt for user: ' . $username);
            $error = 'Invalid username or password.';
        }
    }
}

// Generate CSRF token
$csrf_token = generate_csrf_token();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - <?php echo h($config['site_name']); ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
        }

        .login-container {
            background: linear-gradient(145deg, #1e1e3f, #16213e);
            border: 1px solid rgba(0, 212, 255, 0.2);
            border-radius: 16px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .logo {
            text-align: center;
            margin-bottom: 30px;
        }

        .logo h1 {
            font-size: 24px;
            font-weight: 600;
            color: #00d4ff;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .logo p {
            color: #888899;
            font-size: 14px;
            margin-top: 5px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #cccccc;
            font-size: 14px;
            font-weight: 500;
        }

        .form-group input {
            width: 100%;
            padding: 14px 16px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: #ffffff;
            font-size: 16px;
            transition: all 0.3s ease;
        }

        .form-group input:focus {
            outline: none;
            border-color: #00d4ff;
            box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
        }

        .form-group input::placeholder {
            color: #666677;
        }

        .btn {
            width: 100%;
            padding: 14px 20px;
            background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
            border: none;
            border-radius: 8px;
            color: #ffffff;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .btn:hover {
            background: linear-gradient(135deg, #00e5ff 0%, #00aadd 100%);
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
        }

        .btn:active {
            transform: translateY(0);
        }

        .error-message {
            background: rgba(255, 68, 68, 0.1);
            border: 1px solid rgba(255, 68, 68, 0.3);
            color: #ff6666;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }

        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .footer p {
            color: #666677;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1><?php echo h($config['site_name']); ?></h1>
            <p>VPS Server Management</p>
        </div>

        <?php if ($error): ?>
            <div class="error-message">
                <?php echo h($error); ?>
            </div>
        <?php endif; ?>

        <form method="POST" action="">
            <input type="hidden" name="csrf_token" value="<?php echo h($csrf_token); ?>">

            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" placeholder="Enter username" required autofocus autocomplete="username">
            </div>

            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" placeholder="Enter password" required autocomplete="current-password">
            </div>

            <button type="submit" class="btn">Sign In</button>
        </form>

        <div class="footer">
            <p>&copy; <?php echo date('Y'); ?> JPS Hosting</p>
        </div>
    </div>
</body>
</html>
