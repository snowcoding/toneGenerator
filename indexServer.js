"use strict"

// Simple web server to provide index.html to other clients on the network
var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var path = require('path');
var port = 1988;

// viewed at http://localhost:port
app.use(express.static('.'));

app.listen(1988);
