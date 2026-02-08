<?php
// Update these values with your Hostinger MySQL credentials.
// You can also set them as environment variables and leave these empty.
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'u690595720_stmargareth_db');
define('DB_USER', getenv('DB_USER') ?: 'u690595720_stmargareth');
define('DB_PASS', getenv('DB_PASS') ?: 'F+=X!H3w');

// Allowed origin for CORS. Set to your frontend URL (Vercel) in production.
define('API_ALLOW_ORIGIN', getenv('API_ALLOW_ORIGIN') ?: '*');

// Small helper
function env($key, $default = null) {
    $v = getenv($key);
    return $v === false ? $default : $v;
}

?>
