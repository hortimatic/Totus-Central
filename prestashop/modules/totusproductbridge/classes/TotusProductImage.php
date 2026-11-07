<?php
/** A native Image view: GET/PUT only, with immutable product and cover. */
if (!defined('_PS_VERSION_')) { exit; }
class TotusProductImage extends Image
{
    protected $webserviceParameters = array(
        'objectNodeName' => 'totus_product_image',
        'objectsNodeName' => 'totus_product_images',
        'fields' => array(
            'id_product' => array('setter' => false),
            'position' => array(),
            'cover' => array('setter' => false),
            'legend' => array(),
        ),
    );

    public function update($nullValues = false)
    {
        $before = new Image((int) $this->id);
        if (!Validate::isLoadedObject($before)
            || (int) $before->id_product !== (int) $this->id_product
            || (int) $before->cover !== (int) $this->cover) {
            throw new PrestaShopException('The image product and cover are immutable.');
        }
        $position = (int) $this->position;
        $count = (int) Db::getInstance()->getValue('SELECT COUNT(*) FROM `' . _DB_PREFIX_ . 'image` WHERE id_product=' . (int) $before->id_product);
        if (!Validate::isUnsignedInt($this->position) || $position < 1 || $position > $count
            || $this->validateFields(false, true) !== true
            || $this->validateFieldsLang(false, true) !== true) {
            throw new PrestaShopException('Invalid image position or legend.');
        }
        $db = Db::getInstance();
        if (!$db->execute('START TRANSACTION')) {
            throw new PrestaShopException('Could not start image update.');
        }
        try {
            if ($position !== (int) $before->position
                && !$before->updatePosition($position > (int) $before->position ? 1 : 0, $position)) {
                throw new PrestaShopException('Could not reorder product images.');
            }
            if (!parent::update($nullValues)) {
                throw new PrestaShopException('Could not update image legend.');
            }
            if (!$db->execute('COMMIT')) {
                throw new PrestaShopException('Could not commit image update.');
            }
            return true;
        } catch (Exception $error) {
            $db->execute('ROLLBACK');
            throw $error;
        }
    }
}
