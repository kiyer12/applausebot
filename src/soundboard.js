'use strict';

import React from 'react'
import ReactDOM from 'react-dom'
import moment from 'moment'

const e = React.createElement;

class SoundBoard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      liked: false,
      callInfo: null
    };

    this.fetchCallInfo();
    this.timer = setInterval(() => this.fetchCallInfo(), 15000);
  }

  fetchCallInfo() {
    fetch("/c/" + callId + "/status", {
      method: 'POST'})
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      console.log(data);
      this.setState({callInfo: data});

      clearInterval(this.timer);
      switch(data.twilioStatus) {
        case "queued": 
        case "ringing":
          this.timer = setInterval(() => this.fetchCallInfo(), 3000);
          break;
        case "in-progress":
          this.timer = setInterval(() => this.fetchCallInfo(), 5000);
          break;
        case "complete":
        case "invalid":
          // do nothing anymore, won't change.
          break;
        default:
          this.timer = setInterval(() => this.fetchCallInfo(), 15000);
      }
    })
  }

  render() {
    return (
      <div>
      <CallInfo callInfo={this.state.callInfo} value={callId} />
      <SoundList callInfo={this.state.callInfo} />
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
      return (<div> Loading... <ProgressSpinner /></div>);
    }
    else if (this.props.callInfo && this.props.callInfo.twilioStatus !== "completed") {
        return (<div className="soundList">
            { 
              Object.keys(this.state.soundList).map( 
                s => { return <SoundButton key={s} value={s} 
                                sound={this.state.soundList[s]}
                                label={this.state.soundList[s].label} /> 
               })
            }
          </div>);
    }
    else { return (<div></div>); }
  }
}

class SoundButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: props.value,
      label: props.label,
      sound: props.sound
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
      <span className="sound">
        <button className="soundButton" onClick={() => {
          this.playSound(this.state.value, data => {
            console.log("return data came back", data);
          });
        }
        }>
          {this.state.label}
        </button>
        <SoundPreview sound={ this.state.sound.soundURL } />
      </span>
    );
  }
}

class SoundPreview extends React.Component {
  constructor(props) {
    super(props);
    this.audioTag = React.createRef();
    this.state = {
      sound: props.sound,
      buttonTitle: "Preview >",
      progress: "0%"
    };

  }

  buttonTitle() {
    if (this.audioTag.current === null || this.audioTag.current.paused)
      return "Preview >";
    else return "|| Stop";
  }

  updateTime(evt) {
    var p = this.audioTag.current.currentTime / this.audioTag.current.duration;
    this.setState( { progress: Math.round(p*100) + "%" });
  }

  ended(evt) {
    this.setState( { progress: "0%" });
    this.setState( { buttonTitle: "Preview >" });
  }

  previewClick() {
    if (this.audioTag.current.paused) {
      this.audioTag.current.play();
      this.setState({ buttonTitle: "|| Pause"});
    }
    else {
      this.audioTag.current.pause();
      this.setState({ buttonTitle: "Preview >"});
    }
  }

  render() {
    return (
        <div className="soundPreviewContainer">
          <button className="soundPreviewButton" onClick={() => { this.previewClick() }}>
            { this.state.buttonTitle }
          </button>
          <div style={{ height:"2px", background:"#000", width:this.state.progress}}></div>
          <audio ref={ this.audioTag } 
            onEnded= { () => { this.ended() }}
            onTimeUpdate= {  (evt) => { this.updateTime(evt) } }
          >
            <source src={ this.state.sound } />
          </audio>
        </div>
    );
  }
}

class CallInfo extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    };
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
    if (this.props.callInfo !== null) {

      var hangupButton;
      if (this.props.callInfo.twilioStatus !== "completed") {
        hangupButton = (
          <button className="hangupButton" onClick={() => {
            this.hangupCall();
          }}>
            ☎️ Hang Up
          </button>
        )
      }
      var creationParams = this.props.callInfo.call.creationParams;
      var call = this.props.callInfo.call;
      return (
        <div className="callList">
          <span className="callTitle">Call {creationParams.to} {creationParams.sendDigits}</span>
          <span style={{color: '#666' ,fontSize: '12px'}}>{ 
              moment(call.dateTime).fromNow() + ", " +
              moment(call.dateTime).format('MMMM Do YYYY, h:mm:ss a')
            }
          </span>
          <div>Call is {this.props.callInfo.twilioStatus}.</div>
          { hangupButton }
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