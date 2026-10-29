const fs = require('fs');
const path = require('path');

const baseDir = __dirname;

// 1. Overwrite background images with pure white JPG (so even cached image URLs show white)
const whiteJpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
fs.writeFileSync(path.join(baseDir, 'frontend', 'botanical_bg.jpg'), whiteJpg);
fs.writeFileSync(path.join(baseDir, 'frontend', 'theme_bg.jpg'), whiteJpg);
fs.writeFileSync(path.join(baseDir, 'frontend', 'bg.jpg'), whiteJpg);
console.log('Overwrote all background image files with pure white.');

// 2. Ensure agent.html has strict white styles both in <style> and inline on <body>
const agentPath = path.join(baseDir, 'frontend', 'agent.html');
let html = fs.readFileSync(agentPath, 'utf8');

const normalized = html.replace(/\r\n/g, '\n');

// Replace style
const updatedStyle = normalized.replace(/<style>[\s\S]*?<\/style>/, `  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    html, body {
      font-family: 'Inter', sans-serif !important;
      background-color: #ffffff !important;
      background: #ffffff !important;
      background-image: none !important;
    }
  </style>`);

// Add inline style to body
const updatedBody = updatedStyle.replace(/<body[^>]*>/, '<body style="background: #ffffff !important; background-color: #ffffff !important; background-image: none !important;" class="bg-white text-slate-900 min-h-screen font-sans flex flex-col antialiased">');

fs.writeFileSync(agentPath, updatedBody.replace(/\n/g, '\r\n'), 'utf8');
console.log('Updated agent.html with strict inline and tag styles for pure white.');

// 3. Update server.js to set no-cache headers
const serverPath = path.join(baseDir, 'server.js');
let serverCode = fs.readFileSync(serverPath, 'utf8');
const targetRoute = `app.get(['/', '/agent', '/agent.html'], (req, res) => {\r\n  res.sendFile(path.join(__dirname, 'frontend', 'agent.html'));\r\n});`;
const targetRouteLF = `app.get(['/', '/agent', '/agent.html'], (req, res) => {\n  res.sendFile(path.join(__dirname, 'frontend', 'agent.html'));\n});`;

const newRoute = `app.get(['/', '/agent', '/agent.html'], (req, res) => {\r\n  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');\r\n  res.set('Pragma', 'no-cache');\r\n  res.set('Expires', '0');\r\n  res.sendFile(path.join(__dirname, 'frontend', 'agent.html'));\r\n});`;

if (serverCode.includes(targetRoute)) {
  serverCode = serverCode.replace(targetRoute, newRoute);
  fs.writeFileSync(serverPath, serverCode, 'utf8');
  console.log('Updated server.js with no-cache headers.');
} else if (serverCode.includes(targetRouteLF)) {
  serverCode = serverCode.replace(targetRouteLF, newRoute.replace(/\r\n/g, '\n'));
  fs.writeFileSync(serverPath, serverCode, 'utf8');
  console.log('Updated server.js with no-cache headers (LF).');
} else {
  console.log('Note: targetRoute in server.js format differed or already updated.');
}
