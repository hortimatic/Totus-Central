<?php
/** A native Image view: GET/PUT only, with immutable product and cover. */
if (!defined('_PS_VERSION_')) { exit; }
class TotusProductImage extends Image
{
    protected $webserviceParameters = array(
        'objectNodeName' => 'totus_product_image',
        'objectsNodeName' => 'totus_product_images',
        'fields' => array(
            'id_product' => array('setter' => 'setImmutableProduct'),
            'position' => array(),
            'cover' => array('setter' => 'setImmutableCover', 'required' => true),
            'legend' => array(),
        ),
    );

    // The native Webservice requires these fields on PUT. Accept only the
    // persisted values; never turn a metadata edit into a move or cover change.
    public function setImmutableProduct($value)
    {
        $before = new Image((int) $this->id);
        if (!Validate::isLoadedObject($before) || !ctype_digit((string) $value)
            || (int) $value !== (int) $before->id_product) {
            throw new PrestaShopException('The image product is immutable.');
        }
        $this->id_product = $before->id_product;
        return true;
    }

    public function setImmutableCover($value)
    {
        $before = new Image((int) $this->id);
        if (!Validate::isLoadedObject($before) || !in_array((string) $value, array('', '0', '1'), true)
            || (int) $value !== (int) $before->cover) {
            throw new PrestaShopException('The image cover is immutable.');
        }
        $this->cover = $before->cover;
        return true;
    }

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
