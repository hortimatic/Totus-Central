-- Applied ONLY to disposable PrestaShop Flashlight database in GitHub Actions.
INSERT INTO ps_configuration (id_shop_group,id_shop,name,value,date_add,date_upd)
 SELECT NULL,NULL,'PS_WEBSERVICE','1',NOW(),NOW()
 WHERE NOT EXISTS (SELECT 1 FROM ps_configuration WHERE name='PS_WEBSERVICE');
UPDATE ps_configuration SET value='1',date_upd=NOW()
 WHERE name IN ('PS_WEBSERVICE','PS_SHOP_ENABLE');
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
 (@account_id,'languages','GET'),
 (@account_id,'products','PUT'),(@account_id,'products','DELETE'),
 (@account_id,'combinations','GET'),(@account_id,'combinations','POST'),(@account_id,'combinations','PUT'),(@account_id,'combinations','DELETE'),
 (@account_id,'product_options','GET'),(@account_id,'product_options','POST'),
 (@account_id,'product_option_values','GET'),(@account_id,'product_option_values','POST'),
 (@account_id,'stock_availables','GET'),(@account_id,'stock_availables','PUT'),
 (@account_id,'images','GET'),(@account_id,'images','POST'),(@account_id,'images','PUT'),(@account_id,'images','DELETE'),(@account_id,'image_types','GET'),
 (@account_id,'product_features','GET'),(@account_id,'product_features','POST'),(@account_id,'product_features','PUT'),(@account_id,'product_feature_values','GET'),(@account_id,'product_feature_values','POST'),(@account_id,'product_feature_values','PUT'),(@account_id,'tags','GET'),
 (@account_id,'suppliers','GET'),(@account_id,'suppliers','POST'),(@account_id,'suppliers','PUT'),
 (@account_id,'manufacturers','GET'),(@account_id,'manufacturers','POST'),(@account_id,'manufacturers','PUT'),(@account_id,'currencies','GET'),
 (@account_id,'product_suppliers','GET'),(@account_id,'product_suppliers','POST'),(@account_id,'product_suppliers','PUT'),
 (@account_id,'specific_prices','GET'),(@account_id,'specific_prices','POST'),(@account_id,'specific_prices','PUT');
INSERT INTO ps_supplier(name,active,date_add,date_upd) VALUES('TOTUS CI Supplier',1,NOW(),NOW());
SET @ci_supplier=LAST_INSERT_ID();
INSERT INTO ps_supplier_shop(id_supplier,id_shop) SELECT @ci_supplier,id_shop FROM ps_shop;
-- Fictional attribute for testing complete product creation, only in Docker.
INSERT INTO ps_attribute_group(is_color_group,group_type,position) VALUES(0,'select',90);
SET @ci_attribute_group=LAST_INSERT_ID();
INSERT INTO ps_attribute_group_lang(id_attribute_group,id_lang,name,public_name) SELECT @ci_attribute_group,id_lang,'CI Color','CI Color' FROM ps_lang;
INSERT INTO ps_attribute_group_shop(id_attribute_group,id_shop) SELECT @ci_attribute_group,id_shop FROM ps_shop;
INSERT INTO ps_attribute(id_attribute_group,color,position) VALUES(@ci_attribute_group,'',0);
SET @ci_attribute=LAST_INSERT_ID();
INSERT INTO ps_attribute_lang(id_attribute,id_lang,name) SELECT @ci_attribute,id_lang,'CI Blue' FROM ps_lang;
INSERT INTO ps_attribute_shop(id_attribute,id_shop) SELECT @ci_attribute,id_shop FROM ps_shop;
SELECT 'PrestaShop Webservice CI configured' AS status;

-- Named material and tag for organization edits in the disposable store only.
INSERT INTO ps_feature(position) VALUES(90);
SET @ci_feature=LAST_INSERT_ID();
INSERT INTO ps_feature_lang(id_feature,id_lang,name) SELECT @ci_feature,id_lang,'CI Material' FROM ps_lang;
INSERT INTO ps_feature_shop(id_feature,id_shop) SELECT @ci_feature,id_shop FROM ps_shop;
INSERT INTO ps_feature_value(id_feature,custom) VALUES(@ci_feature,0);
SET @ci_feature_value=LAST_INSERT_ID();
INSERT INTO ps_feature_value_lang(id_feature_value,id_lang,value) SELECT @ci_feature_value,id_lang,'CI Metal' FROM ps_lang;
INSERT INTO ps_tag(id_lang,name) VALUES(1,'TOTUS CI Tag');


-- Directory CRUD permissions only for this disposable CI account.
INSERT INTO ps_webservice_permission(id_webservice_account,resource,method) VALUES
(@account_id,'customers','GET'),(@account_id,'customers','POST'),(@account_id,'customers','PUT'),(@account_id,'customers','DELETE'),
(@account_id,'addresses','GET'),(@account_id,'addresses','POST'),(@account_id,'addresses','PUT'),(@account_id,'addresses','DELETE'),
(@account_id,'orders','GET'),(@account_id,'groups','GET'),(@account_id,'countries','GET'),(@account_id,'states','GET'),
(@account_id,'manufacturers','DELETE'),(@account_id,'suppliers','DELETE'),
(@account_id,'product_options','PUT'),(@account_id,'product_options','DELETE'),(@account_id,'product_option_values','PUT'),(@account_id,'product_option_values','DELETE'),
(@account_id,'product_features','DELETE'),(@account_id,'product_feature_values','DELETE');

-- Read-only movement resources for disposable native compatibility tests.
INSERT INTO ps_webservice_permission(id_webservice_account,resource,method) VALUES
(@account_id,'stock_movements','GET'),(@account_id,'stock_movement_reasons','GET');
