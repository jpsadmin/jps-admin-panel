<?php
/**
 * JPS Admin Panel - Authentication Functions
 */

defined('JPS_ADMIN') or die('Direct access not permitted');

/**
 * Initialize session with secure settings
 */
function init_session(): void
{
    $config = get_config();

    if (session_status() === PHP_SESSION_NONE) {
        // Secure session settings
        ini_set('session.cookie_httponly', '1');
        ini_set('session.cookie_samesite', 'Strict');
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');

        if ($config['https_required'] || is_https()) {
            ini_set('session.cookie_secure', '1');
        }

        session_name($config['session_name']);
        session_start();
    }

    // Regenerate session ID periodically to prevent fixation
    if (!isset($_SESSION['created'])) {
        $_SESSION['created'] = time();
    } elseif (time() - $_SESSION['created'] > 1800) {
        session_regenerate_id(true);
        $_SESSION['created'] = time();
    }
}

/**
 * Check if current connection is HTTPS
 */
function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
        || (!empty($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443);
}

/**
 * Enforce HTTPS if required
 */
function enforce_https(): void
{
    $config = get_config();

    if ($config['https_required'] && !is_https()) {
        $redirect = 'https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        header('Location: ' . $redirect, true, 301);
        exit;
    }
}

/**
 * Check if IP is allowed
 */
function check_ip_allowed(): bool
{
    $config = get_config();

    // If no IPs specified, allow all
    if (empty($config['allowed_ips'])) {
        return true;
    }

    $client_ip = get_client_ip();

    foreach ($config['allowed_ips'] as $allowed_ip) {
        if ($client_ip === $allowed_ip) {
            return true;
        }
        // Support CIDR notation
        if (strpos($allowed_ip, '/') !== false && ip_in_cidr($client_ip, $allowed_ip)) {
            return true;
        }
    }

    return false;
}

/**
 * Get client IP address
 */
function get_client_ip(): string
{
    $headers = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];

    foreach ($headers as $header) {
        if (!empty($_SERVER[$header])) {
            $ip = $_SERVER[$header];
            // X-Forwarded-For can contain multiple IPs
            if (strpos($ip, ',') !== false) {
                $ip = trim(explode(',', $ip)[0]);
            }
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }

    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/**
 * Check if IP is in CIDR range
 */
function ip_in_cidr(string $ip, string $cidr): bool
{
    list($subnet, $bits) = explode('/', $cidr);
    $ip = ip2long($ip);
    $subnet = ip2long($subnet);
    $mask = -1 << (32 - (int)$bits);
    $subnet &= $mask;

    return ($ip & $mask) === $subnet;
}

/**
 * Check if user is authenticated
 */
function is_authenticated(): bool
{
    $config = get_config();

    if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
        return false;
    }

    // Check session timeout
    if (isset($_SESSION['last_activity'])) {
        $inactive = time() - $_SESSION['last_activity'];
        if ($inactive > $config['session_timeout']) {
            logout();
            return false;
        }
    }

    // Update last activity
    $_SESSION['last_activity'] = time();

    return true;
}

/**
 * Attempt to authenticate user
 */
function authenticate(string $username, string $password): bool
{
    $config = get_config();

    // Rate limiting - simple implementation
    $attempts_key = 'login_attempts_' . get_client_ip();
    $attempts = $_SESSION[$attempts_key] ?? 0;
    $lockout_until = $_SESSION[$attempts_key . '_lockout'] ?? 0;

    if ($lockout_until > time()) {
        return false;
    }

    if ($username === $config['username'] && password_verify($password, $config['password_hash'])) {
        // Reset attempts on success
        unset($_SESSION[$attempts_key], $_SESSION[$attempts_key . '_lockout']);

        // Set session variables
        $_SESSION['authenticated'] = true;
        $_SESSION['username'] = $username;
        $_SESSION['last_activity'] = time();
        $_SESSION['ip'] = get_client_ip();

        // Regenerate session ID on login
        session_regenerate_id(true);

        return true;
    }

    // Track failed attempts
    $attempts++;
    $_SESSION[$attempts_key] = $attempts;

    // Lockout after 5 failed attempts
    if ($attempts >= 5) {
        $_SESSION[$attempts_key . '_lockout'] = time() + 900; // 15 minutes
    }

    return false;
}

/**
 * Logout user
 */
function logout(): void
{
    $_SESSION = [];

    if (isset($_COOKIE[session_name()])) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }

    session_destroy();
}

/**
 * Generate CSRF token
 */
function generate_csrf_token(): string
{
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

/**
 * Verify CSRF token
 */
function verify_csrf_token(?string $token): bool
{
    if (empty($token) || empty($_SESSION['csrf_token'])) {
        return false;
    }

    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Get CSRF token input field
 */
function csrf_field(): string
{
    return '<input type="hidden" name="csrf_token" value="' . htmlspecialchars(generate_csrf_token()) . '">';
}

/**
 * Require authentication - redirect to login if not authenticated
 */
function require_auth(): void
{
    if (!is_authenticated()) {
        header('Location: login.php');
        exit;
    }
}

/**
 * Check if login is locked out
 */
function is_locked_out(): bool
{
    $lockout_until = $_SESSION['login_attempts_' . get_client_ip() . '_lockout'] ?? 0;
    return $lockout_until > time();
}

/**
 * Get remaining lockout time in seconds
 */
function get_lockout_remaining(): int
{
    $lockout_until = $_SESSION['login_attempts_' . get_client_ip() . '_lockout'] ?? 0;
    return max(0, $lockout_until - time());
}
