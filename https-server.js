const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

const clientPath = path.join(__dirname, 'client');
app.use(express.static(clientPath));

const certsDir = path.join(__dirname, 'certs');
const options = {
    key: fs.readFileSync(path.join(certsDir, 'key.pem')),
    cert: fs.readFileSync(path.join(certsDir, 'cert.pem'))
};

const PORT = 5501;
https.createServer(options, app).listen(PORT, () => {
    console.log(`HTTPS Server running at https://localhost:${PORT}`);
});