const functions = require('firebase-functions');
const admin = require('firebase-admin')

const express = require('express')
const app = express()

const engine = require('ejs-locals')

const serviceAccount = require('./service.json')

const path = require('path')

app.engine('ejs', engine)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, '/views'))

app.use('/public', express.static('public'))

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://apnakisanbeta.firebaseio.com"
})

const auth = admin.auth();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const session = require('express-session');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))

function serveContentForUser(endpoint, req, res, decodedClaims) {
    // Lookup the user information corresponding to cookie and return the profile data for the user.
    return admin.auth().getUser(decodedClaims.sub).then((userRecord) => {
        console.log(userRecord)
        const html = '<!DOCTYPE html>' +
            '<html>' +
            '<meta charset="UTF-8">' +
            '<link href="style.css" rel="stylesheet" type="text/css" media="screen" />' +
            '<meta name="viewport" content="width=device-width, initial-scale=1">' +
            '<title>Sample Profile Page</title>' +
            '<body>' +
            '<div id="container">' +
            '  <h3>Welcome to Session Management Example App, ' + (userRecord || 'N/A') + '</h3>' +
            '  <div id="loaded">' +
            '    <div id="main">' +
            '      <div id="user-signed-in">' +
            // Show user profile information.
            '        <div id="user-info">' +
            '          <div id="photo-container">' +
            (userRecord.photoURL ? '      <img id="photo" src=' + userRecord.photoURL + '>' : '') +
            '          </div>' +
            '          <div id="name">' + userRecord + '</div>' +
            '          <div id="email">' +
            userRecord.phoneNumber + ' (' + (userRecord.emailVerified ? 'verified' : 'unverified') + ')</div>' +
            '          <div class="clearfix"></div>' +
            '        </div>' +
            '        <p>' +
            // Append button for sign out.
            '          <button id="sign-out" onClick="window.location.assign(\'/logout\')">Sign Out</button>' +
            // Append button for deletion.
            '          <button id="delete-account" onClick="window.location.assign(\'/delete\')">' +
            'Delete account</button>' +
            '        </p>' +
            '      </div>' +
            '    </div>' +
            '  </div>' +
            '</div>' +
            '</body>' +
            '</html>';
        res.set('Content-Type', 'text/html');
        return res.end(html);
    });
}

function attachCsrfToken(url, cookie, value) {
    return function (req, res, next) {
        if (req.url === url) {
            res.cookie(cookie, value);
        }
        next();
    }
}

function checkIfSignedIn(url) {
    console.log('===========' + url)
    return function (req, res, next) {
        if (req.url === url) {
            const sessionCookie = req.cookies.session || '';
            // User already logged in. Redirect to profile page.
            admin.auth().verifySessionCookie(sessionCookie).then((decodedClaims) => {
                return res.redirect('/profile');
            }).catch((error) => {
                next();
            });
        } else {
            next();
            return;
        }
    }
}

app.use(cookieParser());
// Attach CSRF token on each request.
app.use(attachCsrfToken('/', 'csrfToken', (Math.random() * 100000000000000000).toString()));

app.use(checkIfSignedIn('/',));

/** Get profile endpoint. */
app.get('/profile', (req, res) => {
    // Get session cookie.
    const sessionCookie = req.cookies.session || '';
    // Get the session cookie and verify it. In this case, we are verifying if the
    // Firebase session was revoked, user deleted/disabled, etc.
    admin.auth().verifySessionCookie(sessionCookie, true /** check if revoked. */)
        .then((decodedClaims) => {
            // Serve content for signed in user.
            return serveContentForUser('/profile', req, res, decodedClaims);
        }).catch((error) => {
            // Force user to login.
            res.redirect('/');
        });
});

/** Session login endpoint. */
app.post('/sessionLogin', (req, res) => {
    // Get ID token and CSRF token.
    const idToken = req.body.idToken.toString();
    const csrfToken = req.body.csrfToken.toString();

    // Guard against CSRF attacks.
    if (!req.cookies || csrfToken !== req.cookies.csrfToken) {
        res.status(401).send('UNAUTHORIZED REQUEST!');
        return;
    }
    // Set session expiration to 5 days.
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    // Create the session cookie. This will also verify the ID token in the process.
    // The session cookie will have the same claims as the ID token.
    // We could also choose to enforce that the ID token auth_time is recent.
    admin.auth().verifyIdToken(idToken).then((decodedClaims) => {
        // In this case, we are enforcing that the user signed in in the last 5 minutes.
        if (new Date().getTime() / 1000 - decodedClaims.auth_time < 5 * 60) {
            return admin.auth().createSessionCookie(idToken, { expiresIn: expiresIn });
        }
        throw new Error('UNAUTHORIZED REQUEST!');
    }).then((sessionCookie) => {
        // Note httpOnly cookie will not be accessible from javascript.
        // secure flag should be set to true in production.
        const options = { maxAge: expiresIn, httpOnly: true, secure: false /** to test in localhost */ };
        res.cookie('session', sessionCookie, options);
        return res.end(JSON.stringify({ status: 'success' }));
    }).catch((error) => {
        res.status(401).send('UNAUTHORIZED REQUEST!');
    });
});

/** User signout endpoint. */
app.get('/logout', (req, res) => {
    // Clear cookie.
    const sessionCookie = req.cookies.session || '';
    res.clearCookie('session');
    // Revoke session too. Note this will revoke all user sessions.
    if (sessionCookie) {
        admin.auth().verifySessionCookie(sessionCookie, true).then((decodedClaims) => {
            return admin.auth().revokeRefreshTokens(decodedClaims.sub);
        })
            .then(() => {
                // Redirect to login page on success.
                return res.redirect('/');
            }).catch(() => {
                // Redirect to login page on error.
                res.redirect('/');
            });
    } else {
        // Redirect to login page when no session cookie available.
        res.redirect('/');
    }
});

app.post('/cookie', (req, res) => {
    const received = req.body.userid;
    console.log('received.......')


    admin.auth().verifyIdToken(received)
        .then((decodedToken) => {
            let uid = decodedToken.uid;
            res.cookie('userid', uid, { path: '/' })
            console.log(uid)
            res.send(uid)
            return
            // ...
        }).catch((error) => {
            // Handle error
            console.log(error)
            res.send(error)
        });
})

app.get('/', authCheck, (req, res) => {
    //if(!uid) res.cookie('userid','iiii',{session})
    console.log((Math.random() * 10000) * 100000)
    res.render('index', {})
})
app.get('/login', (req, res) => {
    res.render('pages/login')
})
app.get('/cart', (req, res) => {
    res.render('pages/cart')
})

exports.app = functions.https.onRequest(app)

