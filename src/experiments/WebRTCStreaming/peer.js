/*
GNU GENERAL PUBLIC LICENSE

This is an example of a client-side for a multi-party chat over WebRTC.

Copyright (C) 2014 Cristóbal Medina López.
http://www.p2psp.org

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var signalingChannel = new WebSocket("ws://192.168.1.14:9876/");
signalingChannel.binaryType = "arraybuffer";
var configuration = {iceServers: [{ url: 'stun:stun.l.google.com:19302' }]};
//var configuration = {iceServers: [{ url: 'stun:150.214.150.137:3478' }]};
var pcs=[];
var channel=[];
var idpeer=0;
var iniConnection = document.getElementById("initiateConnection");
var icecandidates = document.getElementById("candidateices");
var msg = document.getElementById("msg");
var creator=document.getElementById("creator");
var btnHello= document.getElementById("sayHello");
btnHello.disabled=true;

// ---------------- Streaming Video Part ----------------

var video = document.getElementById("player");

window.MediaSource = window.MediaSource || window.WebKitMediaSource;
if (!!!window.MediaSource) {
  alert('MediaSource API is not available');
}

var mediaSource = new MediaSource();
var queue=[];
var first=false;	
var sourceBuffer;
var current=0;

video.src = window.URL.createObjectURL(mediaSource);

function handleChunk(chunk,numblock){
	
	//add stream to the queue
	//queue.push(chunk);

	queue[numblock]=chunk;
	
	//Buffering....
	if (queue.length==300)
		first=true;		

        if(first){
		
		//Header is sent to player (consume stream of the queue)
		var chunk=new Uint8Array(queue.shift());
		//var chunk=new Uint8Array(queue[current++]);
		try{		
			sourceBuffer.appendBuffer(chunk);
		}catch(e){
			//console.log('numero de bloque: '+numblock);	
			console.log(e);	
		}
		first=false;
	}
}

function callback(e) {

  sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');
  
  sourceBuffer.addEventListener('updateend', function() {
	  if (queue.length) {
 		//Sent to player (consume stream of the queue)
		//console.log('sent to player')
	  	var chunk=new Uint8Array(queue.shift());
		//var chunk=new Uint8Array(queue[current++]);
		sourceBuffer.appendBuffer(chunk); 
	 }else{
		first=true;
	 }
  });
 
  signalingChannel.onopen = function (e) { console.log("WebSocket connected"); };
  
  //handle recive data from websocket
  signalingChannel.onmessage = function (evt) {
	try
	{
	  	var jsonObject = JSON.parse(evt.data);
	  	//If it is a string for the signaling
		//console.log("received a string");
		handleMessage(evt)
	}
	catch(e)
	{
	  	//If it is a chunk of video
		//console.log("received a video chunk");
		var block=new Uint16Array(evt.data);
		sendChatMessage(evt.data);
		handleChunk((evt.data).slice(2),block[0]);
		//handleChunk(evt.data)
	}

  }
  console.log('mediaSource readyState: ' + this.readyState);

}

mediaSource.addEventListener('sourceopen', callback);
mediaSource.addEventListener('webkitsourceended', function(e) {
  logger.log('mediaSource readyState: ' + this.readyState);
}, false);




// ----------------- WebRTC Part --------------------
var isInitiator=false;
iniConnection.onclick=function(e){
	for (i=0;i<idpeer;i++){	
		start(true,i);
	}
	isInitiator=true;
};

btnHello.onclick=sendChatMessage;

// call start(true) to initiate
function start(isInitiator,i) {
     //iniConnection.disabled=true;
	
	pcs[i] = new webkitRTCPeerConnection(configuration, {optional: []});
	

	// send any ice candidates to the other peer
	pcs[i].onicecandidate = function (evt) {
		if (evt.candidate){
			signalingChannel.send(JSON.stringify({ "candidate": evt.candidate , "idtransmitter":'"'+idpeer+'"', "idreceiver":'"'+i+'"'}));
		}
	};


	// let the "negotiationneeded" event trigger offer generation
	pcs[i].onnegotiationneeded = function () {
		pcs[i].createOffer(function(desc){localDescCreated(desc,pcs[i],i);});
		console.log("Create and send OFFER");
	}

	if (isInitiator) {
		// create data channel and setup chat
		channel[i] = pcs[i].createDataChannel("chat"+i);
		setupChat(i);
	} else {
	// setup chat on incoming data channel
		pcs[i].ondatachannel = function (evt) {
			channel[i] = evt.channel;
			setupChat(i);
		};
	}  
	console.log("Saved in slot: "+i+" PeerConection: "+pcs[i]);
}

function localDescCreated(desc,pc,i) {
    pc.setLocalDescription(desc, function () {
	console.log("localDescription is Set");
        signalingChannel.send(JSON.stringify({ "sdp": pc.localDescription , "idtransmitter":'"'+idpeer+'"', "idreceiver":'"'+i+'"'}));
    }, logError);
}



function handleMessage(evt){
    var message = JSON.parse(evt.data);
	
    if (message.numpeer){    
		idpeer=message.numpeer-1;
		console.log('Peer ID: '+idpeer);
		return;  	
    }  
   
    var id=(message.idtransmitter).split('"').join(''); 
    var idreceiver=(message.idreceiver).split('"').join(''); 
    console.log("Received from: "+id+" and send to: "+idreceiver);

    if (!pcs[id]) { 
		console.log('%cCreate a new PeerConection','background: #222; color: #bada55');
		start(false,id);
    } 	

    if (message.sdp && idreceiver==idpeer){
        //console.log(message.sdp);   
	pcs[id].setRemoteDescription(new RTCSessionDescription(message.sdp), function () {
		console.log("remoteDescription is Set");
    		// if we received an offer, we need to answer
		if (pcs[id].remoteDescription.type == "offer"){
			console.log("Create and send ANSWER");
        		pcs[id].createAnswer(function(desc){localDescCreated(desc,pcs[id],id);});
    		}
        });
    }

    if (message.candidate && idreceiver==idpeer){
		console.log("Received ice candidate: "+ message.candidate.candidate); 
		pcs[id].addIceCandidate(new RTCIceCandidate(message.candidate));
    }

}

function setupChat(i) {
    channel[i].onopen = function () {
        btnHello.disabled=false;
	if (isInitiator)	
		signalingChannel.send(JSON.stringify({ "fire":"fire" , "idtransmitter":'"'+idpeer+'"', "idreceiver":'"'+i+'"'}));
    };

    channel[i].onmessage = function (evt) {
	var block=new Uint16Array(evt.data);
	//console.log('llegada de bloque desde peer: '+block[0]);
	handleChunk((evt.data).slice(2),block[0]);

       //document.getElementById("receive").innerHTML+="<br />"+evt.data;
    };
}

function sendChatMessage(msg) {
    //document.getElementById("receive").innerHTML+="<br />"+msg.value;
	for (i=0;i<channel.length;i++){  
		if (i!=idpeer){
			//console.log("send to "+i);  
			channel[i].send(msg);
		}
	}
}

function logError(error) {
    console.log(error.name + ": " + error.message);
}
