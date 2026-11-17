<?php
require __DIR__.'/bootstrap.php';
$key=new WebserviceKey((int)($argv[1]??0));
nativeLabCheck(Validate::isLoadedObject($key)&&$key->description==='Disposable Totus native HTTP QA','Synthetic API account required.');
$permissions=[];foreach(WebserviceKey::getPermissionForAccount($key->key) as $resource=>$methods)foreach($methods as $method)$permissions[$resource][$method]=true;
foreach(['categories','manufacturers','suppliers','tax_rule_groups','tax_rules','taxes','countries','product_options','product_option_values','languages','currencies'] as $resource)$permissions[$resource]['GET']=true;
$permissions['categories']['POST']=true;
foreach(['products','combinations','stock_availables','product_suppliers','images'] as $resource)foreach(['GET','POST','PUT'] as $method)$permissions[$resource][$method]=true;
nativeLabCheck(WebserviceKey::setPermissionForAccount((int)$key->id,$permissions),'Cannot configure fictional product writer.');
$suffix=bin2hex(random_bytes(5));$lang=(int)$context->language->id;
$supplier=new Supplier();$supplier->name='Proveedor TPV QA '.$suffix;$supplier->active=true;nativeLabCheck($supplier->add(),'Cannot create supplier fixture.');
$brand=new Manufacturer();$brand->name='Marca TPV QA '.$suffix;$brand->active=true;nativeLabCheck($brand->add(),'Cannot create brand fixture.');
$group=new AttributeGroup();$group->name=[$lang=>'Color TPV QA '.$suffix];$group->public_name=[$lang=>'Color'];$group->group_type='select';$group->is_color_group=false;
nativeLabCheck($group->add(),'Cannot create attribute group fixture.');$values=[];
foreach(['Azul','Rojo'] as $name){$value=new ProductAttribute();$value->id_attribute_group=(int)$group->id;$value->name=[$lang=>$name];nativeLabCheck($value->add(),'Cannot create attribute fixture.');$values[]=(string)$value->id;}
echo json_encode(['categoryId'=>(string)Configuration::get('PS_HOME_CATEGORY'),'manufacturerId'=>(string)$brand->id,'supplierId'=>(string)$supplier->id,'attributeValueIds'=>$values],JSON_THROW_ON_ERROR)."\n";
