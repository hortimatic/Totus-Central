-- Applied ONLY to disposable PrestaShop Flashlight database in GitHub Actions.
UPDATE ps_configuration SET value = '1' WHERE name IN ('PS_WEBSERVICE','PS_SHOP_ENABLE');
UPDATE ps_configuration SET value = '0' WHERE name IN ('PS_SSL_ENABLED','PS_SSL_ENABLED_EVERYWHERE');
UPDATE ps_shop_url SET domain='localhost:8000',domain_ssl='localhost:8000' WHERE main=1;
INSERT INTO ps_webservice_account (
  `key`, description, active
) VALUES (
  'TOTUSPRESTASHOPQA123456789012345', 'Temporary CI-only Webservice account', 1
);
SET @account_id = LAST_INSERT_ID();
INSERT IGNORE INTO ps_webservice_account_shop(id_webservice_account,id_shop)
 SELECT @account_id,id_shop FROM ps_shop WHERE active=1;
INSERT INTO ps_webservice_permission(id_webservice_account,resource,method)
 VALUES
 (@account_id,'products','GET'),
 (@account_id,'products','POST'),
 (@account_id,'categories','GET'),
 (@account_id,'languages','GET');
SELECT 'PrestaShop Webservice CI configured' AS status;
