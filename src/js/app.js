var $ = require('jQuery');

var simon = (function(){

  // default values
  const maxTone = 500;
  const minTone = 250;
  const badTone = 100;
  const buttonSaturation = "40%";
  const buttonLightness = "50%";
  const gapPercent = 0.3;
  const toneTime = 500;
  const toneGap = 100;
  const userTimeBase = 4000;
  const userTimePerMove = 2000;
  const minDifficulty = 2;
  const maxDifficulty = 12;
  const movesToWin = 20;

  //gameplay internal vars
  var seq = [];
  var buttonCount = 0;
  var isUserTurn = false;
  var userMove = 0;
  var buttons = [];
  var turnTimer;
  var timeAllowed;
  var turnStartTime;
  var best = 0;

  //
  if (document.documentElement.style.pointerEvents !== '')  {
    document.getElementById('psiControls').innerHTML =  "<br>sorry,<br>"+
      "this browser lacks a feature<br>" +
      "required by psimon<br><br>";
  }

  // cache dom handles
  var $simon = $('#simon');
  var $board = $simon.find('.board');
  var $btnsContainer = $simon.find('.buttonsContainer');
  var $controls = $simon.find('.controls');
  var $startBtn = $simon.find('#psiStart');
  var $resetBtn = $simon.find('#psiReset');
  var $difficulty = $simon.find('#psiDifficulty');
  var $strictIn = $simon.find('#psiStrictness');
  var $difficultyBtns = $simon.find('.difficulty .stepper');
  var $difficultyPlus = $difficultyBtns.filter('.plus');
  var $difficultyMinus = $difficultyBtns.filter('.minus');
  var $msg = $simon.find('.readout');
  var $timer = $simon.find('.timer');
  var $stats = $simon.find('.stats');



  // enable controls
  $startBtn.click(startGame);
  $resetBtn.click(resetGameplay);
  $difficultyBtns.click(incrementDifficulty);


  //  ######  GAMEPLAY FUNCTIONS  ########

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

  function incrementDifficulty(event){
    var currDiff = $difficulty.data('difficulty');
    var direction = event.target.value;
    var newDiff = currDiff;
    if (direction == 'plus'){
      $difficultyMinus.prop('disabled',false);
      newDiff++;
    } else if (direction == 'minus') {
      $difficultyPlus.prop('disabled',false);
      newDiff--;
    }
    if ( newDiff >= maxDifficulty || newDiff <= minDifficulty ) { event.target.disabled = true; }
    $difficulty.data('difficulty',newDiff).text(newDiff);
  }


  function generateButtons(){
    $btnsContainer.find('.btnTarget').fadeOut(200);
    $btnsContainer.empty();
    buttons.length = 0;
    var hueSpan      = Math.floor( 360 / buttonCount );
    var hueSeed      = Math.floor( hueSpan * Math.random() );
    //hueSeed = 0;  // use if shifting colors makes the game too hard
    var toneSpan     = Math.floor( (maxTone-minTone) / buttonCount );
    var positionSpan = 360 / buttonCount;
    for (let i=0; i<buttonCount; i++){
      let btnHue      = ( hueSeed + i * hueSpan ) % 360;
      let btnTone     = minTone + i * toneSpan;
      let btnPosition = 0.1 * Math.floor( 10 * (i*positionSpan) );
      addButton(i, btnHue, btnTone, btnPosition, positionSpan);
    }
    $btnsContainer.find('.btnTarget').fadeIn(600);
    $board.css('border-color','transparent');
  }


  function addButton(i, hue, tone, position, positionSpan){
    var outerTransform =  'translateX(100%) rotate(' + position + 'deg) '+
                          'translateX(' + gapPercent +'%)';
    var innerTransform =  'translateX(-' + gapPercent +'%) '+
                          'rotate(' + 0.1 * Math.ceil(10*(positionSpan-180)) + 'deg) '+
                          'translateX(' + gapPercent +'%)';
    var bgColor = 'hsl(' + hue + ', ' + buttonSaturation + ', ' + buttonLightness + ')';
    buttons[i] = {
      tone: tone,
      hue: hue,
      $el: $('<div/>', {
        'class':'btnTarget',
        'css':{
          'background-color':bgColor,
          'display':'none',
          'left':(-100 - gapPercent) + '%'
        }
      })
    };
    buttons[i].$el.bind('mousedown touchstart', {id:i}, userPress);
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
        cancelAnimationFrame(turnTimer);
      }
      if ( id == seq[userMove] ){
        userPressCorrect(event, id);
      } else {
        userPressIncorrect(event, id);
      }
    }
    return false;
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
                   .bind('mouseup mouseleave touchend', userReleaseCorrect);
    userMove++;
  }

  function userPressIncorrect (event, id) {
    startSound(badTone, 'sawtooth');
    if(window.navigator.vibrate) {
      window.navigator.vibrate(5000);
    }
    buttons[id].$el.addClass('wrong')
                   .bind('mouseup mouseleave touchend', userReleaseIncorrect);
  }

  function userReleaseCorrect (event) {
    stopSound();
    $(event.target).removeClass('pressed')
                   .off('mouseup mouseleave touchend');
    if (userMove === seq.length) {
      if (seq.length > best) {
        updateHighScore(seq.length);
      }
      if (seq.length === movesToWin){
        resetGameplay('WINNER!!');
      } else {
        endUserTurn();
        setTimeout(startNextLevel, 500);
      }
    }
    return false;
  }

  function updateHighScore(newHigh){
    $stats.html("high score: <span class='num'>"+newHigh+"</span>");
    best=newHigh;
    $stats.fadeIn(500);
  }

  function userReleaseIncorrect (event) {
    stopSound();
    if(window.navigator.vibrate){
      window.navigator.vibrate(0);
    }
    $(event.target).removeClass('wrong')
                   .off('mouseup mouseleave touchend');
    if ( $strictIn.prop('checked') ) {  //srict mode, end game
      resetGameplay('game over');
    } else {  // replay this level's sequence
      endUserTurn();
      $msg.text('try again');
      setTimeout(showMove, 2000, 0);
    }
    return false;
  }

  function endUserTurn() {
    cancelAnimationFrame(turnTimer);
    $timer.css('width',"100%").removeClass('urgent');
    isUserTurn = false;
    $controls.removeClass('userTurn');
  }

  function startNextLevel() {
    var nextMove = Math.floor( buttonCount * Math.random() );
    seq.push(nextMove);
    $msg.text('Level '+seq.length).fadeIn(500);
    showMove(0);
  }

  function resetGameplay (msg) {
    if(isUserTurn){  // to avoid pending timouts
      endUserTurn();
      $controls.removeClass('playing');
      var message = (typeof msg === 'string') ? msg : 'click start to play again';
      $msg.text(message);
      seq.length = 0;
    }
  }

  function showMove(move){
    if (move >= seq.length) {
      startUserTurn();
    }  else {
      var btnID = seq[move];
      buttons[btnID].$el.addClass('indicate');
      startSound(buttons[btnID].tone);
      setTimeout(showNextMove, toneTime, move+1, btnID);
    }
  }

  function showNextMove(nextMove, lastBtnID) {
    stopSound();
    buttons[lastBtnID].$el.removeClass('indicate');
    setTimeout(showMove, toneGap, nextMove);
  }

  function startUserTurn(){
    timeAllowed = userTimeBase + userTimePerMove * seq.length;
    turnStartTime = null;
    turnTimer = requestAnimationFrame(updateUserTime);
    isUserTurn = true;
    userMove = 0;
    $controls.addClass('userTurn');
  }

  function updateUserTime(timestamp){
    if (!turnStartTime) { turnStartTime = timestamp; }
    var timeLeft = timeAllowed - (timestamp - turnStartTime);
    if (timeLeft > 0) {
      var pctLeft =  0.1 * Math.floor( 10 * 100 * timeLeft / timeAllowed );
      $timer.css('width',pctLeft+"%");
      if (timeLeft <= 3000) {
        $timer.addClass('urgent');
      }
      turnTimer = requestAnimationFrame(updateUserTime);
    }
    else {
      timeUp();
    }
  }

  function timeUp(){
    startSound(badTone, 'sawtooth');
    setTimeout(stopSound, 800);
    $timer.removeClass('urgent');
    if ( $strictIn.prop('checked') ) {  //srict mode, end game
      resetGameplay('time is up, game over');
    } else {  // replay this level's sequence
      $msg.text('time is up, try again');
      endUserTurn();
      setTimeout(showMove, 1000, 0);
    }
  }

  function startGame(){
    $controls.addClass('playing');
    var newButtonCount = $difficulty.data('difficulty');
    if(newButtonCount != buttonCount){
      buttonCount = newButtonCount;
      generateButtons();
    }
    setTimeout(startNextLevel, 1000);
  }


  $controls.fadeIn(1000);
  $msg.fadeIn(1000);

})();
