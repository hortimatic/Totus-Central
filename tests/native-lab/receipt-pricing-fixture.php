<?php
require __DIR__.'/bootstrap.php';
require_once $project.'/connectors/prestashop/src/Protocol.php';
require_once $project.'/connectors/prestashop/src/NativeDocuments.php';
use TotusCentralConnector\NativeDocuments;
$line=['original_product_price'=>'6.621570','tax_rate'=>'21.000','ecotax'=>'0.000000','ecotax_tax_rate'=>'0.000','total_price_tax_incl'=>'14.500000','product_quantity'=>2];$checks=0;
$check=static function($ok)use(&$checks){if(!$ok)throw new RuntimeException('Native historical-price assertion '.($checks+1));$checks++;};
$expected=['original_unit_tax_incl_micros'=>8012100,'original_line_cents'=>1602,'line_discount_cents'=>152];$check(NativeDocuments::linePricingSnapshot($line,2,Order::ROUND_LINE)===$expected);
$check(NativeDocuments::linePricingSnapshot($line,2,Order::ROUND_ITEM)===$expected);
$eco=[...$line,'original_product_price'=>10,'ecotax'=>2,'ecotax_tax_rate'=>10,'total_price_tax_incl'=>20];$check(NativeDocuments::linePricingSnapshot($eco,2,Order::ROUND_LINE)===['original_unit_tax_incl_micros'=>11880000,'original_line_cents'=>2376,'line_discount_cents'=>376]);
$compound=[...$line,'original_product_price'=>10,'tax_rate'=>32.5,'total_price_tax_incl'=>24];$check(NativeDocuments::linePricingSnapshot($compound,2,Order::ROUND_LINE)===['original_unit_tax_incl_micros'=>13250000,'original_line_cents'=>2650,'line_discount_cents'=>250]);
$zero=[...$line,'original_product_price'=>0,'total_price_tax_incl'=>7.5];$check(NativeDocuments::linePricingSnapshot($zero,2,Order::ROUND_LINE)===['original_unit_tax_incl_micros'=>0,'original_line_cents'=>0,'line_discount_cents'=>0]);
$round=[...$line,'original_product_price'=>0.0048,'tax_rate'=>0,'product_quantity'=>3,'total_price_tax_incl'=>0];$check(NativeDocuments::linePricingSnapshot($round,2,Order::ROUND_ITEM)['original_line_cents']===0);$check(NativeDocuments::linePricingSnapshot($round,2,Order::ROUND_LINE)['original_line_cents']===1);
foreach(['original_product_price'=>null,'tax_rate'=>'invalid','ecotax'=>-1,'product_quantity'=>0] as $key=>$value)$check(NativeDocuments::linePricingSnapshot([...$line,$key=>$value],2,Order::ROUND_LINE)===[]);
$check(NativeDocuments::linePricingSnapshot([...$line,'original_product_price'=>1,'ecotax'=>2],2,Order::ROUND_LINE)===[]);
echo "PASS historical native receipt prices: {$checks} assertions with actual PrestaShop Tools/Order, distinct ecotax, combined rate, zero price, rounding and missing snapshots. Read-only local lab.\n";
