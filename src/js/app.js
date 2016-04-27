var $ = require('jQuery');

var simon = (function(){

  // default values
  var maxTone = 500;
  var minTone = 250;
  var badTone = 100;
  var buttonSaturation = "40%";
  var buttonLightness = "50%";
  var gapDegrees = 6;
  var gapPercent = 0.3;
  var toneTime = 500;
  var toneGap = 100;
  var userTimeBase = 4000;
  var userTimePerMove = 2000;
  //var timeUpdateFreq = 1; //Hz
  var movesToWin = 20;

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

  // cache dom handles
  var $simon = $('#simon');
  var $board = $simon.find('.board');
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
    //$btn.bind('mousedown', {id:i}, userPress);
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
    // negative feedback
    startSound(badTone, 'sawtooth');
    buttons[id].$el.addClass('wrong')
                   .bind('mouseup mouseleave touchend', userReleaseIncorrect);
  }

  function userReleaseCorrect (event) {
    stopSound();
    $(event.target).removeClass('pressed')
                   .off('mouseup mouseleave touchend');
    if (userMove === seq.length) {
      if (seq.length > best) {
        best = seq.length;
        $stats.html("high score: <span class='num'>"+best+"</span>");
        $stats.fadeIn(500);
      }
      if (seq.length === movesToWin){
        win();
      } else {
        endUserTurn();
        setTimeout(startNextLevel, 500);
      }
    }
    return false;
  }

  function userReleaseIncorrect (event) {
    stopSound();
    $(event.target).removeClass('wrong')
                   .off('mouseup mouseleave touchend');
    if ( $strictIn.prop('checked') ) {  //srict mode, end game
      $msg.text('game over').css('display','block').delay(2000).fadeOut(2000);
      resetGameplay();
    } else {  // replay this level's sequence
      endUserTurn();
      $msg.text('try again').css('display','block').delay(1000).fadeOut(2000);
      setTimeout(showMove, 1000, 0);
    }
    return false;
  }

  function win() {
    $msg.text('WINNER!!').css('display','block').delay(5000).fadeOut(5000);
    resetGameplay();
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
      //var color = 'background-color','hsl(' + buttons[btnId].hue + ', 70, ' + buttonLightness + ')'
      //buttons[btnID].$el.css('background-color',color);
      buttons[btnID].$el.addClass('indicate');
      startSound(buttons[btnID].tone);
      setTimeout(showNextMove, toneTime, move+1);
    }
  }

  function showNextMove(move) {
    stopSound();
    var hue = buttons[btnID].hue;
    //buttons[btnID].$el.css('background-color','hsl(' + hue + ', ' + buttonSaturation + ', ' + buttonLightness + ')');
    buttons[btnID].$el.removeClass('indicate');
    setTimeout(showMove, toneGap, move);
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
    timeLeft = timeAllowed - (timestamp - turnStartTime);
    if (timeLeft > 0) {
      var pctLeft =  0.1 * Math.floor( 10 * 100 * timeLeft / timeAllowed );
      $timer.css('width',pctLeft+"%");
      if (timeLeft <= 3000) {
        $timer.addClass('urgent');
      }
      turnTimer = requestAnimationFrame(updateUserTime);
    }
    else {
      // time is up
      $timer.removeClass('urgent');
      if ( $strictIn.prop('checked') ) {  //srict mode, end game
        $msg.html('time is up <br> game over').css('display','block').delay(3000).fadeOut(1000);
        resetGameplay();
      } else {  // replay this level's sequence
        $msg.html('time is up <br> try again').css('display','block').delay(1000).fadeOut(1000);
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
