//Add Event Listeners
document.getElementById("startTone").addEventListener("click", startTone);
document.getElementById("stopTone").addEventListener("click", stopTone);
document.getElementById("signalInputSubmit").addEventListener("click", signalServer);

function logAppConsole(message) {
    document.getElementById("appConsole").innerHTML = message;
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
    delete oscillator;

    logAppConsole('tone stopped');
}

function signalServer() {
    var input = document.getElementById("signalInput").value;
    if (input.length === 0) {
        alert("Please specify a valid hostname and port");
        return;
    }

    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            document.getElementById("signalConsole").innerHTML = xmlHttp.responseText;
            //callback(xmlHttp.responseText);
        }
    }
    xmlHttp.open("GET", input, true); // true for asynchronous
    xmlHttp.send(null);
//    document.getElementById("signalConsole").innerHTML = input;
}
