const express = require('express');
const bodyParser = require('body-parser');
const path = require('path'); 
const fs = require('fs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const app = express();
const port = 0;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const databaseFile = 'userDatabase.json';

function saveUsers(users) {
    fs.writeFileSync(databaseFile, JSON.stringify(users, null, 2));
}

function loadUsers() {
    if (fs.existsSync(databaseFile)) {
        const data = fs.readFileSync(databaseFile, 'utf8');
        return JSON.parse(data);
    } else {
        return [];  
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function userExists(email) {
    const users = loadUsers();
    return users.some((user) => user.email === email);
}

function getUser(email) {
    const users = loadUsers();
    return users.find((user) => user.email === email);
}
// Specific route for the service worker
//app.get('/service-worker.js', (req, res) => {
   // console.log('Service worker requested.');
    //res.sendFile(__dirname + '/public/service-worker.js');
 // });

  
  // Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
const server = app.listen(port, () => {
    console.log(`Server is running on port ${server.address().port}`);
});

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/signup', (req, res) => {
    const { email, password } = req.body;

    if (!isValidEmail(email)) {
        return res.status(400).send('Invalid email format');
    }

    if (userExists(email)) {
        return res.status(400).send('User already exists');
    }

    const secret = speakeasy.generateSecret();
    const newUser = { email, password, secret: secret.base32 };
    const users = loadUsers();
    users.push(newUser);
    saveUsers(users);

    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
        if (err) {
            console.error('Error generating QR code:', err);
            return res.status(500).send('Error generating QR code');
        }

        res.send(`
            <html>
                <body>
                    <p>Scan the QR code with a 2FA app:</p>
                    <img src="${data_url}" alt="QR Code">
                </body>
            </html>
        `);
    });
});

app.post('/signin', (req, res) => {
    const { email, password, otp } = req.body;

    if (userExists(email) && getUser(email).password === password) {
        const user = getUser(email);
        const verified = speakeasy.totp.verify({
            secret: user.secret,
            encoding: 'base32',
            token: otp,
        });

        if (verified) {
            return res.status(200).send('Login successful');
        } else {
            return res.status(401).send('2FA verification failed');
        }
    } else {
        return res.status(401).send('Login failed');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
