<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Basic CORS and JSON headers
header('Access-Control-Allow-Origin: ' . API_ALLOW_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // preflight
    http_response_code(204);
    exit;
}

// Determine path after /api/
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$base = strpos($uri, '/api/');
$path = $base === false ? '' : substr($uri, $base + 5);
$segments = array_values(array_filter(explode('/', $path)));

$method = $_SERVER['REQUEST_METHOD'];

function getJsonInput() {
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);
    return is_array($data) ? $data : [];
}

try {
    $db = get_db();

    // Route: /api/products or /api/products/{id}
    // Health check: /api/health
    if (isset($segments[0]) && $segments[0] === 'health') {
        try {
            // Attempt to get a DB connection
            $db = get_db();
            echo json_encode(['ok' => true, 'db' => 'connected']);
        } catch (Exception $e) {
            error_log('Health check DB error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_connection_failed']);
        }
        exit;
    }

    if (isset($segments[0]) && $segments[0] === 'products') {
        if ($method === 'GET') {
            if (isset($segments[1])) {
                $stmt = $db->prepare('SELECT * FROM products WHERE id = ? LIMIT 1');
                $stmt->execute([$segments[1]]);
                $row = $stmt->fetch();
                echo json_encode($row ?: []);
                exit;
            }
            $stmt = $db->query('SELECT * FROM products ORDER BY id DESC LIMIT 1000');
            $rows = $stmt->fetchAll();
            echo json_encode($rows);
            exit;
        }
    }

    // Route: /api/login
    if (isset($segments[0]) && $segments[0] === 'login' && $method === 'POST') {
        $data = getJsonInput();
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($username) || empty($password)) {
            http_response_code(400);
            echo json_encode(['error' => 'username and password required']);
            exit;
        }

        $stmt = $db->prepare('SELECT id, username, password, role, name FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
            exit;
        }

        $hash = $user['password'];
        $valid = false;
        if (strpos($hash, '$2y$') === 0 || strpos($hash, '$2a$') === 0) {
            $valid = password_verify($password, $hash);
        } else {
            $valid = ($password === $hash);
        }

        if (!$valid) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
            exit;
        }

        // Remove sensitive fields
        unset($user['password']);
        echo json_encode(['user' => $user]);
        exit;
    }

    // Route: /api/pos_sales (create sales record)
    if (isset($segments[0]) && $segments[0] === 'pos_sales' && $method === 'POST') {
        $data = getJsonInput();
        // expected: { total: 123.45, items: [ {product_id, qty, price}, ... ], cashier_id }
        $total = $data['total'] ?? 0;
        $items = $data['items'] ?? [];
        $cashier = $data['cashier_id'] ?? null;

        $stmt = $db->prepare('INSERT INTO pos_sales (total, data, cashier_id, created_at) VALUES (?, ?, ?, NOW())');
        $stmt->execute([$total, json_encode($items), $cashier]);
        $saleId = $db->lastInsertId();

        echo json_encode(['id' => $saleId]);
        exit;
    }

    // Fallback
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error', 'message' => $e->getMessage()]);
}

?>
