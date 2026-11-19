<?php
require __DIR__.'/bootstrap.php';
$source=new Product((int)($argv[1]??0));$variantProduct=new Product((int)($argv[2]??0));
nativeLabCheck(Validate::isLoadedObject($source)&&str_starts_with($source->reference,'QA-')&&Validate::isLoadedObject($variantProduct)&&str_starts_with($variantProduct->reference,'QA-VARIANT-'),'Only disposable QA products may be used.');
$suffix=bin2hex(random_bytes(5));$prefix='QA-FILTER-'.$suffix;$lang=(int)$context->language->id;
$parent=new Category();$parent->name=[$lang=>'Familia filtro '.$suffix];$parent->link_rewrite=[$lang=>'familia-filtro-'.$suffix];$parent->id_parent=(int)Configuration::get('PS_HOME_CATEGORY');$parent->active=true;
nativeLabCheck($parent->add(),'Cannot create parent fixture category.');
$bridge=new Category();$bridge->name=[$lang=>'Puente filtro '.$suffix];$bridge->link_rewrite=[$lang=>'puente-filtro-'.$suffix];$bridge->id_parent=(int)$parent->id;$bridge->active=false;
nativeLabCheck($bridge->add(),'Cannot create inactive ancestor fixture category.');
$child=new Category();$child->name=[$lang=>'Subfamilia filtro '.$suffix];$child->link_rewrite=[$lang=>'subfamilia-filtro-'.$suffix];$child->id_parent=(int)$bridge->id;$child->active=true;
nativeLabCheck($child->add(),'Cannot create child fixture category.');
$brand=new Manufacturer();$brand->name='Marca filtro '.$suffix;$brand->active=true;nativeLabCheck($brand->add(),'Cannot create brand fixture.');
$supplier=new Supplier();$supplier->name='Proveedor filtro '.$suffix;$supplier->active=true;nativeLabCheck($supplier->add(),'Cannot create supplier fixture.');
$ids=[];foreach(['available'=>3,'zero'=>0,'negative'=>-2] as $kind=>$quantity){$product=new Product();$product->name=[$lang=>'Filtro '.$kind.' '.$suffix];$product->link_rewrite=[$lang=>'filtro-'.$kind.'-'.$suffix];$product->reference=$prefix.'-'.$kind;
 $product->id_category_default=(int)$child->id;$product->id_tax_rules_group=(int)$source->id_tax_rules_group;$product->price='6.621570';$product->wholesale_price='4';$product->active=true;$product->available_for_order=true;$product->minimal_quantity=1;
 $product->id_manufacturer=(int)$brand->id;$product->id_supplier=(int)$supplier->id;
 nativeLabCheck($product->add()&&$product->addToCategories([(int)$child->id]),'Cannot create stock fixture.');StockAvailable::setQuantity((int)$product->id,0,$quantity,1);$ids[$kind]=(int)$product->id;}
$variantProduct->reference=$prefix.'-variants';$variantProduct->id_category_default=(int)$child->id;
nativeLabCheck($variantProduct->update()&&$variantProduct->updateCategories([(int)$child->id]),'Cannot assign variant parent to fixture category.');$ids['variants']=(int)$variantProduct->id;
$pagePrefix='QA-PAGE-'.$suffix;$pageAvailable=null;
for($i=0;$i<23;$i++){$product=new Product();$product->name=[$lang=>'Pagination '.($i===22?'B available':'A unavailable').' '.str_pad((string)$i,2,'0',STR_PAD_LEFT).' '.$suffix];$product->link_rewrite=[$lang=>'pagination-'.$suffix.'-'.$i];$product->reference=$pagePrefix.'-'.$i;
 $product->id_category_default=(int)$child->id;$product->id_tax_rules_group=(int)$source->id_tax_rules_group;$product->price='6.621570';$product->active=true;$product->available_for_order=true;$product->minimal_quantity=1;
 nativeLabCheck($product->add()&&$product->addToCategories([(int)$child->id]),'Cannot create pagination fixture.');StockAvailable::setQuantity((int)$product->id,0,$i===22?2:0,1);if($i===22)$pageAvailable=(int)$product->id;}
$paged=new Product();$paged->name=[$lang=>'Variantes paginadas QA '.$suffix];$paged->link_rewrite=[$lang=>'variantes-paginadas-'.$suffix];$paged->reference='QA-VARIANT-PAGE-'.$suffix;
$paged->id_category_default=(int)Configuration::get('PS_HOME_CATEGORY');$paged->id_tax_rules_group=(int)$source->id_tax_rules_group;$paged->price='6.621570';$paged->active=true;$paged->available_for_order=true;$paged->minimal_quantity=1;
nativeLabCheck($paged->add()&&$paged->addToCategories([(int)$paged->id_category_default]),'Cannot create paginated variant fixture.');
$pageGroups=[];foreach(['Familia QA','Color QA'] as $name){$g=new AttributeGroup();$g->name=[$lang=>$name.' '.$suffix];$g->public_name=[$lang=>$name];$g->group_type='select';$g->is_color_group=false;nativeLabCheck($g->add(),'Cannot create pagination attribute group.');$pageGroups[]=(int)$g->id;}
$familyAttributes=[];foreach(['Primera','Segunda'] as $name){$a=new ProductAttribute();$a->id_attribute_group=$pageGroups[0];$a->name=[$lang=>$name];nativeLabCheck($a->add(),'Cannot create family attribute.');$familyAttributes[]=(int)$a->id;}
$pageVariantIds=[];for($i=0;$i<23;$i++){$a=new ProductAttribute();$a->id_attribute_group=$pageGroups[1];$a->name=[$lang=>'Color '.str_pad((string)(23-$i),2,'0',STR_PAD_LEFT)];nativeLabCheck($a->add(),'Cannot create color attribute.');
 $c=new Combination();$c->id_product=(int)$paged->id;$c->reference='QA-VPAGE-'.$suffix.'-'.$i;$c->price=$i/10;$c->minimal_quantity=1;$c->default_on=$i===0?1:null;
 nativeLabCheck($c->add()&&$c->setAttributes([$familyAttributes[$i%2],(int)$a->id]),'Cannot create paginated combination.');StockAvailable::setQuantity((int)$paged->id,(int)$c->id,$i+1,1);$pageVariantIds[]=(int)$c->id;}
Product::updateDefaultAttribute((int)$paged->id);
echo json_encode(['prefix'=>$prefix,'ids'=>$ids,'parentId'=>(int)$parent->id,'childId'=>(int)$child->id,'brand'=>$brand->name,'supplier'=>$supplier->name,'pagePrefix'=>$pagePrefix,'pageAvailable'=>$pageAvailable,'variantPage'=>['productId'=>(int)$paged->id,'groupId'=>$pageGroups[1],'ids'=>$pageVariantIds]],JSON_THROW_ON_ERROR)."\n";
