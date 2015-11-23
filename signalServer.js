var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = 1979;

http.listen(port);

var sockets = new Map();
var initiatorID = 0;

function updatePeers() {
    var initiator = true;
    sockets.forEach( function(socket, id, map) {
        peers = [];
        for (var key of sockets.keys()) {
            if (key == id) {
                continue;
            }
            peers.push(key);
        }

        // Whomever we find first will run the show. Maps are ordered
        // so the only way we will change our minds is if the current
        // initiator disconnects.
        if (initiator) {
            console.log('user ' + socket.id + ' is the initiator');
            socket.emit('initiate peers', JSON.stringify(peers));
            initiator = false;
            initiatorID = socket.id;
        } else {
            socket.emit('signal peers', JSON.stringify(peers));
        }
    });
}

// Javascript is single-threaded and everything we are doing is blocking
// (including the call to updatePeers). This obviously won't scale.
io.on('connection', function(socket) {
    console.log('user ' + socket.id + ' connected');

    peers = [];
    for (var id of sockets.keys()) {
        peers.push(id);
    }

    sockets.set(socket.id, socket);

    socket.on('disconnect', function() {
        console.log('user ' + socket.id + ' disconnected');
        sockets.delete(socket.id);
        updatePeers();
    });

    socket.on('initiate connection', function(message) {
        message = JSON.parse(message);
        console.log('user ' + socket.id + ' initiating connection with ' + message.peer);
        sockets.get(message.peer).emit('offer connection', message.session);
    });

    socket.on('answer connection', function(session) {
        console.log('user ' + socket.id + ' answered connection request from ' + initiatorID);
        var message = new Object;
        message.peer = socket.id;
        message.session = session;
        sockets.get(initiatorID).emit('complete connection', JSON.stringify(message));
    });

    socket.on('target ICE', function(candidate) {
        console.log('user ' + socket.id + ' accepted ICE candidate from ' + initiatorID);
        var message = new Object;
        message.peer = socket.id;
        message.candidate = candidate;
        sockets.get(initiatorID).emit('target accepted ICE', JSON.stringify(message));
    });

    socket.on('initiator ICE', function(message) {
        message = JSON.parse(message);
        console.log('user ' + socket.id + ' accepted ICE candidate from ' + message.peer);
        sockets.get(message.peer).emit('initiator accepted ICE', message.candidate);
    });

    updatePeers();
});
