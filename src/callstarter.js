'use strict';

import React from 'react'
import ReactDOM from 'react-dom'
import moment from 'moment'
import ZoomInvite from './zoom-invite.js'

const e = React.createElement;

class CallStarter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      value: null,
      inputValue: "",
      phoneNumber: null,
      callButtonStyle: "callButton"
    };
  }

  startCall(evt) {
    fetch("/api/startcall", { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: this.state.phoneNumber })
    })
    .then((response) => {
      console.log(response);
      return response.json();
    })
    .then((data) => {
      window.location.href = data.newCallUrl;
    })
  }

  validateNumber(input) {
    if (/^[\+\d,\#]+$/.test(input) && input.length >= 10) {
      return input;
    }
    return null;
  }
  
  //START HERE
  updateInputValue(evt) {
    var state = {
      inputValue: evt.target.value,
      phoneNumber: null,
      callButtonStyle: "callButton"
    };

    //see if we should also update phone number. 
    var validated = this.validateNumber(evt.target.value);
    if (validated !== null) {
      state.phoneNumber = evt.target.value;
      state.callButtonStyle = "callButton callButtonValidated";
    }
    else {
      var result = ZoomInvite.parse( evt.target.value );
      if (result !== "") {
        state.phoneNumber = result;
        state.callButtonStyle = "callButton callButtonValidated";
      }
    }

    this.setState(state);
  }

  render() {
    var callButton = (
        <button 
          className={this.state.callButtonStyle} 
          onClick={evt => this.startCall(evt)} 
          disabled={this.state.phoneNumber === null}
          >  
        📞 Call {this.state.phoneNumber}
      </button>
      );
    
    return (
      <div>
        <textarea
        style={{width:"300px", height:"100px", resize: "none"}}
        name="blah"
        required
        placeholder="Phone number, or extension, or a zoom invite. ex: +14086380968,,7323580# or just paste the zoom invite"
        onChange={evt => this.updateInputValue(evt)}
        />    
        <div>{ callButton }</div>
        <CallList />
      </div>
    );
  }
}

class CallList extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      callList: null
    };

    this.fetchCalls();
  }

  fetchCalls() {
    fetch("/calls", { 
      method: 'GET'
    })
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      this.setState({callList: data});
    })
  }

  render() {
    if (this.state.callList === null) {
      return (
        <div></div>
      );
    }
    else {
      return (
        <div>
          <h3>Recent Calls</h3>
          {
            this.state.callList.map( (value, index) => {
              return (<div key={value.callURL}>
                <a href={value.callURL}> Call to {value.creationParams.to} </a> 
                <span style={{ "marginLeft":"10px", color: 
              "#999" }}> 
                  { moment(value.dateTime).format('MMMM Do YYYY, h:mm:ss a') } 
                </span>
                </div>);
            }
            )
          }
        </div>
      )
    }
  }
}

const domContainer = document.querySelector('#callstarter');
ReactDOM.render(e(CallStarter), domContainer);