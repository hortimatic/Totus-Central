import assert from 'node:assert/strict';
export async function exerciseOperatorCheckout({db,id,scope,expected,payments}){
 await db.exec('reset role');const selected={...scope,drawerId:id(9600),sessionId:id(9601)};
 await db.query('insert into public.ops_cash_drawers(id,store_id,active,name) values($1,$2,true,$3)',[selected.drawerId,selected.storeId,'Caja confirmación de operador']);
 await db.query(`insert into private.totus_tpv_assignments select environment,actor_id,connection_id,website_key,store_id,shop_id,$1,can_sell,can_reconcile,can_open,active from private.totus_tpv_assignments where actor_id=$2 and connection_id=$3 and drawer_id=$4`,[selected.drawerId,scope.actorId,scope.connectionId,scope.drawerId]);
 const role=async name=>db.exec('reset role;set role '+name);
 const settings=async value=>(await db.query('select public.totus_tpv_operator_settings($1,$2,$3,$4::jsonb) result',[selected.connectionId,selected.shopId,selected.drawerId,value?JSON.stringify(value):null])).rows[0].result;
 const journal=async(action,operation,data={})=>(await db.query('select public.totus_tpv_journal($1,$2,$3::jsonb,$4::jsonb) result',[action,operation,JSON.stringify(selected),JSON.stringify(data)])).rows[0].result;
 await role('authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[scope.actorId]);
 assert.deepEqual(await settings(),{switchEnabled:true,requireAtCheckout:false,revision:0});
 assert.deepEqual(await settings({switchEnabled:true,requireAtCheckout:true,expectedRevision:0}),{switchEnabled:true,requireAtCheckout:true,revision:1});
 assert.equal((await settings({switchEnabled:false,expectedRevision:1})).requireAtCheckout,true,'Older clients changing switch visibility preserve the checkout rule');
 assert.equal((await settings({switchEnabled:false,requireAtCheckout:true,expectedRevision:0})).revision,2,'Exact lost-reply intent is idempotent');
 await assert.rejects(settings({switchEnabled:false,requireAtCheckout:false,expectedRevision:0}),/STALE/);
 await assert.rejects(settings({switchEnabled:false,requireAtCheckout:'false',expectedRevision:2}),/INVALID/);
 await role('service_role');await journal('open',selected.sessionId,{openingCents:0});
 const operation=id(9602),quote=expected(9602);await journal('prepare',operation,{expected:quote,quoteExpiresAt:Date.now()+60000});
 const claim={revision:1,expected:quote,payments};
 await assert.rejects(journal('claim',operation,claim),/CHECKOUT_OPERATOR_REQUIRED/);
 for(const ack of [{actorId:id(9),accepted:true},{actorId:scope.actorId,accepted:false},{actorId:scope.actorId,accepted:true,amount:801},null])await assert.rejects(journal('claim',operation,{...claim,operatorAcknowledgement:ack}),/CHECKOUT_OPERATOR_INVALID/);
 assert.equal((await journal('get',operation)).status,'ready','Denied acknowledgement cannot claim or write a payment');
 const ack={actorId:scope.actorId,accepted:true};assert.equal((await journal('claim',operation,{...claim,operatorAcknowledgement:ack})).won,true);
 assert.equal((await journal('claim',operation,{...claim,operatorAcknowledgement:ack})).won,false,'Lost response never authorizes another dispatch');
 const stored=(await db.query('select * from private.totus_tpv_operator_acknowledgements where operation_id=$1',[operation])).rows[0];assert.equal(stored.actor_id,scope.actorId);assert.equal(Number(stored.total_cents),801);assert.equal(Number(stored.settings_revision),2);
 assert.equal(Number((await db.query('select count(*) n from private.totus_tpv_operator_acknowledgements where operation_id=$1',[operation])).rows[0].n),1);
 await assert.rejects(db.query('delete from private.totus_tpv_operator_acknowledgements'),/permission denied/);
 await assert.rejects(db.query("select totus_tpv_internal.journal_before_operator_ack('get',$1,$2::jsonb,'{}')",[operation,JSON.stringify(selected)]),/permission denied/);
 const ticket={currency:'EUR',totalCents:801,lines:[{productId:101,qty:1}],payments:[{method:'cash',amountCents:801}]};
 for(const t of [ticket,{...ticket,operatorAcknowledgement:ack}])await db.query('select private.totus_tpv_validate_offline_ticket($1::jsonb)',[JSON.stringify(t)]);
 for(const bad of [null,{actorId:scope.actorId,accepted:false},{actorId:'forged',accepted:true}])await assert.rejects(db.query('select private.totus_tpv_validate_offline_ticket($1::jsonb)',[JSON.stringify({...ticket,operatorAcknowledgement:bad})]),/OPERATOR_INVALID/);
 for(const name of ['anon','authenticated']){await role(name);await assert.rejects(journal('get',operation),/permission denied/);await assert.rejects(db.query('select * from private.totus_tpv_operator_acknowledgements'),/permission denied/);}
 await role('authenticated');await settings({switchEnabled:true,requireAtCheckout:false,expectedRevision:2});
 await role('service_role');const other=id(9603),second=expected(9603);await journal('prepare',other,{expected:second,quoteExpiresAt:Date.now()+60000});assert.equal((await journal('claim',other,{revision:1,expected:second,payments})).won,true,'Turning off the option restores the existing one-click authenticated checkout');
 await db.exec('reset role');console.log('PASS checkout operator SQL: per-drawer rule/revision, old-client preservation, same-intent replay, atomic claim refusal without/from another operator, immutable actor/amount audit, one dispatch, legacy/new offline validator, disabled rule and denied direct roles. Isolated database.');
}
