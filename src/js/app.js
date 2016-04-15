var $ = require('jQuery');

var simon = (function(){

  // default values
  var maxTone = 500;
  var minTone = 250;
  var badTone = 100;
  var buttonSaturation = "60%";
  var buttonLightness = "50%";
  var gapDegrees = 4;

  //gameplay vars
  var seq = [0,1,2];
  var buttonCount = 4;
  var strictMode = false;
  var userTurn = true;

  // cache dom handles
  var $simon = $('#simon');
  var $btnsContainer = $simon.find('.buttonsContainer');
  $btnsContainer.html('buttons container found!');
  var $btns;



  // set up audio
  var audioContext = window.AudioContext || window.webkitAudioContext;
  if (!audioContext){  alert("try Chrome, Firefox, or Safari to play this game with sound"); }
  else {
    var audioCtx = new audioContext();
    var oscillator = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0.3;
    oscillator.type = 'square';
  }


  function generateButtons(){
    $btnsContainer.empty();
    var hueSpan      = Math.floor( 360 / buttonCount );
    var hueSeed      = Math.floor( hueSpan * Math.random() );
    hueSeed = 0;  // shifting colors makes the game too hard
    var toneSpan     = Math.floor( (maxTone-minTone) / buttonCount );
    var positionSpan = 360 / buttonCount;
    for (let i=0; i<buttonCount; i++){
      let btnHue      = ( hueSeed + i * hueSpan ) % 360;
      let btnTone     = minTone + i * toneSpan;
      let btnPosition = 0.1 * Math.floor( 10 * i * positionSpan + (gapDegrees/2) );
      addButton(i, btnHue, btnTone, btnPosition, positionSpan);
    }
  }


  function addButton(i, hue, tone, position, positionSpan){
    var outerTransform = 'translate(100%,0) rotate(' + position + 'deg)';
    var innerTransform = 'rotate(' + Math.ceil(positionSpan-gapDegrees-180) + 'deg)';
    var bgColor = 'hsl(' + hue + ', ' + buttonSaturation + ', ' + buttonLightness + ')';
    var $btn = $('<div/>', { 'class':'btnTarget', 'css':{'background-color':bgColor}, 'text':'this is a button'});
    $btn.bind('mousedown', {id:i, tone:tone }, userPress);
    $btnsContainer.append(
      $('<div/>', { 'class':'btnOuter', 'css':{'transform':outerTransform} }).append(
        $('<div/>', { 'class':'btnInner', 'css':{'transform':innerTransform} }).append( $btn )
      )
    );
  }

  function userPress (event) {
    if(userTurn){
      if ( event.data.id == seq[0] ){
        userPressCorrect(event);
      } else {
        userPressIncorrect(event);
      }
    }
  }

  function startSound(tone, shape = 'square'){
    if(audioContext){
      oscillator = audioCtx.createOscillator();
      oscillator.connect(gainNode);
      oscillator.frequency.value = tone;
      oscillator.type = shape;
      oscillator.start();
    }
  }

  function userPressCorrect (event) {
    if(audioContext){
      oscillator = audioCtx.createOscillator();
      oscillator.connect(gainNode);
      oscillator.frequency.value = event.data.tone;
      oscillator.type = square;
      oscillator.start();
    }
    $(event.target).addClass('pressed').bind('mouseup mouseleave', userRelease);
  }

  function userPressIncorrect (event) {
    // negative feedback
    startSound(badTone, 'sawtooth');
    $(event.target).addClass('wrong').bind('mouseup mouseleave', userRelease);


  }

  function userRelease (event) {
    if(audioContext){
      oscillator.stop();
      oscillator.disconnect();
      $(event.target).removeClass('pressed wrong');
    }
  }

  function resetGameplay () {

  }

  function playSeq(){}


  generateButtons();


})();
