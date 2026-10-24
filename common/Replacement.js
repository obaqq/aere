const fs = require('fs');

// Check if the files are already patched
const client = require(`../node_modules/bedrock-protocol/src/client.js`).replaced;
const rak = require(`../node_modules/bedrock-protocol/src/rak.js`).replaced;
const encryption = require(`../node_modules/bedrock-protocol/src/transforms/encryption.js`).replaced;
const connection = require("../node_modules/bedrock-protocol/src/connection.js").replaced;

if (rak && client && encryption && connection) return;

(async () => {
    const promises = [
        fs.promises.readFile('./ext/scripts/client.js', 'utf8')
            .then(data => fs.promises.writeFile("./node_modules/bedrock-protocol/src/client.js", data)),
        fs.promises.readFile('./ext/scripts/rak.js', 'utf8')
            .then(data => fs.promises.writeFile("./node_modules/bedrock-protocol/src/rak.js", data)),
        fs.promises.readFile('./ext/scripts/encryption.js', 'utf8')
            .then(data => fs.promises.writeFile("./node_modules/bedrock-protocol/src/transforms/encryption.js", data)),
        fs.promises.readFile('./ext/scripts/connection.js', 'utf8')
            .then(data => fs.promises.writeFile("./node_modules/bedrock-protocol/src/connection.js", data))
    ];

    try {
        await Promise.all(promises);
        console.log('All files replaced successfully! Restarting bot...');
        process.exit(0);
    } catch (err) {
        console.error(err);
    }
})();