var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = 1979;

http.listen(port);

var sockets = new Map();

io.on('connection', function(socket) {
    console.log('a user connected with id: ' + socket.id);

    peers = [];
    for (var id of sockets.keys()) {
        peers.push(id);
    }
    socket.emit('server msg', 'signal peers: ' + peers);

    sockets.set(socket.id, socket);

    socket.on('disconnect', function() {
        console.log('user disconnected');
        sockets.delete(socket.id);

        sockets.forEach (function(peer, id, map) {
            peers = [];
            for (var key of sockets.keys()) {
                if (key == id) {
                    continue;
                }
                peers.push(key);
            }
            peer.emit('server msg', 'signal peers: ' + peers);
        });
    });
});
