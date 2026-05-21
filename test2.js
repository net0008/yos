import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const match = env.match(/GEMINI_API_KEY=([^\r\n]+)/);
const key = match ? match[1].replace(/["']/g, '') : '';

async function run() {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);
    const d = await r.json();
    if (d.models) {
        console.log("AVAILABLE FLASH MODELS:");
        console.log(d.models.filter(m => m.name.includes('flash')).map(m => m.name).join('\n'));
    } else {
        console.log("Response:", JSON.stringify(d, null, 2));
    }
}
run();
