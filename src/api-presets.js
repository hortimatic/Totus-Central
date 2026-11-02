export const API_PRESETS=[
 {id:'groq',label:'Groq',endpoint:'https://api.groq.com/openai/v1',model:'openai/gpt-oss-20b',docs:'https://console.groq.com/docs/models',management:'console.groq.com'},
 {id:'mistral',label:'Mistral',endpoint:'https://api.mistral.ai/v1',model:'mistral-small-latest',docs:'https://docs.mistral.ai/api',management:'admin.mistral.ai'},
 {id:'openrouter',label:'OpenRouter · modelos gratuitos',endpoint:'https://openrouter.ai/api/v1',model:'openrouter/free',docs:'https://openrouter.ai/openrouter/free',management:'openrouter.ai'}
];
export function managementApiPreset(endpoint){try{const url=new URL(endpoint),host=url.hostname;return API_PRESETS.find(p=>p.management===host&&!(p.id==='openrouter'&&/^\/api\/v1(?:\/chat\/completions)?\/?$/.test(url.pathname)))||null;}catch{return null;}}
