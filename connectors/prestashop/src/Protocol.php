<?php
/** Original native capability boundary, without third-party POS dependencies.
 * Central owns users, permissions, cash sessions and UI. The connector accepts
 * only named native commands after native Webservice authentication/ACL checks.
 */
namespace TotusCentralConnector;

final class Protocol
{
    public const VERSION = 1;
    public const MAX_BODY_BYTES = 65536;
    private const RESOURCES = [
        'setup.qa' => 'totus_tpv_setup',
        'cart.prepare' => 'totus_tpv_carts',
        'cart.quote' => 'totus_tpv_quotes',
        'sale.commit' => 'totus_tpv_sales',
        'payment.record' => 'totus_tpv_payments',
        'stock.receive' => 'totus_tpv_stock',
        'return.commit' => 'totus_tpv_returns',
    ];

    public static function decode(string $body, string $resource, array $trustedContext): array
    {
        self::ensure(strlen($body) <= self::MAX_BODY_BYTES, 'BODY_TOO_LARGE');
        try {
            $request = json_decode($body, true, 32, JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new \InvalidArgumentException('TOTUS_REQUEST_JSON_INVALID');
        }
        self::ensure(is_array($request) && array_is_list($request) === false, 'REQUEST_INVALID');
        self::ensure(array_diff(array_keys($request), [
            'protocol', 'operation_id', 'installation_id', 'shop_id', 'actor_id', 'command', 'payload',
        ]) === [], 'REQUEST_FIELD_FORBIDDEN');
        foreach (['protocol', 'operation_id', 'installation_id', 'shop_id', 'actor_id', 'command', 'payload'] as $key) {
            self::ensure(array_key_exists($key, $request), 'REQUEST_FIELD_REQUIRED');
        }
        self::ensure($request['protocol'] === self::VERSION, 'PROTOCOL_UNSUPPORTED');
        self::ensure(self::uuid($request['operation_id']) && self::uuid($request['installation_id']) &&
            self::uuid($request['actor_id']), 'IDENTITY_INVALID');
        self::ensure(is_int($request['shop_id']) && $request['shop_id'] > 0, 'SHOP_INVALID');
        self::ensure(is_string($request['command']) && isset(self::RESOURCES[$request['command']]) &&
            self::RESOURCES[$request['command']] === $resource, 'COMMAND_RESOURCE_MISMATCH');
        self::ensure(is_array($request['payload']) &&
            ($request['payload'] === [] || !array_is_list($request['payload'])), 'PAYLOAD_INVALID');
        // Context comes from native Webservice state, never from the JSON body.
        self::ensure(($trustedContext['authenticated'] ?? false) === true &&
            ($trustedContext['method'] ?? '') === 'POST' &&
            ($trustedContext['resource'] ?? '') === $resource &&
            in_array('POST', $trustedContext['resource_methods'] ?? [], true) &&
            is_int($trustedContext['api_account_id'] ?? null) && $trustedContext['api_account_id'] > 0,
            'NATIVE_AUTH_REQUIRED');
        self::ensure(($trustedContext['installation_id'] ?? null) === $request['installation_id'] &&
            ($trustedContext['shop_id'] ?? null) === $request['shop_id'] &&
            ($trustedContext['allowed_shop_ids'] ?? []) === [$request['shop_id']], 'NATIVE_SCOPE_MISMATCH');
        self::ensure(in_array($request['command'], $trustedContext['enabled_commands'] ?? [], true), 'COMMAND_DISABLED');
        self::rejectSecretFields($request['payload']);
        $request['api_account_id'] = $trustedContext['api_account_id'];
        $request['fingerprint'] = hash('sha256', self::canonical($request));
        return $request;
    }

    public static function canonical($value): string
    {
        return json_encode(self::ordered($value), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private static function ordered($value)
    {
        if (!is_array($value)) {
            self::ensure(!is_float($value), 'FLOAT_NOT_ALLOWED');
            return $value;
        }
        if (!array_is_list($value)) {
            ksort($value, SORT_STRING);
        }
        foreach ($value as $key => $item) {
            $value[$key] = self::ordered($item);
        }
        return $value;
    }

    private static function rejectSecretFields(array $payload): void
    {
        foreach ($payload as $key => $value) {
            self::ensure(!is_string($key) || !preg_match('/^(password|api_key|secret|authorization|pan|card_number|cvv|cvc|track_data)$/i', $key),
                'SENSITIVE_FIELD_FORBIDDEN');
            if (is_array($value)) {
                self::rejectSecretFields($value);
            }
        }
    }

    public static function uuid($value): bool
    {
        return is_string($value) && preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iD', $value) === 1;
    }

    public static function ensure(bool $condition, string $code): void
    {
        if (!$condition) {
            throw new \InvalidArgumentException('TOTUS_' . $code);
        }
    }
}
