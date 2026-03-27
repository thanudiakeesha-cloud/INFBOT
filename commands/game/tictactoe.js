const activeGames = new Map();

module.exports = {
  name: 'tictactoe',
  aliases: ['ttt', 'xo'],
  category: 'game',
  description: 'Play Tic Tac Toe against the bot',
  usage: '.tictactoe <1-9>',

  async execute(sock, msg, args, extra) {
    try {
      const gameKey = `${extra.from}_${extra.sender}`;

      if (!args.length) {
        const board = [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
        activeGames.set(gameKey, { board, timestamp: Date.now() });

        setTimeout(() => { activeGames.delete(gameKey); }, 120000);

        const text = `╭━━〔 ❌⭕ TIC TAC TOE 〕━━⬣
┃ You are ❌, Bot is ⭕
┃
┃ ${board[0] || '1'} │ ${board[1] || '2'} │ ${board[2] || '3'}
┃ ──┼───┼──
┃ ${board[3] || '4'} │ ${board[4] || '5'} │ ${board[5] || '6'}
┃ ──┼───┼──
┃ ${board[6] || '7'} │ ${board[7] || '8'} │ ${board[8] || '9'}
┃
┃ Reply with a number (1-9) to place your mark!
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`;

        return extra.reply(text);
      }

      const game = activeGames.get(gameKey);
      if (!game) {
        return extra.reply('❌ No active game! Start one with .tictactoe');
      }

      const pos = parseInt(args[0]) - 1;
      if (isNaN(pos) || pos < 0 || pos > 8) {
        return extra.reply('❌ Pick a number between 1-9!');
      }

      if (game.board[pos] !== ' ') {
        return extra.reply('❌ That spot is taken! Pick another.');
      }

      game.board[pos] = '❌';

      if (checkWin(game.board, '❌')) {
        activeGames.delete(gameKey);
        return extra.reply(renderBoard(game.board) + '\n\n🎉 *You win!*\n\n> *KNIGHT BOT MD*');
      }

      if (game.board.every(c => c !== ' ')) {
        activeGames.delete(gameKey);
        return extra.reply(renderBoard(game.board) + "\n\n🤝 *It's a draw!*\n\n> *KNIGHT BOT MD*");
      }

      const botMove = getBotMove(game.board);
      game.board[botMove] = '⭕';

      if (checkWin(game.board, '⭕')) {
        activeGames.delete(gameKey);
        return extra.reply(renderBoard(game.board) + '\n\n😢 *Bot wins!*\n\n> *KNIGHT BOT MD*');
      }

      if (game.board.every(c => c !== ' ')) {
        activeGames.delete(gameKey);
        return extra.reply(renderBoard(game.board) + "\n\n🤝 *It's a draw!*\n\n> *KNIGHT BOT MD*");
      }

      await extra.reply(renderBoard(game.board) + '\n\nYour turn! Reply with 1-9.\n\n> *KNIGHT BOT MD*');
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};

function renderBoard(board) {
  const d = board.map((c, i) => c === ' ' ? (i + 1).toString() : c);
  return `╭━━〔 ❌⭕ TIC TAC TOE 〕━━⬣
┃ ${d[0]} │ ${d[1]} │ ${d[2]}
┃ ──┼───┼──
┃ ${d[3]} │ ${d[4]} │ ${d[5]}
┃ ──┼───┼──
┃ ${d[6]} │ ${d[7]} │ ${d[8]}
╰━━━━━━━━━━━━━━━━━━━━⬣`;
}

function checkWin(board, mark) {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  return wins.some(([a,b,c]) => board[a] === mark && board[b] === mark && board[c] === mark);
}

function getBotMove(board) {
  for (let i = 0; i < 9; i++) {
    if (board[i] === ' ') {
      board[i] = '⭕';
      if (checkWin(board, '⭕')) { board[i] = ' '; return i; }
      board[i] = ' ';
    }
  }
  for (let i = 0; i < 9; i++) {
    if (board[i] === ' ') {
      board[i] = '❌';
      if (checkWin(board, '❌')) { board[i] = ' '; return i; }
      board[i] = ' ';
    }
  }
  if (board[4] === ' ') return 4;
  const corners = [0,2,6,8].filter(i => board[i] === ' ');
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  const empty = board.map((c, i) => c === ' ' ? i : -1).filter(i => i !== -1);
  return empty[Math.floor(Math.random() * empty.length)];
}
