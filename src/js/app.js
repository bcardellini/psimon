var $ = require('jQuery');

var simon = (function(){

  // default values
  var maxTone = 500;
  var minTone = 250;
  var badTone = 100;
  var buttonSaturation = "60%";
  var buttonLightness = "50%";
  var gapDegrees = 6;
  var toneTime = 500;
  var toneGap = 100;
  var userTimeBase = 3000;
  var userTimePerMove = 3000;
  var timeUpdateFreq = 10; //Hz
  var movesToWin = 20;
  var strictMode = false;

  //gameplay internal vars
  var seq = [];
  var buttonCount = 0;
  var isUserTurn = false;
  var userMove = 0;
  var buttons = [];
  var turnTimer;
  var timeAllowed;
  var timeLeft;
  var best = 0;

  // cache dom handles
  var $simon = $('#simon');
  var $btnsContainer = $simon.find('.buttonsContainer');
  var $controls = $simon.find('.controls');
  var $startBtn = $simon.find('#psiStart');
  var $resetBtn = $simon.find('#psiReset');
  var $difficultyIn = $simon.find('#psiDifficulty');
  var $levelOut = $simon.find('#psiLevel');
  var $strictIn = $simon.find('#psiStrictness');
  var $msg = $simon.find('.messages');
  var $timer = $simon.find('.timer');
  var $stats = $simon.find('.stats');

  // enable controls
  $startBtn.click(startGame);
  $resetBtn.click(resetGameplay);

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
    $btnsContainer.find('.btnTarget').fadeOut(200);
    $btnsContainer.empty();
    buttons.length = 0;
    var hueSpan      = Math.floor( 360 / buttonCount );
    var hueSeed      = Math.floor( hueSpan * Math.random() );
    //hueSeed = 0;  // shifting colors makes the game too hard
    var toneSpan     = Math.floor( (maxTone-minTone) / buttonCount );
    var positionSpan = 360 / buttonCount;
    for (let i=0; i<buttonCount; i++){
      let btnHue      = ( hueSeed + i * hueSpan ) % 360;
      let btnTone     = minTone + i * toneSpan;
      let btnPosition = 0.1 * Math.floor( 10 * (i*positionSpan+(gapDegrees/2)) );
      addButton(i, btnHue, btnTone, btnPosition, positionSpan);
    }
    $btnsContainer.find('.btnTarget').fadeIn(600);
  }


  function addButton(i, hue, tone, position, positionSpan){
    var outerTransform = 'translate(100%,0) rotate(' + position + 'deg)';
    var innerTransform = 'rotate(' + Math.ceil(positionSpan-gapDegrees-180) + 'deg)';
    var bgColor = 'hsl(' + hue + ', ' + buttonSaturation + ', ' + buttonLightness + ')';
    //var $btn = $('<div/>', { 'class':'btnTarget', 'css':{'background-color':bgColor} });
    buttons[i] = {
      tone: tone,
      $el: $('<div/>', { 'class':'btnTarget', 'css':{'background-color':bgColor, 'display':'none'} })
    };
    //$btn.bind('mousedown', {id:i}, userPress);
    buttons[i].$el.bind('mousedown', {id:i}, userPress);
    $btnsContainer.append(
      $('<div/>', { 'class':'btnOuter', 'css':{'transform':outerTransform} }).append(
        $('<div/>', { 'class':'btnInner', 'css':{'transform':innerTransform} }).append( buttons[i].$el )
      )
    );
  }

  function userPress (event) {
    if(isUserTurn){
      var id = event.data.id;
      if ( userMove === seq.length-1 ){
        clearInterval(turnTimer);
      }
      if ( id == seq[userMove] ){
        userPressCorrect(event, id);
      } else {
        userPressIncorrect(event, id);
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

  function stopSound() {
    if(audioContext){
      oscillator.stop();
      oscillator.disconnect();
    }
  }

  function userPressCorrect (event, id) {
    startSound(buttons[id].tone);
    buttons[id].$el.addClass('pressed')
                   .bind('mouseup mouseleave', userReleaseCorrect);
    userMove++;
  }

  function userPressIncorrect (event, id) {
    // negative feedback
    startSound(badTone, 'sawtooth');
    buttons[id].$el.addClass('wrong')
                   .bind('mouseup mouseleave', userReleaseIncorrect);
  }

  function userReleaseCorrect (event) {
    stopSound();
    $(event.target).removeClass('pressed')
                   .off('mouseup mouseleave');
    if (userMove === seq.length) {
      if (seq.length > best) {
        best = seq.length;
        $stats.text("high score: "+best);
        $stats.fadeIn(500);
      }
      if (seq.length === movesToWin){
        win();
      } else {
        endUserTurn();
        setTimeout(startNextLevel, 500);
      }
    }
  }

  function userReleaseIncorrect (event) {
    stopSound();
    $(event.target).removeClass('wrong')
                   .off('mouseup mouseleave');
    if ( $strictIn.prop('checked') ) {  //srict mode, end game
      $msg.text('game over').css('display','block').fadeOut(4000);
      resetGameplay();
    } else {  // replay this level's sequence
      endUserTurn();
      $msg.text('try again').css('display','block').fadeOut(2000);
      setTimeout(showMove, 1000, 0);
    }
  }

  function win() {
    $msg.text('winner!!').css('display','block').fadeOut(5000);
    resetGameplay();
  }

  function endUserTurn() {
    console.log('ending user turn');
    clearInterval(turnTimer);
    $timer.css('width',"100%").removeClass('urgent');
    isUserTurn = false;
    $controls.removeClass('userTurn');
  }

  function startNextLevel() {
    var nextMove = Math.floor( buttonCount * Math.random() );
    seq.push(nextMove);
    $levelOut.text(seq.length);
    showMove(0);
  }

  function resetGameplay () {
    if(isUserTurn){  // to avoid pending timouts
      endUserTurn();
      $controls.removeClass('playing');
      $levelOut.text('1');
      seq.length = 0;
    }
  }

  function showMove(move){
    if (move >= seq.length) {
      startUserTurn();
    }  else {
      //play sound
      btnID = seq[move];
      startSound(buttons[btnID].tone);
      buttons[btnID].$el.addClass('indicate');
      setTimeout(showNextMove, toneTime, move+1);
    }
  }

  function showNextMove(move) {
    stopSound();
    buttons[btnID].$el.removeClass('indicate');
    setTimeout(showMove, toneGap, move);
  }

  function startUserTurn(){
    timeAllowed = userTimeBase + userTimePerMove * seq.length;
    timeLeft = timeAllowed;
    turnTimer = setInterval(updateUserTime,1000/timeUpdateFreq);
    isUserTurn = true;
    userMove = 0;
    $controls.addClass('userTurn');
  }

  function updateUserTime(){
    timeLeft -= 1000/timeUpdateFreq;
    var pctLeft = 0.1 * Math.floor( 10 * 100 * timeLeft / timeAllowed );
    $timer.css('width',pctLeft+"%");
    if (timeLeft <= 3000) {
      $timer.addClass('urgent');
    }
    if (timeLeft <= 0){
      clearInterval(turnTimer);
      $timer.removeClass('urgent');
      if ( $strictIn.prop('checked') ) {  //srict mode, end game
        $msg.text('time is up \n game over').css('display','block').fadeOut(4000);
        resetGameplay();
      } else {  // replay this level's sequence
        $msg.text('time is up \n try again').css('display','block').fadeOut(2000);
        endUserTurn();
        setTimeout(showMove, 1000, 0);
      }

    }
  }

  function startGame(){
    $controls.addClass('playing');
    var newButtonCount = $difficultyIn.val();
    if(newButtonCount != buttonCount){
      buttonCount = newButtonCount;
      generateButtons();
    }
    setTimeout(startNextLevel, 1000);
  }



})();
