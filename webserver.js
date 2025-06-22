const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('BlasterBot is online!');
});

function keep_alive() {
    app.listen(8080, () => {
        console.log('Keep-alive server is running on port 3000');
    });
}

module.exports = { keep_alive };