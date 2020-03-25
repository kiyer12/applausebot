const express = require("express");
const session = require('express-session');
const pug = require('pug');
const shortid = require('shortid');
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const sounds = {
  "applause": "Applause",
  "goodmusic": "Never Gonna Give You Up",
  "cheer": "Cheer",
};

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
const compiledCallPage = pug.compileFile(__dirname + "/views/call.pug");

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

app.post("/twiml/:name", (request, response) => {
  response.sendFile(__dirname + "/public/" + request.params.name + ".xml");
});

app.post("/startcall", (request, response) => {

  if (!isAuthed(request.session)) {
    console.log("not authorized in connect");
    console.log(request.session);

    response.redirect("/");
    return;
  }

  var createParams = {
    url: process.env.SELF_URL+'twiml/silent-loop',
    from: process.env.TWILIO_FROM_NUMBER,
    statusCallback: process.env.SELF_URL+'twilioCallback',
    statusCallbackMethod: 'POST'
  };

  var numberParts = request.body.number.split(",,");
  createParams['to'] = numberParts[0];  
  if (numberParts.length > 1)  {
    createParams['sendDigits'] = numberParts[1];
  }

  console.log(createParams);
  console.log('twilio client now');
  var botId = shortid.generate();
  var callURL = process.env.SELF_URL + "c/" + botId;
  
  if (doRealTwilio) {
    twilioClient.calls
    .create(createParams)
    .then(call => {
      db.get('calls')
      .push({ 
        id: 1, 
        url: callURL, 
        botId: botId, 
        twilioCallId: call.sid,
        dateTime: new Date().toString()
      })
      .write();
    
      response.send(compiledLoggedInPage({ 
        "email": request.session.email,
        "newCallUrl": callURL,
        "status": "callStarted"
      }));
    });
  }
  else {
    // Do the same thing, just use "temp" for the callId.
    db.get('calls')
    .push({ 
      id: 1, 
      url: callURL, 
      botId: botId, 
      twilioCallId: 'mockValue',
      dateTime: new Date().toString()
    })
    .write();
  
    response.send(compiledLoggedInPage({ 
      "email": request.session.email,
      "newCallUrl": callURL,
      "status": "callStarted"
    }));
  }
});

app.get("/c/:callId", (request, response) => {
  console.log(request.params.callId);
  var call = db.get('calls')
  .find({ botId:  request.params.callId})
  .value();

  if (!call) {
    response.send(compiledCallPage({ 
      error: "Link has expired."
    }));      
    return;
  }
  console.log(call.twilioCallId);
  console.log(call.dateTime);

  console.log(sounds);
  twilioClient.calls(call.twilioCallId)
  .fetch()
  .then(twCall => {
    response.send(compiledCallPage({ 
      "status": twCall.status,
      "email": request.session.email,
      "twCall": twCall,
      "sounds": sounds,
      "call": call    }));    
  });
});

app.post("/c/:callId/:action", (request, response) => {
  console.log(request.params.callId);
  var call = db.get('calls')
  .find({ botId:  request.params.callId})
  .value();

  if (!call) {
    response.send(compiledCallPage({ 
      error: "Link has expired or the call is no longer valid."
    }));      
    return;
  }

  if (request.params.action === 'play') {
    console.log("playing a sound");
    if (doRealTwilio) {
      console.log("twilioCallId: "+call.twilioCallId);
      console.log(request.body.sound);
      var soundName = "applause";
      if (request.body.sound in sounds) {
        soundName = request.body.sound;
      }
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
    var resp = {
      "status": "complete",
    };
    response.json(resp);
  }
  else {
    var resp = {
      "status": "unknown action: " + request.params.action,
    };
    response.json(resp);
  }
});

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Listening on port " + listener.address().port);
});
