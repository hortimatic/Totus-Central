export const API_PRESETS=[
 {id:'groq',label:'Groq',endpoint:'https://api.groq.com/openai/v1',model:'openai/gpt-oss-20b',docs:'https://console.groq.com/docs/models',management:'console.groq.com'},
 {id:'mistral',label:'Mistral',endpoint:'https://api.mistral.ai/v1',model:'mistral-small-latest',docs:'https://docs.mistral.ai/api',management:'admin.mistral.ai'}
];
export function managementApiPreset(endpoint){try{const host=new URL(endpoint).hostname;return API_PRESETS.find(p=>p.management===host)||null;}catch{return null;}}
