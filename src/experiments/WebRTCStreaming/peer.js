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

var signalingChannel = new WebSocket("ws://150.214.150.68:4561/"); //server.py IP
signalingChannel.binaryType = "arraybuffer";
var configuration = {iceServers: [{ url: 'stun:stun.l.google.com:19302' }]};
//var configuration = {iceServers: [{ url: 'stun:150.214.150.137:3478' }]};
var pcs=[];
var channel=[];
var idpeer=0;
var peerlist=[];
var iniConnection = document.getElementById("initiateConnection");
var sender = document.getElementById("btnSender");
var receiver = document.getElementById("btnReceiver");
var icecandidates = document.getElementById("candidateices");
var msg = document.getElementById("msg");
var creator=document.getElementById("creator");
var btnStream= document.getElementById("streamit");
var temp=0;
btnStream.disabled=false;

// ---------------- Streaming Video Part ----------------

window.MediaSource = window.MediaSource || window.WebKitMediaSource;
if (!!!window.MediaSource) {
  alert('MediaSource API is not available :_(');
}

window.RTCPeerConnection = window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
if (!!!window.RTCPeerConnection || !!!window.RTCIceCandidate || !!!window.RTCSessionDescription) {
  alert('WebRTC API is not available :_(');
}

var queue=[];
var sourceBuffer;
var current=0;
var video = document.getElementById("player");
var mediaSource = new MediaSource;
video.src = URL.createObjectURL(mediaSource);
mediaSource.addEventListener('sourceopen', onSourceOpen);


function handleChunk(chunk){
	queue.push(chunk);
	appendChunk();
	current++;
	document.getElementById('byte_range').textContent = "send/received: "+current;

	/*
	if (current==1){
		video.src = window.URL.createObjectURL(mediaSource);
		video.pause();
	}
	
	if (current>=2){ //Size to start using
		appendNextMediaSegment(mediaSource);
	}

	if (current==1){//Buffer size to play
		console.log("play");
		video.play();			
	}
	*/
		

}

var sourceBuffer = null;
function onSourceOpen() {

    sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');

    //videoTag.addEventListener('seeking', onSeeking.bind(videoTag, mediaSource));
    //videoTag.addEventListener('progress', onProgress.bind(videoTag, mediaSource));

    //video.addEventListener('timeupdate', checkBuffer);
    video.addEventListener('canplay', function () {
            video.play();
    });
    video.addEventListener('seeking', seek);
  }


function seek (e) {
	console.log(e);
	if (mediaSource.readyState === 'open') {
	  sourceBuffer.abort();
	  console.log(mediaSource.readyState);
	} else {
	  console.log('seek but not open?');
	  console.log(mediaSource.readyState);
	}
}


function appendChunk(){
    if (!sourceBuffer.updating){
        console.log("chunk sent to the player");
        var chunk = new Uint8Array(queue.shift());
        sourceBuffer.appendBuffer(chunk);
    }
}

/*
function checkBuffer(){
	console.log("checking buffer... "+queue.length);
	for (i = 0; i < (100 - queue.length); i++){
		feedIt();
	}
}
*/

// ----------------- WebRTC Part --------------------
//
var isInitiator=false;
iniConnection.onclick=function(e){
	var i=document.getElementById("msg").value;
	start(true,i);
	iniConnection.disabled=true;
};


// call start(true,i) to initiate
function start(isInitiator,i) {
	console.log("creado para: "+i);
	pcs[i] = new RTCPeerConnection(configuration);
	

	// send any ice candidates to the other peer
	pcs[i].onicecandidate = function (evt) {
		signalingChannel.send(JSON.stringify({ "candidate": evt.candidate , "idtransmitter":'"'+idpeer+'"', "idreceiver":'"'+i+'"'}));
	};


	// let the "negotiationneeded" event trigger offer generation
	pcs[i].onnegotiationneeded = function () {
		pcs[i].createOffer().then(function(offer){
			return pcs[i].setLocalDescription(offer);
		})
		.then(function() {
			signalingChannel.send(JSON.stringify({ "sdp": pcs[i].localDescription , "idtransmitter":'"'+idpeer+'"', "idreceiver":'"'+i+'"'}));			
			console.log("Create and send OFFER");
			
		})
		.catch(logError)
		
	};

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
	peerlist.push(i);
	console.log("PEER LIST UPDATE: "+peerlist);
	console.log("Saved in slot: "+i+" PeerConection: "+pcs[i]);
}

signalingChannel.onmessage = function (evt) {
	handleMessage(evt);
}

function handleMessage(evt){
	var message = JSON.parse(evt.data);
	
	if (message.numpeer){    
		idpeer=message.numpeer;
		console.log('Peer ID: '+idpeer);
		document.getElementById('PeerID').textContent = idpeer;
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
        console.log(message.sdp);
		if (message.sdp.type == "offer"){   
			pcs[id].setRemoteDescription(message.sdp).then(function () {
				return pcs[id].createAnswer();
			})
			.then(function (answer) {
				return pcs[id].setLocalDescription(answer);
				console.log("remoteDescription is Set");
			})
			.then(function  () {
				signalingChannel.send(JSON.stringify({ "sdp": pcs[id].localDescription , "idtransmitter":'"'+idpeer+'"', "idreceiver":'"'+id+'"'}));			
				console.log("Create and send ANSWER");
			})
			.catch(logError);
		}else
			pcs[id].setRemoteDescription(message.sdp).catch(logError);
	}else if (message.candidate){
		console.log(message.candidate)
		pcs[id].addIceCandidate(message.candidate).catch(logError);
		console.log("Received ice candidate: "+ message.candidate);
	}
}


function setupChat(i) {
    channel[i].onopen = function () {
    	btnStream.disabled=false;
    };

    channel[i].onmessage = function (evt) {
       //console.log("block received");
       handleChunk(evt.data);
    };
}

function sendChatMessage(chunk) {
	for (i in peerlist){  
		if (peerlist[i]!=idpeer){
			//console.log("send to "+peerlist[i]);  
			try{
				channel[peerlist[i]].send(chunk);
			}catch(e){
				console.log(peerlist[i]+" said bye!");
			}

		}
	}
}

//----------------- File Load Part --------------------
//http://www.html5rocks.com/es/tutorials/file/dndfiles

function readBlob(time) {
	
    var files = document.getElementById('files').files;
    if (!files.length) {
      alert('Please select a file!');
      return;
    }

    var file = files[0];
    var start = time;
    var stop = file.size - 1;
	if (time>file.size)
		return;
    var reader = new FileReader();
	
    // If we use onloadend, we need to check the readyState.
    reader.onloadend = function(evt) {

      if (evt.target.readyState == FileReader.DONE) { // DONE == 2
	handleChunk(evt.target.result);
	sendChatMessage(evt.target.result);
        //document.getElementById('byte_content').textContent = evt.target.result;
        //document.getElementById('byte_range').textContent = (start+1)/1024;
			
			
      }
     };
	
	/*
	reader.onload = function(e) {
		feedIt();
		//console.log('appending chunk:' + temp);
	};
	*/
	
	var blob;
	blob = file.slice(start, start + 16384)
	reader.readAsArrayBuffer(blob);
	
	
    
  }

  document.querySelector('.readBytesButtons').addEventListener('click', function(evt) {
    if (evt.target.tagName.toLowerCase() == 'button') {
		setInterval('feedIt()', 50);   
    }
  }, false);


function feedIt(){
	readBlob(temp);
	temp+=16384;
}

sender.onclick=function(e){
	document.getElementById("choose").style.display="none";
	document.getElementById("sender").style.display="inline";
	document.getElementById("warning").style.display="inline";
};

receiver.onclick=function(e){
	document.getElementById("choose").style.display="none";
	document.getElementById("receiver").style.display="inline";
};

function logError(error) {
    console.log(error.name + ": " + error.message);
}
