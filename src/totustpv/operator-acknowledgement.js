/** An acknowledgement attributes the existing sale to its authenticated owner.
 * It never selects or changes an account, a cash drawer or a fiscal identity. */
export function operatorAcknowledgement(value,actorId){
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['actorId','accepted'].includes(key))||value.accepted!==true||typeof value.actorId!=='string'||!value.actorId||value.actorId!==actorId)throw Error('TPV_CHECKOUT_OPERATOR_INVALID');
 return {actorId,accepted:true};
}
