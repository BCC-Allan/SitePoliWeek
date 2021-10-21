import "./style.css";

import $ from "jquery";
// export for others scripts to use
window.$ = $;

function addButtonBindings(idFunctionMap) {
  for (const [key, value] of Object.entries(idFunctionMap)) {
    $(key).on("click", value);
  }
}


$(window).on("load", function () {
  const buttonMap = {
    "#promptButton": startPlaying,
    "#target": find,
    '#lost': giveUp,
    '#mute': toggleMute,
    '#instructions': viewInstructions,
  };
  addButtonBindings(buttonMap);
});


var AudioContext;
var audioCtx;
var audioElement;
var track;
var gainNode;
var pannerOptions;
var panner;

// check WebAudio support
try {
  AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();
  audioElement = document.querySelector("audio");
  track = audioCtx.createMediaElementSource(audioElement);
  gainNode = audioCtx.createGain();
  pannerOptions = { pan: 0 };
  panner = new StereoPannerNode(audioCtx, pannerOptions);
} catch (e) {
  alert("Sorry, your browser does not support the Web Audio API");
}

// Mouse coordinates since I always want access to these outside of the context of events.
var mouseX = 0;
var mouseY = 0;
// global states
var cocogoatFound = false;
var audioMuted = false;
var easyMode = true;
var gameStarted = false; // allows finding of cocogoat and governs instruction behavior

//helper functions for finding distances (used when adjusting audio)
//calculates distance between a given point (in this case the cursor) and the center of an element
//use Math.ceil so value will never be 0 to avoid divide by zero errors
function calculateDistance(elem, mouseX, mouseY) {
  return Math.ceil(
    Math.sqrt(
      Math.pow(mouseX - (elem.offsetLeft + elem.clientWidth / 2), 2) +
        Math.pow(mouseY - (elem.offsetTop + elem.clientHeight / 2), 2)
    )
  );
}

function calculateXDistance(elem, mouseX, mouseY) {
  return Math.ceil(mouseX - (elem.offsetLeft + elem.clientWidth / 2));
}

// hides cocogoat and moves to random location. Runs once when user begins, and after each time cocogoat is found.
function hide() {
  //hide cocogoat
  document.getElementById("target").style.opacity = 0;
  //resize cocogoat
  var cocogoatSize =
    1.8 *
    0.071 *
    Math.sqrt(
      document.getElementById("space").clientHeight *
        document.getElementById("space").clientWidth
    );
  document.getElementById("target").style.clientHeight = cocogoatSize + "px";
  //resize empty div covering cocogoat
  document.getElementById("cover").style.clientHeight = cocogoatSize + "px";
  document.getElementById("cover").style.clientWidth = cocogoatSize + "px";
  //move cocogoat to random location
  var x = Math.floor(
    Math.random() *
      (document.getElementById("space").clientWidth - cocogoatSize)
  );
  var y = Math.floor(
    Math.random() *
      (document.getElementById("space").clientHeight - cocogoatSize)
  );
  document.getElementById("target").style.marginLeft = x + "px";
  document.getElementById("target").style.marginTop = y + "px";
  document.getElementById("cover").style.marginLeft = x + "px";
  document.getElementById("cover").style.marginTop = y + "px";
  //keep track of whether user has found cocogoat
  cocogoatFound = false;
  //start playing hint audio
  playHint();
}

//reveals cocogoat, increments cocogoat counter. Activated when cover is clicked.
function find() {
  console.log("agui");
  //prevent from running multiple times if the user clicks more than once
  if (!cocogoatFound && gameStarted) {
    //prevent hint audio from playing
    cocogoatFound = true;
    //increment cocogoat counter if localstorage exists.
    if (typeof Storage !== "undefined") {
      if (
        !isNaN(localStorage.getItem("cocogoatCount")) &&
        localStorage.getItem("cocogoatCount")
      ) {
        //if number is stored, increment count.
        localStorage.setItem(
          "cocogoatCount",
          Number(localStorage.getItem("cocogoatCount")) + 1
        );
      }
    }
    //make cocogoat visible for a moment
    document.getElementById("target").style.visibility = "visible";
    document.getElementById("target").style.opacity = 1;
    //re-hide cocogoat after a delay
    setTimeout(hide, 2000);
    //increment and update cocogoat counter
    updateNumberOfCocogoatsFound();
  }
}

//always running in the background, playing audio hints. Doesn't play if cocogoat is found.
function playHint() {
  //set volume to a value inversely proportional to the distance between the cursor and cocogoat, up to a maximum volume.
  if (!audioMuted) {
    gainNode.gain.value = Math.min(
      1,
      70 /
        calculateDistance(document.getElementById("target"), mouseX, mouseY)
    );
  }
  //set stereo pan based on whether cocogoat is left or right of the cursor position, scaled by width of window
  //use square root to make pan effect more significant near the target. Requires workaround to return proper negative values.
  let xDistance = calculateXDistance(
    document.getElementById("target"),
    mouseX,
    mouseY
  );
  panner.pan.value =
    -1 *
    Math.sign(xDistance) *
    Math.sqrt(
      Math.abs(xDistance) / document.getElementById("space").clientWidth
    );
  //if user has not found cocogoat, play the sound. An event listener elsewhere will loop this function.
  if (!cocogoatFound) {
    audioElement.play();
  }
}

//saves mouse position to a global variable because mouse coords are only accessible through events and
//I don't know a better way to handle this.
function handleMouseMove(event) {
  mouseX = event.pageX;
  mouseY = event.pageY;
}

//function that starts the game and hides the start button, used when start button is clicked.
function startPlaying() {
  document.getElementById("promptButton").style.visibility = "hidden";
  document.getElementById("lost").style.visibility = "visible";
  document.getElementById("instructions").style.visibility = "visible";
  document.getElementById("counter").style.visibility = "visible";
  //have to resume audio context for chrome compatibility
  audioCtx.resume();
  console.log("AudioContext started with user interaction.");
  gameStarted = true;
  hide();
}

//when the user clicks give up, make cocogoat somewhat visible but do not actually "find" until they click cocogoat.
function giveUp() {
  document.getElementById("target").style.visibility = "visible";
  document.getElementById("target").style.opacity = 0.15;
}

//lets the user mute audio. Visually updates mute button.
function toggleMute() {
  audioMuted = !audioMuted;
  if (audioMuted) {
    gainNode.gain.value = 0;
    document.getElementById("mute").textContent = "Unmute";
    document.getElementById("mute").style.color = "Crimson";
  } else {
    document.getElementById("mute").textContent = "Mute";
    document.getElementById("mute").style.color = "MediumSlateBlue";
  }
}

//toggles easy mode: in easy mode the cursor style changes when hovering over invisible cocogoat
function toggleCursor() {
  easyMode = !easyMode;
  if (easyMode) {
    document.getElementById("cover").style.cursor = "pointer";
    document.getElementById("easy").textContent = "Desabilitar Modo Fácil";
    document.getElementById("easy").style.color = "Crimson";
  } else {
    document.getElementById("cover").style.cursor = "default";
    document.getElementById("easy").textContent = "Habilitar Modo Fácil";
    document.getElementById("easy").style.color = "MediumSlateBlue";
  }
}

//when instruction button clicked, open promptButton with full instructions.
//promptButton already closes onclick, but also close it if the user clicks the instruction button again.
function viewInstructions() {
  //if the prompt is visible, close the prompt
  if (document.getElementById("promptButton").style.visibility == "visible") {
    document.getElementById("promptButton").style.visibility = "hidden";
  } else {
    let instructions =
      'Há um João das Neves invisível escondido na página. O objetivo é clicar no João das Neves invisível. <br> <br> As pistas de áudio ficam mais altas à medida que o cursor do mouse se aproxima do João das Neves. O som virá da direção onde o João das Neves está, em relação ao cursor. <br> <br> Quando o João das Neves for encontrado, ele será movido para uma posição aleatória e oculto novamente após um pequeno atraso. <br> <br> Habilitar o Modo Fácil faz com que o cursor mude ao passar o mouse sobre o João das Neves. <br> <br> Clique em "Desistir" se você aceita que foi derrotado pelo do João das Neves.';
    document.getElementById("promptButton").innerHTML = instructions;
    document.getElementById("promptButton").style.visibility = "visible";
    document.getElementById("promptButton").style.fontSize = "1.2em";
  }
}

//updates cocogoat counter to match stored value. Runs when page starts and when cocogoat is found.
function updateNumberOfCocogoatsFound() {
  if (typeof Storage !== "undefined") {
    //check if localstorage exists, and check if there is a number stored
    if (
      !isNaN(localStorage.getItem("cocogoatCount")) &&
      localStorage.getItem("cocogoatCount")
    ) {
      //if number is stored, set counter to match.
      document.getElementById("counter").textContent =
        "Joães das Neves Encontrados: " + Number(localStorage.getItem("cocogoatCount"));
    } else {
      //if no number is stored, set counter to 0
      localStorage.setItem("cocogoatCount", 0);
      document.getElementById("counter").textContent = "Cocogoats found: 0";
    }
  } else {
    //the user doesn't need to know about the useless number they're missing out on. Hide the cocogoat counter.
    document.getElementById("counter").style.visibility = "hidden";
  }
}

//check if user has previously found cocogoats, update banner (runs at page start).
updateNumberOfCocogoatsFound();
//set up audio path
track.connect(panner).connect(gainNode).connect(audioCtx.destination);
//whenever hint audio finishes, play more hint audio (effectively loop the hint).
audioElement.addEventListener("ended", playHint);
//always be tracking where the mouse is because apparently there's no way to do this without events
document.getElementById("space").addEventListener("mousemove", handleMouseMove);
