const express = require("express");
const session = require('express-session');
const pug = require('pug');
const shortid = require('shortid');
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const app = express();
app.use(session(
  {
    secret: 'ssshhhhh23746823746', 
    cookie: { maxAge: 6000000},
    saveUninitialized: true,
    resave: false
  })
);

app.use(express.urlencoded()); // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json()); // Parse JSON bodies (as sent by API clients)

const adapter = new FileSync('.data/db.json')
const db = low(adapter);
db.defaults({ calls: [], count: 0 })
  .write();

const twilioAccountSid = process.env.TWILIO_ACCOUNT_ID;
const twilioAccountToken = process.env.TWILIO_TOKEN;
const twilioClient = require("twilio")(twilioAccountSid, twilioAccountToken);

function isAuthed(sess) {
  if(sess && sess.email) {
    return true;
  }
  return false;
}

// Compile our templates
const compiledLoggedInPage = pug.compileFile(__dirname + "/views/logged-in.pug");

// make all the files in 'public' available
app.use(express.static("public"));

app.get("/", (request, response) => {
  if (isAuthed(request.session)) {
    console.log("isAuthed");
    response.send(compiledLoggedInPage({ 
      "message": "",
      "email": request.session.email
    }));
  }
  else {
    response.sendFile(__dirname + "/views/login.html");
  }
});

// Login and session setting
app.post("/login", (request, response) => {
  var pass = request.body.pass;
  if (process.env.PASSWORD !== pass) {
    console.log("not authorized");
    response.sendStatus(401);
  }
  console.log("authorizing: " + request.body.email);
  sess=request.session;
  sess.email = request.body.email;
  response.redirect("/");
});

// Log when Twilio calls us back after a call ends or other status change
app.post("/twilioCallback", (request, response) => {
  console.log("status callback for twilio");
  response.json([]);
});

//Endpoint for hosting the twiml -> probably can submit this directly
//TODO: investigate and fix
app.post("/voiceXML", (request, response) => {
  response.sendFile(__dirname + "/public/voice.xml");
});

app.get("/connect", (request, response) => {

  if (!isAuthed(request.session)) {
    console.log("not authorized in connect");
    console.log(request.session);

    response.redirect("/");
    return;
  }

  var createParams = {
    url: process.env.SELF_URL+'voiceXML',
    from: '+12532992127',
    statusCallback: process.env.SELF_URL+'twilioCallback',
    statusCallbackMethod: 'POST'
  };

  var number = request.query.number;
  numberParts = number.split(",,");
  createParams['to'] = numberParts[0];

  var digitsToSend, numberItself;
  numberItself = numberParts[0];
  
  if (numberParts.length > 1)  {
    digitsToSend = numberParts[1];
    createParams['sendDigits'] = digitsToSend;
  }

  console.log(createParams);
  console.log('twilio client now');
  /*
  twilioClient.calls
  .create(createParams)
  .then(call => console.log(call.sid));
  */
  console.log(shortid.generate());
  var botId = shortid.generate();
  var callURL = process.env.SELF_URL + "c/" + botId;
  var message = "call to "+number+" complete.";
  message += " " + callURL;

  // db.get('calls')
  // .push({ id: 1, url: callURL, botId: botId, twilioCallId: 'temp'})
  // .write();

  response.send(compiledLoggedInPage({ "message": message}));
});

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
