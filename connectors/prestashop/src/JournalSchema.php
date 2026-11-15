<?php
namespace TotusCentralConnector;

/** DDL for the integration's own dispatch journal. Does not execute/install it. */
final class JournalSchema
{
    public static function mysql(string $table): string
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1,'JOURNAL_CONFIG_INVALID');
        return 'CREATE TABLE `'.$table.'` (
            request_id CHAR(36) NOT NULL PRIMARY KEY,
            installation_id CHAR(36) NOT NULL,
            api_account_id BIGINT UNSIGNED NOT NULL,
            shop_id BIGINT UNSIGNED NOT NULL,
            actor_id CHAR(36) NOT NULL,
            command VARCHAR(32) NOT NULL,
            fingerprint CHAR(64) NOT NULL,
            status VARCHAR(16) NOT NULL,
            claim_token CHAR(64) NOT NULL,
            native_reference VARCHAR(100) NULL,
            native_order_id BIGINT UNSIGNED NULL,
            result_json MEDIUMTEXT NULL,
            error_code VARCHAR(100) NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY native_order_once (installation_id,shop_id,native_order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';
    }
}
