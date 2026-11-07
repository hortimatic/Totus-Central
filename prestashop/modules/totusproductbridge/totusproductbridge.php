<?php
/** Totus Central - native Webservice unit-price compatibility. */
if (!defined('_PS_VERSION_')) {
    exit;
}

class TotusProductBridge extends Module
{
    public function __construct()
    {
        $this->name = 'totusproductbridge';
        $this->tab = 'administration';
        $this->version = '1.0.0';
        $this->author = 'Totus Central';
        $this->need_instance = 0;
        $this->bootstrap = true;
        $this->ps_versions_compliancy = array('min' => '1.7.8.0', 'max' => '8.99.99');
        parent::__construct();
        $this->displayName = 'Totus · precios unitarios por API';
        $this->description = 'Conserva la relación de precio unitario enviada al Webservice de productos. Sin endpoints, claves ni overrides.';
    }

    public function install()
    {
        return parent::install()
            && $this->registerHook('actionObjectProductAddBefore')
            && $this->registerHook('actionObjectProductUpdateBefore');
    }

    public function hookActionObjectProductAddBefore($params)
    {
        $this->synchronizeWebservicePrice($params);
    }

    public function hookActionObjectProductUpdateBefore($params)
    {
        $this->synchronizeWebservicePrice($params);
    }

    private function synchronizeWebservicePrice($params)
    {
        // Only the official Webservice dispatcher, after its normal API auth.
        // Back-office edits must keep the user's explicit unit_price value.
        $script = str_replace('\\', '/', isset($_SERVER['SCRIPT_FILENAME']) ? $_SERVER['SCRIPT_FILENAME'] : '');
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : '';
        if (!preg_match('~/webservice/dispatcher\.php$~D', $script)
            || !in_array($method, array('POST', 'PUT', 'PATCH'), true)
            || !isset($params['object']) || !($params['object'] instanceof Product)) {
            return;
        }
        $product = $params['object'];
        if (!is_numeric($product->price) || !is_numeric($product->unit_price_ratio)) {
            return;
        }
        $price = (float) $product->price;
        $ratio = (float) $product->unit_price_ratio;
        if (!is_finite($price) || !is_finite($ratio) || $price < 0 || $ratio < 0) {
            return;
        }
        // ProductCore::getFieldsShop recalculates ratio from unit_price.
        // The native API exposes ratio, so synchronize its derived value first.
        $unitPrice = $ratio > 0 ? $price / $ratio : 0.0;
        if (is_finite($unitPrice)) {
            $product->unit_price = $unitPrice;
        }
    }
}
