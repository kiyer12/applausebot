const express = require("express");
const session = require('express-session');
const pug = require('pug');
const shortid = require('shortid');
const low = require('lowdb')
const fs = require('fs')
const FileSync = require('lowdb/adapters/FileSync')
const soundList = require('./sound-list.js')

const doRealTwilio = true;

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
db.defaults({ calls: [], count: 0 }).write();

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
const makeCallPage = pug.compileFile(__dirname + "/views/make-call.pug");
const compiledCallPage = pug.compileFile(__dirname + "/views/call.pug");
const controlCallPage = pug.compileFile(__dirname + "/views/control-call.pug");


// make all the files in 'public' available
app.use(express.static("public"));
app.use(express.static("dist"));

app.get("/", (request, response) => {
  if (isAuthed(request.session)) {
    response.send(makeCallPage({ 
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
  var sess = request.session;
  sess.email = request.body.email;
  response.redirect("/");
});

// Log when Twilio calls us back after a call ends or other status change
app.post("/twilioCallback", (request, response) => {
  console.log("status callback for twilio: " + request.body);
  response.json([]);
});

app.post("/twiml/:name", (request, response) => {

  if (request.params.name === "silent-loop") {
    response.sendFile(__dirname + "/public/" + request.params.name + ".xml");
  }
  else if (request.params.name in soundList) {
    var URL = soundList[ request.params.name ].soundURL;
    var xml = fs.readFileSync(__dirname + "/public/template-playsound-twiml.xml").toString();
    xml = xml.replace('%%SOUND_URL%%', URL);      
    response.send(xml);
  }
  else {
    response.sendStatus(404);
  }
});

function validateNumber(input) {
  if (/^[\+\d,\#]+$/.test(input)) {
    return input;
  }
  return null;
}

app.post("/api/startcall", (request, response) => {
  if (!isAuthed(request.session)) {
    response.sendStatus(401);
    return;
  }

  var createParams = {
    url: process.env.SELF_URL+'twiml/announce',
    from: process.env.TWILIO_FROM_NUMBER,
    statusCallback: process.env.SELF_URL+'twilioCallback',
    statusCallbackMethod: 'POST'
  };

  var fullNumberText = validateNumber(request.body.number);
  if (fullNumberText === null) {
    console.log("number didn't validate" + request.body.number);
    response.sendStatus(400);
    return;
  }

  var numberParts = fullNumberText.split(",,");
  createParams['to'] = numberParts[0];  
  if (numberParts.length > 1)  {
    createParams['sendDigits'] = numberParts[1];
  }

  var botId = shortid.generate();
  var call = {
    botId: botId,
    callURL: process.env.SELF_URL + "c/" + botId,
    dateTime: new Date().toISOString(),
    origInput: request.body.number,
    creationParams: createParams
  };

  if (doRealTwilio) {
    twilioClient.calls
    .create(createParams)
    .then(twCall => {
      call.twilioCallId = twCall.sid;
      db.get('calls').push(call).write();
      response.json({
        "newCallUrl": call.callURL,
        "status": "callStarted"
      });
    },
    reason => {
      response.json({
        "status": "Error starting the call"
      });
    }
    );
  }
  else {
    call.twilioCallId = "mockValue";
    db.get('calls').push(call).write();
    response.json({
      "newCallUrl": call.callURL,
      "status": "callStarted"
    });
  }

});

app.get("/calls", (request, response) => {
  if (!isAuthed(request.session)) {
    response.sendStatus(401);
    return;
  }
  var calls = db.get('calls')
  .takeRight(5)
  .sortBy('dateTime')
  .reverse()
  .value();

  response.json(calls);
});

app.get("/c/:callId", (request, response) => {
  var call = db.get('calls')
  .find({ botId: request.params.callId})
  .value();

  if (!call) {
    response.send(controlCallPage({ 
      error: "Link has expired.",
      "call": { botId: 'temp'}
    }));      
    return;
  }

  if (doRealTwilio) {
    twilioClient.calls(call.twilioCallId)
    .fetch()
    .then(twCall => {
      response.send(controlCallPage({ 
        "email": request.session.email,
        "call": call    }));    
    },
    reason => {
      console.log(reason);
      response.json(["Call not found"]);
    }
    );
  }
  else {
    response.send(controlCallPage({
      "email": request.session.email,
      "call": call
    }));
  }
});

function doTwilioPlay(request, call) {

  console.log(request.body);
  var soundName = "applause";
  if (request.body.sound in soundList) {
    soundName = request.body.sound;
  }
  console.log(soundName);
  if (doRealTwilio) {

    twilioClient.calls(call.twilioCallId)
    .update({
      url: process.env.SELF_URL + 'twiml/' + soundName,
    })
    .then(call => {
      console.log(call.to);
    },
    reason => {
      console.log('reason');
      console.log(reason);
    }
    );
  }
}

function doTwilioHangup(call) {

  if (doRealTwilio) {
    twilioClient.calls(call.twilioCallId)
    .update({status: 'completed'})
    .then(call => {
      console.log("hang up");
      console.log(call.to);
    },
    reason => {
      console.log('reason');
      console.log(reason);
    }
    );
  }
}

app.post("/c/:callId/:action", (request, response) => {
  var call = db.get('calls')
  .find({ botId:  request.params.callId})
  .value();

  if (!call) {
    response.sendStatus(404);
    return;
  }

  if (request.params.action === 'play') {
    doTwilioPlay(request, call);
    response.json({"status": "played"});
  }
  else if (request.params.action === 'sounds') {
    response.json(soundList);
  }
  else if (request.params.action === 'hangup') {
    console.log(call);
    doTwilioHangup(call);
  }
  else if (request.params.action === 'status') {
    if (call.twilioCallId === "mockValue" || !doRealTwilio) {
      response.json({
        call: call,
        twilioStatus: "invalid",
      });
      return;
    }
    
    twilioClient.calls(call.twilioCallId)
    .fetch().then(
      twCall => { response.json({ call: call, twilioStatus: twCall.status, }); },
      reason => { response.json({ call: call, twilioStatus: "invalid",}); }
    );
  }
  else {
    response.json({"status": "unknown action: " + request.params.action});
  }
});

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Listening on port " + listener.address().port);
});
