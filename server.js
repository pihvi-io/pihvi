const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const questions = require('./questions.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Game state
const rooms = new Map();

// Game constants
const ANSWER_TIME = 60; // seconds to submit answers
const VOTE_TIME = 30; // seconds to vote
const RESULTS_TIME = 10; // seconds to show results
const ROUNDS_PER_GAME = 8;
const POINTS_CORRECT_ANSWER = 1000;
const POINTS_FOOLED_PLAYER = 500;

class GameRoom {
  constructor(code, hostId) {
    this.code = code;
    this.hostId = hostId;
    this.players = new Map();
    this.state = 'lobby'; // lobby, answering, voting, results, gameover
    this.currentRound = 0;
    this.currentQuestion = null;
    this.answers = new Map(); // playerId -> answer
    this.votes = new Map(); // playerId -> answerId they voted for
    this.usedQuestions = new Set();
    this.timer = null;
    this.timeLeft = 0;
  }

  addPlayer(id, name) {
    this.players.set(id, {
      id,
      name,
      score: 0,
      isHost: id === this.hostId
    });
  }

  removePlayer(id) {
    this.players.delete(id);
    if (id === this.hostId && this.players.size > 0) {
      // Transfer host to first remaining player
      const newHost = this.players.keys().next().value;
      this.hostId = newHost;
      this.players.get(newHost).isHost = true;
    }
  }

  getRandomQuestion() {
    const availableQuestions = questions.filter((_, idx) => !this.usedQuestions.has(idx));
    if (availableQuestions.length === 0) {
      this.usedQuestions.clear();
      return questions[Math.floor(Math.random() * questions.length)];
    }
    const idx = Math.floor(Math.random() * availableQuestions.length);
    const originalIdx = questions.indexOf(availableQuestions[idx]);
    this.usedQuestions.add(originalIdx);
    return availableQuestions[idx];
  }

  startRound() {
    this.currentRound++;
    this.currentQuestion = this.getRandomQuestion();
    this.answers.clear();
    this.votes.clear();
    this.state = 'answering';
    this.timeLeft = ANSWER_TIME;
  }

  submitAnswer(playerId, answer) {
    if (this.state === 'answering' && !this.answers.has(playerId)) {
      this.answers.set(playerId, {
        id: uuidv4(),
        playerId,
        text: answer.trim().toLowerCase()
      });
      return true;
    }
    return false;
  }

  getAllAnswers() {
    // Combine player answers with the correct answer, shuffle them
    const allAnswers = Array.from(this.answers.values()).map(a => ({
      id: a.id,
      text: a.text,
      isCorrect: false,
      playerId: a.playerId
    }));

    // Add the correct answer
    allAnswers.push({
      id: 'correct',
      text: this.currentQuestion.answer.toLowerCase(),
      isCorrect: true,
      playerId: null
    });

    // Filter out duplicates of the correct answer
    const correctAnswer = this.currentQuestion.answer.toLowerCase();
    const filtered = allAnswers.filter(a =>
      a.isCorrect || a.text !== correctAnswer
    );

    // Shuffle
    return filtered.sort(() => Math.random() - 0.5);
  }

  submitVote(playerId, answerId) {
    if (this.state === 'voting' && !this.votes.has(playerId)) {
      // Can't vote for your own answer
      const playerAnswer = this.answers.get(playerId);
      if (playerAnswer && playerAnswer.id === answerId) {
        return false;
      }
      this.votes.set(playerId, answerId);
      return true;
    }
    return false;
  }

  calculateResults() {
    const results = {
      correctAnswer: this.currentQuestion.answer,
      playerResults: []
    };

    // Calculate points for each player
    for (const [playerId, player] of this.players) {
      let roundScore = 0;
      let gotCorrect = false;
      let fooledCount = 0;

      // Check if they voted correctly
      const vote = this.votes.get(playerId);
      if (vote === 'correct') {
        roundScore += POINTS_CORRECT_ANSWER;
        gotCorrect = true;
      }

      // Check how many people they fooled
      const playerAnswer = this.answers.get(playerId);
      if (playerAnswer) {
        for (const [voterId, votedAnswerId] of this.votes) {
          if (voterId !== playerId && votedAnswerId === playerAnswer.id) {
            roundScore += POINTS_FOOLED_PLAYER;
            fooledCount++;
          }
        }
      }

      player.score += roundScore;

      results.playerResults.push({
        playerId,
        name: player.name,
        roundScore,
        totalScore: player.score,
        gotCorrect,
        fooledCount,
        theirAnswer: playerAnswer ? playerAnswer.text : null
      });
    }

    // Sort by total score
    results.playerResults.sort((a, b) => b.totalScore - a.totalScore);

    return results;
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        score: p.score
      }));
  }

  toJSON() {
    return {
      code: this.code,
      hostId: this.hostId,
      players: Array.from(this.players.values()),
      state: this.state,
      currentRound: this.currentRound,
      totalRounds: ROUNDS_PER_GAME,
      timeLeft: this.timeLeft
    };
  }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

io.on('connection', (socket) => {
  console.log('Pelaaja yhdisti:', socket.id);

  let currentRoom = null;
  let playerName = null;

  socket.on('createRoom', (name) => {
    let code;
    do {
      code = generateRoomCode();
    } while (rooms.has(code));

    const room = new GameRoom(code, socket.id);
    room.addPlayer(socket.id, name);
    rooms.set(code, room);

    currentRoom = code;
    playerName = name;
    socket.join(code);

    socket.emit('roomCreated', { code, room: room.toJSON() });
    console.log(`Huone ${code} luotu pelaajan ${name} toimesta`);
  });

  socket.on('joinRoom', ({ code, name }) => {
    const room = rooms.get(code.toUpperCase());

    if (!room) {
      socket.emit('error', { message: 'Huonetta ei loydy!' });
      return;
    }

    if (room.state !== 'lobby') {
      socket.emit('error', { message: 'Peli on jo kaynnissa!' });
      return;
    }

    if (room.players.size >= 8) {
      socket.emit('error', { message: 'Huone on taynna!' });
      return;
    }

    room.addPlayer(socket.id, name);
    currentRoom = code.toUpperCase();
    playerName = name;
    socket.join(currentRoom);

    socket.emit('roomJoined', { code: currentRoom, room: room.toJSON() });
    socket.to(currentRoom).emit('playerJoined', { room: room.toJSON() });
    console.log(`${name} liittyi huoneeseen ${currentRoom}`);
  });

  socket.on('startGame', () => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.size < 2) {
      socket.emit('error', { message: 'Tarvitaan vahintaan 2 pelaajaa!' });
      return;
    }

    startNewRound(room);
  });

  function startNewRound(room) {
    room.startRound();

    io.to(room.code).emit('roundStarted', {
      round: room.currentRound,
      totalRounds: ROUNDS_PER_GAME,
      question: room.currentQuestion.question,
      category: room.currentQuestion.category,
      timeLeft: ANSWER_TIME
    });

    // Timer for answering phase
    clearInterval(room.timer);
    room.timer = setInterval(() => {
      room.timeLeft--;
      io.to(room.code).emit('timerUpdate', { timeLeft: room.timeLeft });

      if (room.timeLeft <= 0 || room.answers.size >= room.players.size) {
        clearInterval(room.timer);
        startVoting(room);
      }
    }, 1000);
  }

  function startVoting(room) {
    room.state = 'voting';
    room.timeLeft = VOTE_TIME;

    const answers = room.getAllAnswers();

    io.to(room.code).emit('votingStarted', {
      question: room.currentQuestion.question,
      answers: answers.map(a => ({ id: a.id, text: a.text })),
      timeLeft: VOTE_TIME
    });

    room.timer = setInterval(() => {
      room.timeLeft--;
      io.to(room.code).emit('timerUpdate', { timeLeft: room.timeLeft });

      if (room.timeLeft <= 0 || room.votes.size >= room.players.size) {
        clearInterval(room.timer);
        showResults(room);
      }
    }, 1000);
  }

  function showResults(room) {
    room.state = 'results';
    room.timeLeft = RESULTS_TIME;

    const results = room.calculateResults();
    const allAnswers = room.getAllAnswers();

    // Add vote counts to answers
    const answersWithVotes = allAnswers.map(a => {
      let voteCount = 0;
      for (const [, votedId] of room.votes) {
        if (votedId === a.id) voteCount++;
      }
      return {
        ...a,
        voteCount,
        submittedBy: a.playerId ? room.players.get(a.playerId)?.name : null
      };
    });

    io.to(room.code).emit('resultsShown', {
      results,
      answers: answersWithVotes,
      leaderboard: room.getLeaderboard()
    });

    room.timer = setInterval(() => {
      room.timeLeft--;
      io.to(room.code).emit('timerUpdate', { timeLeft: room.timeLeft });

      if (room.timeLeft <= 0) {
        clearInterval(room.timer);

        if (room.currentRound >= ROUNDS_PER_GAME) {
          endGame(room);
        } else {
          startNewRound(room);
        }
      }
    }, 1000);
  }

  function endGame(room) {
    room.state = 'gameover';

    io.to(room.code).emit('gameOver', {
      leaderboard: room.getLeaderboard()
    });
  }

  socket.on('submitAnswer', (answer) => {
    const room = rooms.get(currentRoom);
    if (!room) return;

    if (room.submitAnswer(socket.id, answer)) {
      socket.emit('answerSubmitted');
      io.to(currentRoom).emit('playerAnswered', {
        count: room.answers.size,
        total: room.players.size
      });
    }
  });

  socket.on('submitVote', (answerId) => {
    const room = rooms.get(currentRoom);
    if (!room) return;

    if (room.submitVote(socket.id, answerId)) {
      socket.emit('voteSubmitted');
      io.to(currentRoom).emit('playerVoted', {
        count: room.votes.size,
        total: room.players.size
      });
    }
  });

  socket.on('playAgain', () => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;

    // Reset game state
    room.state = 'lobby';
    room.currentRound = 0;
    room.usedQuestions.clear();
    for (const player of room.players.values()) {
      player.score = 0;
    }

    io.to(currentRoom).emit('gameReset', { room: room.toJSON() });
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.removePlayer(socket.id);

        if (room.players.size === 0) {
          clearInterval(room.timer);
          rooms.delete(currentRoom);
          console.log(`Huone ${currentRoom} poistettu`);
        } else {
          io.to(currentRoom).emit('playerLeft', {
            room: room.toJSON(),
            playerName
          });
        }
      }
    }
    console.log('Pelaaja poistui:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Huijari-palvelin kaynnissa portissa ${PORT}`);
  console.log(`Avaa http://localhost:${PORT} selaimessa`);
});
