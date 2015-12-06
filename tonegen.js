"use strict"

//Add Event Listeners
document.getElementById("startTone").addEventListener("click", startTone);
document.getElementById("stopTone").addEventListener("click", stopTone);
document.getElementById("signalInputSubmit").addEventListener("click", connectSignalServer);

function logAppConsole(message) {
    document.getElementById("appConsole").innerHTML = message;
}

function logSignalConsole(message) {
    document.getElementById("signalConsole").innerHTML = message;
}

function logTraceConsole(message) {
    console.log(message);
}

function logErrorConsole(message) {
    console.log('Error: ' + message);
}

function logNativeConsole(message) {
    window.dump(message + '\n');
}

function processQuery(query) {
    query = query.replace('?', '');
    var pairs = query.split('&');
    var options = new Map();
    pairs.forEach( function(item, index) {
        var pair = item.split('=');
        if (pair.length == 2) {
            options.set(pair[0], pair[1])
        } else {
            logErrorConsole('malformed option ' + item);
        }
    });
    if (options.has('host')) {
        document.getElementById("signalInput").value = options.get('host');
    }
    if (options.has('connect')) {
        connectSignalServer();
    }
}

//Basic start/stop functions
function startTone() {
    if (typeof oscillator !== 'undefined') {
        logAppConsole('tone already started');
        return;
    }

    //Initialize the AudioContext Object and connect to destination
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    oscillator = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    //Initialize the Oscillator
    oscillator.type = 'sine'; // sine wave — other values are 'square', 'sawtooth', 'triangle' and 'custom'
    oscillator.frequency.value = 432; // value in hertz
    oscillator.start();

    logAppConsole('tone started');
}

function stopTone() {
    if (typeof oscillator === 'undefined') {
        logAppConsole('tone already stopped');
        return;
    }

    oscillator.stop();
    oscillator.disconnect();
    oscillator = null;

    logAppConsole('tone stopped');
}

// It looks like Google provides a STUN server that is available for anyone to use.
var iceConfiguration = webrtcDetectedBrowser === 'firefox' ?
    {'iceServers': [
        {'url':'stun:23.21.150.121'} // number IP
    ]} :
    {'iceServers': [
        {'url': 'stun:stun.l.google.com:19302'}
    ]};

var serverSocket;
var targetChannel;
var targetConn;
var peerConns = new Map();
var peerControls = new Map();
var peerConn;
var peerID;

function peerSessionDescription(sessionDescription) {
    peerConn.setLocalDescription(sessionDescription, function() {
        var message = new Object;
        message.session = sessionDescription;
        message.peer = peerID;
        serverSocket.emit('initiate connection', message);
    }, logTraceConsole);
}

// "peer" is captured and therefore we know which target is suggesting a ICE candidate
function peerIceCandidate(peer) {
    return function (message) {
        logTraceConsole('target ICE candidate from: ' + peer);
        if (message.candidate) {
            var response = new Object;
            response.peer = peer;
            response.candidate = message.candidate;
            serverSocket.emit('initiator ICE', response);
        }
    }
}

// "peerChannel" is captured and therefore we know the channel state
function peerChannelStateChange(peerChannel) {
    return function () {
        logTraceConsole('Target state: ' + peerChannel.readyState);
        if (peerChannel.readyState == 'open') {
            logNativeConsole('Channel open');
            peerChannel.send('hello from the initiator');
        }
    }
}

function createOffer(peer) {
    if (peerConns.has(peer)) {
        // We already have an open connection to the peer
        // TODO: assert that this is true
        return;
    }

    // TODO: the value side of the map should be an object that inherits from
    //       RTCPeerConnection so that it can know the peer ID.
    peerID = peer;
    peerConn = new RTCPeerConnection(iceConfiguration)
    peerConn.onicecandidate = peerIceCandidate(peerID);

    var peerChannel = peerConn.createDataChannel('control')
    peerChannel.onmessage = function (message) {
        logTraceConsole('Initiator received message: ' + message.data);
        logSignalConsole(message.data);
    }
    peerChannel.onopen = peerChannelStateChange(peerChannel);

    peerControls.set(peer, peerChannel);
    peerConns.set(peer, peerConn);

    peerConn.createOffer(peerSessionDescription, logErrorConsole);
}

function answerOffer(answer) {
    logTraceConsole('answer offer');
    targetConn.setLocalDescription(answer, function() {
        serverSocket.emit('answer connection', answer);
    }, logTraceConsole);
}

function completeOffer(peer, session) {
    peerConns.get(peer).setRemoteDescription(new RTCSessionDescription(session), function() {
        logTraceConsole('connection established');
    }, logErrorConsole);
}

function connectSignalServer() {
    var input = document.getElementById("signalInput").value;
    if (input.length === 0) {
        alert("Please specify a valid hostname and port");
        return;
    }

    serverSocket = io(input);

    serverSocket.on('initiate peers', function(message) {
        var peers = message;
        peers.forEach( function(peer, index, array) {
            createOffer(peer);
        });
        logSignalConsole('initiate peers: ' + peers);
    });

    serverSocket.on('signal peers', function(message) {
        var peers = message;
        logSignalConsole('signal peers: ' + peers);
    });

    serverSocket.on('offer connection', function(message) {
        logTraceConsole('got ' + message.type);
        targetConn.setRemoteDescription(new RTCSessionDescription(message), function() {
            logTraceConsole('create answer');
            targetConn.createAnswer(answerOffer, logErrorConsole);
        }, logErrorConsole);
    });

    serverSocket.on('complete connection', function(message) {
        logTraceConsole('got ' + message.session.type + ' from ' + message.peer);
        completeOffer(message.peer, message.session);
    });

    serverSocket.on('target accepted ICE', function(message) {
        logTraceConsole('got accept ICE from ' + message.peer);
        peerConns.get(message.peer).addIceCandidate(new RTCIceCandidate(message.candidate));
    });

    serverSocket.on('initiator ICE', function(message) {
        logTraceConsole('got accept ICE from initiator');
        targetConn.addIceCandidate(new RTCIceCandidate(message));
    });

    // First we need to setup a peer connection
    // Reference: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection
    targetConn = new RTCPeerConnection(iceConfiguration);

    targetConn.onicecandidate = function (message) {
        logTraceConsole('ICE candidate from initiator');
        if (message.candidate) {
            serverSocket.emit('target ICE', message.candidate);
        }
    };

    // If the server asks us to initiate the data connection, oblige.
    targetConn.onnegotiationneeded = function () {
        logTraceConsole('Negotiation requested');
    };

    // Setup the target side of a data channel (initiator will create data channel)
    targetConn.ondatachannel = function (message) {
        logTraceConsole('Receiving channel');
        targetChannel = message.channel;
        // See: https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel
        targetChannel.onmessage = function (message) {
            logTraceConsole('Target received message: ' + message.data);
            logSignalConsole(message.data);
        }
        targetChannel.onopen = function () {
            logTraceConsole('Target state: ' + targetChannel.readyState);
            logNativeConsole('Channel open');
            targetChannel.send('hello from the target');
        }
        targetChannel.onclose = function () {
            logTraceConsole('Target state: ' + targetChannel.readyState);
        }
    }
}

processQuery(window.location.search);
