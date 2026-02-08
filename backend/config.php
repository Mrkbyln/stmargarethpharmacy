<?php
// Database credentials must be provided via environment variables on the server.
// Remove any hardcoded credentials — set these on Hostinger (or your server) instead.
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: '');
define('DB_USER', getenv('DB_USER') ?: '');
define('DB_PASS', getenv('DB_PASS') ?: '');

// Fail-fast in logs if envs are missing (do not expose secrets in responses)
if (DB_NAME === '' || DB_USER === '' || DB_PASS === '') {
    error_log('Missing required database environment variables: DB_NAME/DB_USER/DB_PASS');
}

// Allowed origin for CORS. Set to your frontend URL (Vercel) in production.
define('API_ALLOW_ORIGIN', getenv('API_ALLOW_ORIGIN') ?: '*');

// Small helper
function env($key, $default = null) {
    $v = getenv($key);
    return $v === false ? $default : $v;
}

?>
