/*
GNU GENERAL PUBLIC LICENSE

This is an example of a client-side for a Video Streaming System over WebRTC.

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

var signalingChannel = new WebSocket("ws://192.168.1.41:9876/"); // <-- Your server.py IP:PORT here
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
btnStream.disabled=true;

// ---------------- Streaming Video Part ----------------

window.MediaSource = window.MediaSource || window.WebKitMediaSource;
if (!!!window.MediaSource) {
  alert('MediaSource API is not available :_(\nThis experiment only works in Chrome.');
}

var queue=[];
var sourceBuffer;
var current=0;

var video = document.getElementById("player");
var mediaSource = new MediaSource();
mediaSource.addEventListener('sourceopen', onSourceOpen.bind(this, video));
video.src = window.URL.createObjectURL(mediaSource);

function handleChunk(chunk){
	queue.push(chunk);
	current++;
	document.getElementById('byte_range').textContent = "send/received: "+current;
	if (current==1){
		video.src = window.URL.createObjectURL(mediaSource);
		video.pause();
	}
	
	if (current>=2){ //Size to start feeding Media Source
		appendNextMediaSegment(mediaSource);
	}

	if (current==128){//Buffer size to play
		video.play();			
	}
		

}

function onSourceOpen(videoTag, e) {
    var mediaSource = e.target;

    if (mediaSource.sourceBuffers.length > 0){
		console.log("SourceBuffer.length > 0");
       		return;
	}

    //var sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');
    var sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
    //videoTag.addEventListener('seeking', onSeeking.bind(videoTag, mediaSource));
    //videoTag.addEventListener('progress', onProgress.bind(videoTag, mediaSource));

    var initSegment = new Uint8Array(queue.shift());//GetInitializationSegment();

    if (initSegment.length==0) {
      // Error fetching the initialization segment. Signal end of stream with an error.
	  console.log("initSegment is null");
      mediaSource.endOfStream("network");
      return;
    }

    // Append the initialization segment.
    var firstAppendHandler = function(e) {
	  console.log("First Append Handler");
      var sourceBuffer = e.target;
      sourceBuffer.removeEventListener('updateend', firstAppendHandler);

      // Append some initial media data.
      appendNextMediaSegment(mediaSource);
    };

    sourceBuffer.addEventListener('updateend', firstAppendHandler);
    sourceBuffer.addEventListener('update', onProgress.bind(videoTag, mediaSource));
	console.log("Send init block");
    sourceBuffer.appendBuffer(initSegment);
	console.log('mediaSource readyState: ' + mediaSource.readyState);

  }

function appendNextMediaSegment(mediaSource) {
    if (mediaSource.readyState == "closed"){
	  console.log("readyState is closed");    
	  return;
	}

    // If we have run out of stream data, then signal end of stream.
    //if (!HaveMoreMediaSegments()) {
    //  mediaSource.endOfStream();
    //  return;
    //}

    // Make sure the previous append is not still pending.
    if (mediaSource.sourceBuffers[0].updating){
	    //console.log("SourceBuffer is updating");    
	    return;
	}


    if (queue.length==0) {
      // Error fetching the next media segment.
	//console.log("mediaSegment is null need buffering");
      //mediaSource.endOfStream("network");
      return;
    }
	
    var mediaSegment = new Uint8Array(queue.shift());//GetNextMediaSegment();

    // NOTE: If mediaSource.readyState == “ended”, this appendBuffer() call will
    // cause mediaSource.readyState to transition to "open". The web application
    // should be prepared to handle multiple “sourceopen” events.
	//console.log("Send next block");
    mediaSource.sourceBuffers[0].appendBuffer(mediaSegment);

  }
function onSeeking(mediaSource,e) {
	console.log("on Seeking");
    var video = e.target;

    if (mediaSource.readyState == "open") {
      // Abort current segment append.
     // mediaSource.sourceBuffers[0].abort();
    }

    // Notify the media segment loading code to start fetching data at the
    // new playback position.
    //SeekToMediaSegmentAt(video.currentTime);

    // Append a media segment from the new playback position.
	//appendNextMediaSegment(mediaSource);
 }
function onProgress(mediaSource,e) {
     //console.log("on Progress");
     appendNextMediaSegment(mediaSource);
}



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
	peerlist.push(i);
	console.log("PEER LIST UPDATE: "+peerlist);
	console.log("Saved in slot: "+i+" PeerConection: "+pcs[i]);
}

function localDescCreated(desc,pc,i) {
    pc.setLocalDescription(desc, function () {
	console.log("localDescription is Set");
        signalingChannel.send(JSON.stringify({ "sdp": pc.localDescription , "idtransmitter":'"'+idpeer+'"', "idreceiver":'"'+i+'"'}));
    }, logError);
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
				console.log(i+" said bye!");
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
	
	reader.onload = function(e) {
		feedIt();
		//console.log('appending chunk:' + temp);
	};
    	
	var blob;
	blob = file.slice(start, start + 1024)
	reader.readAsArrayBuffer(blob);
	
	
    
  }

  document.querySelector('.readBytesButtons').addEventListener('click', function(evt) {
    if (evt.target.tagName.toLowerCase() == 'button') {
		//setInterval('feedIt()',20);   
		feedIt();
    }
  }, false);

function feedIt(){
	readBlob(temp);
	temp+=1024;
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
