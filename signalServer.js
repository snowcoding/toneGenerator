var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = 1979;

http.listen(port);

var sockets = new Map();

function updatePeers() {
    sockets.forEach (function(socket, id, map) {
        peers = [];
        for (var key of sockets.keys()) {
            if (key == id) {
                continue;
            }
            peers.push(key);
        }
        socket.emit('server msg', 'signal peers: ' + peers);
    });
}

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
    updatePeers();
});
