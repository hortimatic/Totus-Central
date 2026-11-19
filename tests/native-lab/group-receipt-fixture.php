<?php
require __DIR__.'/bootstrap.php';
$mode=$argv[1]??'';
if($mode==='set'){
 $customer=new Customer((int)($argv[2]??0));nativeLabCheck(Validate::isLoadedObject($customer),'Missing fixture customer');
 $oldDefault=(int)$customer->id_default_group;$oldGroups=$customer->getGroups();
 $group=new Group();foreach(Language::getLanguages(false) as $language)$group->name[(int)$language['id_lang']]='Totus group receipt fixture';
 $group->reduction=7.5;$group->price_display_method=0;$group->show_prices=1;nativeLabCheck($group->add(),'Cannot add fixture group');
 $customer->id_default_group=(int)$group->id;nativeLabCheck($customer->update(),'Cannot select fixture group');$customer->addGroups([(int)$group->id]);
 echo json_encode(['customerId'=>(int)$customer->id,'groupId'=>(int)$group->id,'oldDefault'=>$oldDefault,'oldGroups'=>$oldGroups],JSON_THROW_ON_ERROR)."\n";
}elseif($mode==='change'){
 $group=new Group((int)($argv[2]??0));nativeLabCheck(Validate::isLoadedObject($group)&&str_contains((string)reset($group->name),'Totus group receipt fixture'),'Not fixture group');$group->reduction=12.5;nativeLabCheck($group->update(),'Cannot change fixture group');echo "{\"changed\":true}\n";
}elseif($mode==='restore'){
 $saved=json_decode($argv[2]??'',true,16,JSON_THROW_ON_ERROR);$group=new Group((int)$saved['groupId']);$customer=new Customer((int)$saved['customerId']);
 nativeLabCheck(Validate::isLoadedObject($customer)&&Validate::isLoadedObject($group)&&str_contains((string)reset($group->name),'Totus group receipt fixture'),'Not fixture scope');
 $customer->id_default_group=(int)$saved['oldDefault'];nativeLabCheck($customer->update(),'Cannot restore fixture customer');
 nativeLabCheck(Db::getInstance()->delete('customer_group','id_customer='.(int)$customer->id),'Cannot restore fixture memberships');$customer->addGroups(array_map('intval',$saved['oldGroups']));nativeLabCheck($group->delete(),'Cannot delete fixture group');echo "{\"restored\":true}\n";
}else throw new RuntimeException('Unknown group fixture action');
