var signalingChannel = new WebSocket("ws://192.168.1.14:9876/");
var configuration = {iceServers: [{ url: 'stun:stun.l.google.com:19302' }]};
//var configuration = {iceServers: [{ url: 'stun:150.214.150.137:3478' }]};
var pc;
var channel;
var isInitiator=false;

var iniConnection = document.getElementById("initiateConnection");
var msg = document.getElementById("msg");
var creator=document.getElementById("creator");
var btnHello= document.getElementById("sayHello");
btnHello.disabled=true;

iniConnection.onclick=start;
btnHello.onclick=sendChatMessage;

creator.onclick=initiatorTrue;

function initiatorTrue(){
  isInitiator=true;
}


// call start(true) to initiate
function start(isInitiator) {
     pc = new webkitRTCPeerConnection(configuration, {optional: [{RtpDataChannels: true}]});

     // send any ice candidates to the other peer
     pc.onicecandidate = function (evt) {
		if (evt.candidate){
		    signalingChannel.send(JSON.stringify({ "candidate": evt.candidate , "idpeer":"5"}));
		    console.log("Candidato: "+evt.candidate.candidate);
		}
     };

    // let the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = function () {
	pc.createOffer(localDescCreated, logError);
    }

    if (isInitiator) {
	// create data channel and setup chat
	channel = pc.createDataChannel("chat");
	setupChat();
    } else {
	// setup chat on incoming data channel
	pc.ondatachannel = function (evt) {
	    channel = evt.channel;
	    setupChat();
	};
    }
}

function localDescCreated(desc) {
    pc.setLocalDescription(desc, function () {
        signalingChannel.send(JSON.stringify({ "sdp": pc.localDescription }));
    }, logError);
}

signalingChannel.onmessage = function (evt) {
    if (!pc)
        start(false);    

    var message = JSON.parse(evt.data);
	
    if (message.numpeer){    
	console.log('Number of Peers: '+message.numpeer);  
    }  

    if (message.sdp){
        console.log(message.sdp);
        pc.setRemoteDescription(new RTCSessionDescription(message.sdp), function () {
            // if we received an offer, we need to answer
            if (pc.remoteDescription.type == "offer")
                pc.createAnswer(localDescCreated, logError);
        }, logError);
    }

    if (message.candidate){
        pc.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
}

function setupChat() {
    channel.onopen = function () {
        btnHello.disabled=false;
    };

    channel.onmessage = function (evt) {
       document.getElementById("receive").innerHTML=evt.data;
    };
}

function sendChatMessage() {
    channel.send(msg.value);
}

function logError(error) {
    console.log(error.name + ": " + error.message);
}
