'use strict';

const e = React.createElement;

class SoundBoard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      liked: false,
      callInfo: null
    };
  }

  render() {
    return (
      <div>
      <CallInfo value={callId} />
      <SoundList />
      </div>
    );
  }
}

class CallStart extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      liked: false,
      callInfo: null
    };

  }
  render() {
    if (this.state.liked) {
      return (
        <ProgressSpinner />
      );
    }

    return (
      <div>
        Here I am.
      </div>
    );
  }
}

class SoundList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      soundList: null
    };
    this.fetchSounds();
  }

  fetchSounds() {
    fetch("/c/" + callId + "/sounds", { method: 'POST' })
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      console.log("sounds data finished fetch");
      // console.log(data);
      this.setState((state, props) => {
        return {soundList: data};
      });
    })
  }

  render() {

    if (this.state.soundList === null) {
      return (
        <div>
          Loading...
          <ProgressSpinner />
        </div>
      );
    }
    else {
      return (
        <div className="soundList">
          { 
            Object.keys(this.state.soundList).map( 
              s => { return <SoundButton key={s} value={s} label={this.state.soundList[s].label} /> 
            })
          }
        </div>
      );
    }
  }
}

class SoundButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: props.value,
      label: props.label
    };
  }

  playSound(sound, thenFunc) {
    var data = {
      "callId": callId,
      "sound": sound
    };
    console.log(sound);    
    fetch("/c/" + callId + "/play", {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },        body: JSON.stringify(data)
    })
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      thenFunc(data);
    })
  }

  render() {
    return (
      <button className="soundButton" onClick={() => {
        this.playSound(this.state.value, data => {
          console.log("return data came back", data);
        });
        this.setState({value: 'X'});
      }
      }>
        {this.state.label}
      </button>
    );
  }
}

class CallInfo extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      callInfo: null,
    };

    this.fetchCallInfo();    
    // this.timer = setInterval(() => this.fetchCallInfo(), 15000);
  }

  fetchCallInfo() {
    // this.setState((state, props) => {
      // return {callInfo: null};
    // });
    fetch("/c/" + callId + "/status", {
      method: 'POST'})
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      console.log(data);
      this.setState((state, props) => {
        return {callInfo: data};
      });
    })
  }

  hangupCall() {
    fetch("/c/" + callId + "/hangup", { method: 'POST' })
    .then((response) => {
      return response.json();
    })
    .then((data) => {
    })
  }

  render() {
    if (this.state.callInfo !== null) {
      return (
        <div className="callList">
          <div>To: {this.state.callInfo.call.creationParams.to}</div>
          <div>Started: {
            moment(this.state.callInfo.call.dateTime).fromNow()
          }
            <span style={{color: 'darkgray' ,fontSize: '12px', marginLeft: '10px'}}>{ 
              moment(this.state.callInfo.call.dateTime) 
              .format('MMMM Do YYYY, h:mm:ss a')
            }</span>
          </div>
          <div>Call is {this.state.callInfo.twilioStatus}.</div>
          <button className="callButton" onClick={() => {
            console.log("hang up clicked");
            this.hangupCall();
          }}>
            ☎️ Hang Up
          </button>
        </div>
      );
    }

    return (
      <ProgressSpinner />
    );
  }
}

class ProgressSpinner extends React.Component {

  render() {
    return (
      <div className="lds-default"><div></div><div></div>
      <div></div><div></div><div></div><div></div>
      <div></div><div></div><div></div><div></div>
      <div></div><div></div></div>
    );
    }
}

const domContainer = document.querySelector('#soundboard');
ReactDOM.render(e(SoundBoard), domContainer);