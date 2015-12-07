"use strict"

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = 1979;

http.listen(port);

function assert(condition, message) {
    if (!condition) {
        message = message || "assert";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
    }
}

var PeerGroup = function(groupName) {
    this.name = groupName;
    this.peers = {}
    this.initiatorID = null;
};

PeerGroup.prototype.electInitiator = function() {
    var peerIDs = Object.keys(this.peers);
    assert(peerIDs.length >= 1, 'no initiator to elect');
    return peerIDs[0];
};

PeerGroup.prototype.initiatorChanged = function() {
    if (this.initiatorID != this.electInitiator()) {
        this.initiatorID = this.electInitiator();
        console.log(this.initiatorID + ' is the initiator');
        return true;
    }
    return false;
};

PeerGroup.prototype.getTargetIDs = function () {
    var peerIDs = Object.keys(this.peers);
    assert(peerIDs.length >= 1, 'no known targets');
    peerIDs.shift();
    return peerIDs;
};

PeerGroup.prototype.sendPeerMessage = function (peerID, event, message) {
    assert(this.peers.hasOwnProperty(peerID), 'unknown peerID ' + peerID);
    this.peers[peerID].emit(event, message);
};

PeerGroup.prototype.sendInitiatorMessage = function (event, message) {
    this.sendPeerMessage(this.initiatorID, event, message);
};

PeerGroup.prototype.addPeer = function(peerID, socket) {
    assert(!this.peers.hasOwnProperty(peerID), 'peerID ' + peerID + ' already exists');
    this.peers[peerID] = socket;
    if (this.initiatorChanged()) {
        var initiatorSocket = this.peers[this.initiatorID];
        initiatorSocket.emit('initiate peers', this.getTargetIDs());
    } else {
        // FIXME: add a single peer
        var initiatorSocket = this.peers[this.initiatorID];
        initiatorSocket.emit('initiate peers', this.getTargetIDs());
    }
};

PeerGroup.prototype.removePeer = function(peerID) {
    assert(this.peers.hasOwnProperty(peerID), 'unknown peerID' + peerID);
    delete this.peers[peerID];
    if (Object.keys(this.peers).length == 0) {
        this.initiatorID = null;
    } else if (this.initiatorChanged()) {
        // FIXME: old initiator must have disconnected... how to make this more obvious?
        var initiatorSocket = this.peers[this.initiatorID];
        initiatorSocket.emit('signal peers', this.getTargetIDs());
    } else {
        //FIXME: remove a single peer
        var initiatorSocket = this.peers[this.initiatorID];
        initiatorSocket.emit('initiate peers', this.getTargetIDs());
    }
};

var peerGroup = new PeerGroup('default');

// Javascript is single-threaded and everything we are doing is blocking
// (including the call to updatePeers). This obviously won't scale.
io.on('connection', function(socket) {
    console.log('user ' + socket.id + ' connected');

    socket.on('disconnect', function() {
        console.log('user ' + socket.id + ' disconnected');
        peerGroup.removePeer(socket.id, socket);
    });

    socket.on('initiate connection', function(message) {
        console.log('user ' + socket.id + ' initiating connection with ' + message.peer);
        peerGroup.sendPeerMessage(message.peer, 'offer connection', message.session);
    });

    socket.on('answer connection', function(session) {
        console.log('user ' + socket.id + ' answered connection request from initiator');
        var message = new Object;
        message.peer = socket.id;
        message.session = session;
        peerGroup.sendInitiatorMessage('complete connection', message);
    });

    socket.on('target ICE', function(candidate) {
        console.log('user ' + socket.id + ' accepted ICE candidate from initiator');
        var message = new Object;
        message.peer = socket.id;
        message.candidate = candidate;
        peerGroup.sendInitiatorMessage('target accepted ICE', message);
    });

    socket.on('initiator ICE', function(message) {
        console.log('user ' + socket.id + ' accepted ICE candidate from ' + message.peer);
        peerGroup.sendPeerMessage(message.peer, 'initiator accepted ICE', message.candidate);
    });

    peerGroup.addPeer(socket.id, socket);
});
