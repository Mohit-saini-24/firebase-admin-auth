const functions = require('firebase-functions');
const admin = require('firebase-admin')

const express = require('express')
const app = express()

const engine = require('ejs-locals')

const serviceAccount = require('./service.json')

app.engine('ejs', engine);
app.set('view engine', 'ejs')
app.set('views', __dirname + '/views')

app.use('/public', express.static('public'))

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://apnakisanbeta.firebaseio.com"
})

const session = require('express-session');
app.use(session({
    secret: 'something',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true,
        path: '/',
        expires: 1000 * 60 * 60 * 24 * 365
    }
}))

function authCheck(req, res, next) {
    var session = req.session
    if (!session) {
        console.log('no session....')
        return next();
    }
    console.log('session present...')
    console.log(session.cookie)
    req.session.uid = {
        id: 'aaaaa',
        expires: 1000 * 60 * 60 * 24
    }
    res.cookie('something','fffffff', {path:'/'})
    console.log(session.uid)
    next();
}

app.get('/', authCheck, (req, res) => {
    // var middle = req.cookies
    var middle = req.cookies
    console.log('index..')
    console.log(middle)
    res.render('index')
})


exports.app = functions.https.onRequest(app)

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
