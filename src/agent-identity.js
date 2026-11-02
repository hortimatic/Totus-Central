// Identity is verified by Auth, never selected from a hardcoded email allowlist.
export function agentIdentity(user){
 const email=String(user?.email||'').trim().toLowerCase(),meta=user?.app_metadata;
 if(typeof user?.id!=='string'||!user.id||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['totus_agent','totus_assistant','totus_codex','totus_ai','totus_integration'].some(k=>meta?.[k]===true))throw Error('Cuenta de IA autenticada requerida');
 return email;
}
