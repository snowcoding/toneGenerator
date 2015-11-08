//Add Event Listeners
document.getElementById("startTone").addEventListener("click", startTone);
document.getElementById("stopTone").addEventListener("click", stopTone);

//Basic start/stop functions
function startTone() {
    if (typeof oscillator !== 'undefined') {
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
}

function stopTone() {
    if (typeof oscillator === 'undefined') {
        return;
    }

    oscillator.stop();
    oscillator.disconnect();
    delete oscillator;
}
