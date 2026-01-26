// Connect to server
const socket = io();

// DOM Elements
const screens = {
  menu: document.getElementById('menu-screen'),
  lobby: document.getElementById('lobby-screen'),
  answer: document.getElementById('answer-screen'),
  vote: document.getElementById('vote-screen'),
  results: document.getElementById('results-screen'),
  gameover: document.getElementById('gameover-screen')
};

// Menu elements
const playerNameInput = document.getElementById('player-name');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const joinForm = document.getElementById('join-form');
const roomCodeInput = document.getElementById('room-code');
const joinConfirmBtn = document.getElementById('join-confirm-btn');

// Lobby elements
const roomCodeDisplay = document.getElementById('room-code-display');
const playerList = document.getElementById('player-list');
const startGameBtn = document.getElementById('start-game-btn');
const waitingHost = document.getElementById('waiting-host');

// Answer elements
const currentRoundEl = document.getElementById('current-round');
const totalRoundsEl = document.getElementById('total-rounds');
const answerTimerEl = document.getElementById('answer-timer');
const questionCategory = document.getElementById('question-category');
const questionText = document.getElementById('question-text');
const answerInput = document.getElementById('answer-input');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const answerStatus = document.getElementById('answer-status');
const answersCount = document.getElementById('answers-count');
const answersTotal = document.getElementById('answers-total');

// Vote elements
const voteRound = document.getElementById('vote-round');
const voteTotalRounds = document.getElementById('vote-total-rounds');
const voteTimerEl = document.getElementById('vote-timer');
const voteQuestionText = document.getElementById('vote-question-text');
const voteOptions = document.getElementById('vote-options');
const voteStatus = document.getElementById('vote-status');
const votesCount = document.getElementById('votes-count');
const votesTotal = document.getElementById('votes-total');

// Results elements
const correctAnswerEl = document.getElementById('correct-answer');
const resultsList = document.getElementById('results-list');
const leaderboardEl = document.getElementById('leaderboard');
const resultsTimerBar = document.getElementById('results-timer-bar');

// Game over elements
const winnerName = document.getElementById('winner-name');
const winnerScore = document.getElementById('winner-score');
const finalLeaderboard = document.getElementById('final-leaderboard');
const playAgainBtn = document.getElementById('play-again-btn');
const waitingRestart = document.getElementById('waiting-restart');

// Toast
const errorToast = document.getElementById('error-toast');

// State
let currentPlayerId = null;
let isHost = false;
let currentRoom = null;

// Utility functions
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
}

function showError(message) {
  errorToast.textContent = message;
  errorToast.classList.remove('hidden');
  setTimeout(() => {
    errorToast.classList.add('hidden');
  }, 3000);
}

function updateTimer(element, seconds) {
  element.textContent = seconds;
  if (seconds <= 10) {
    element.classList.add('warning');
  } else {
    element.classList.remove('warning');
  }
}

// Menu handlers
createBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    showError('Kirjoita nimesi!');
    return;
  }
  socket.emit('createRoom', name);
});

joinBtn.addEventListener('click', () => {
  joinForm.classList.toggle('hidden');
  roomCodeInput.focus();
});

joinConfirmBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!name) {
    showError('Kirjoita nimesi!');
    return;
  }
  if (!code || code.length !== 4) {
    showError('Syota 4-merkkinen huonekoodi!');
    return;
  }
  socket.emit('joinRoom', { code, name });
});

roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinConfirmBtn.click();
  }
});

playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && joinForm.classList.contains('hidden')) {
    createBtn.click();
  }
});

// Lobby handlers
startGameBtn.addEventListener('click', () => {
  socket.emit('startGame');
});

// Answer handlers
submitAnswerBtn.addEventListener('click', () => {
  const answer = answerInput.value.trim();
  if (!answer) {
    showError('Kirjoita vastaus!');
    return;
  }
  socket.emit('submitAnswer', answer);
});

answerInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitAnswerBtn.click();
  }
});

// Game over handlers
playAgainBtn.addEventListener('click', () => {
  socket.emit('playAgain');
});

// Socket event handlers
socket.on('connect', () => {
  currentPlayerId = socket.id;
});

socket.on('roomCreated', ({ code, room }) => {
  currentRoom = code;
  isHost = true;
  updateLobby(room);
  showScreen('lobby');
});

socket.on('roomJoined', ({ code, room }) => {
  currentRoom = code;
  isHost = room.players.find(p => p.id === currentPlayerId)?.isHost || false;
  updateLobby(room);
  showScreen('lobby');
});

socket.on('playerJoined', ({ room }) => {
  updateLobby(room);
});

socket.on('playerLeft', ({ room, playerName }) => {
  updateLobby(room);
  isHost = room.players.find(p => p.id === currentPlayerId)?.isHost || false;
});

function updateLobby(room) {
  roomCodeDisplay.textContent = room.code;

  playerList.innerHTML = room.players.map(player => `
    <div class="player-card ${player.isHost ? 'host' : ''}">
      ${player.name}
    </div>
  `).join('');

  if (room.players.find(p => p.id === currentPlayerId)?.isHost) {
    startGameBtn.classList.remove('hidden');
    waitingHost.classList.add('hidden');
    startGameBtn.disabled = room.players.length < 2;
  } else {
    startGameBtn.classList.add('hidden');
    waitingHost.classList.remove('hidden');
  }
}

socket.on('roundStarted', ({ round, totalRounds, question, category, timeLeft }) => {
  currentRoundEl.textContent = round;
  totalRoundsEl.textContent = totalRounds;
  questionCategory.textContent = category;
  questionText.textContent = question;
  answerInput.value = '';
  answerInput.disabled = false;
  submitAnswerBtn.disabled = false;
  answerStatus.classList.add('hidden');
  updateTimer(answerTimerEl, timeLeft);
  answersCount.textContent = '0';
  answersTotal.textContent = '0';
  showScreen('answer');
});

socket.on('answerSubmitted', () => {
  answerInput.disabled = true;
  submitAnswerBtn.disabled = true;
  answerStatus.classList.remove('hidden');
});

socket.on('playerAnswered', ({ count, total }) => {
  answersCount.textContent = count;
  answersTotal.textContent = total;
});

socket.on('votingStarted', ({ question, answers, timeLeft }) => {
  voteRound.textContent = currentRoundEl.textContent;
  voteTotalRounds.textContent = totalRoundsEl.textContent;
  voteQuestionText.textContent = question;
  updateTimer(voteTimerEl, timeLeft);
  voteStatus.classList.add('hidden');
  votesCount.textContent = '0';
  votesTotal.textContent = '0';

  voteOptions.innerHTML = answers.map(answer => `
    <div class="vote-option" data-id="${answer.id}">
      ${capitalizeFirst(answer.text)}
    </div>
  `).join('');

  // Add click handlers
  voteOptions.querySelectorAll('.vote-option').forEach(option => {
    option.addEventListener('click', () => {
      if (option.classList.contains('disabled')) return;

      // Remove previous selection
      voteOptions.querySelectorAll('.vote-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');

      socket.emit('submitVote', option.dataset.id);
    });
  });

  showScreen('vote');
});

socket.on('voteSubmitted', () => {
  voteOptions.querySelectorAll('.vote-option').forEach(o => o.classList.add('disabled'));
  voteStatus.classList.remove('hidden');
});

socket.on('playerVoted', ({ count, total }) => {
  votesCount.textContent = count;
  votesTotal.textContent = total;
});

socket.on('resultsShown', ({ results, answers, leaderboard }) => {
  correctAnswerEl.textContent = capitalizeFirst(results.correctAnswer);

  resultsList.innerHTML = results.playerResults.map(player => {
    let badges = '';
    if (player.gotCorrect) {
      badges += '<span class="result-badge correct">Oikein!</span>';
    }
    if (player.fooledCount > 0) {
      badges += `<span class="result-badge fooled">Huijasi ${player.fooledCount}!</span>`;
    }
    return `
      <div class="result-item">
        <span class="result-name">${player.name}</span>
        <div class="result-score">
          ${badges}
          <span class="result-points">+${player.roundScore}</span>
        </div>
      </div>
    `;
  }).join('');

  leaderboardEl.innerHTML = leaderboard.map(player => `
    <div class="leaderboard-item">
      <span class="leaderboard-rank">${player.rank}.</span>
      <span class="leaderboard-name">${player.name}</span>
      <span class="leaderboard-score">${player.score}</span>
    </div>
  `).join('');

  resultsTimerBar.style.width = '100%';
  setTimeout(() => {
    resultsTimerBar.style.width = '0%';
  }, 100);

  showScreen('results');
});

socket.on('gameOver', ({ leaderboard }) => {
  const winner = leaderboard[0];
  winnerName.textContent = winner.name;
  winnerScore.textContent = `${winner.score} pistetta`;

  finalLeaderboard.innerHTML = leaderboard.map((player, idx) => `
    <div class="final-leaderboard-item">
      <span class="leaderboard-rank">${getRankEmoji(idx + 1)} ${player.rank}.</span>
      <span class="leaderboard-name">${player.name}</span>
      <span class="leaderboard-score">${player.score}</span>
    </div>
  `).join('');

  // Show play again button only to host
  if (isHost) {
    playAgainBtn.classList.remove('hidden');
    waitingRestart.classList.add('hidden');
  } else {
    playAgainBtn.classList.add('hidden');
    waitingRestart.classList.remove('hidden');
  }

  showScreen('gameover');
});

socket.on('gameReset', ({ room }) => {
  updateLobby(room);
  showScreen('lobby');
});

socket.on('timerUpdate', ({ timeLeft }) => {
  const currentScreen = document.querySelector('.screen.active');
  if (currentScreen === screens.answer) {
    updateTimer(answerTimerEl, timeLeft);
  } else if (currentScreen === screens.vote) {
    updateTimer(voteTimerEl, timeLeft);
  }
});

socket.on('error', ({ message }) => {
  showError(message);
});

// Utility
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getRankEmoji(rank) {
  switch (rank) {
    case 1: return '\u{1F947}';
    case 2: return '\u{1F948}';
    case 3: return '\u{1F949}';
    default: return '';
  }
}
