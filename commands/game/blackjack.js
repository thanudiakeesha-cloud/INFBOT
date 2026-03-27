const activeGames = new Map();

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit, display: `${rank}${suit}` });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(card) {
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  if (card.rank === 'A') return 11;
  return parseInt(card.rank);
}

function handValue(hand) {
  let value = hand.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = hand.filter(c => c.rank === 'A').length;
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  return value;
}

function showHand(hand) {
  return hand.map(c => c.display).join(' ');
}

module.exports = {
  name: 'blackjack',
  aliases: ['bj', '21'],
  category: 'game',
  description: 'Play Blackjack (21) against the dealer',
  usage: '.blackjack [hit|stand]',

  async execute(sock, msg, args, extra) {
    try {
      const gameKey = `${extra.from}_${extra.sender}`;
      const action = args[0]?.toLowerCase();

      if (!action || (!activeGames.has(gameKey) && !['hit', 'stand'].includes(action))) {
        const deck = createDeck();
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];

        const pv = handValue(playerHand);

        if (pv === 21) {
          const dv = handValue(dealerHand);
          const result = dv === 21 ? "🤝 *Push! Both have Blackjack!*" : "🎰 *BLACKJACK! You win!*";
          await extra.react(dv === 21 ? '🤝' : '🎰');
          return extra.reply(`╭━━〔 🃏 BLACKJACK 〕━━⬣
┃
┃ 🧑 *You:* ${showHand(playerHand)} (${pv})
┃ 🤖 *Dealer:* ${showHand(dealerHand)} (${dv})
┃
┃ ${result}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
        }

        activeGames.set(gameKey, { deck, playerHand, dealerHand, timestamp: Date.now() });
        setTimeout(() => { activeGames.delete(gameKey); }, 120000);

        return extra.reply(`╭━━〔 🃏 BLACKJACK 〕━━⬣
┃
┃ 🧑 *You:* ${showHand(playerHand)} (${pv})
┃ 🤖 *Dealer:* ${dealerHand[0].display} 🂠
┃
┃ *.blackjack hit* - Draw a card
┃ *.blackjack stand* - Keep hand
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      const game = activeGames.get(gameKey);
      if (!game) {
        return extra.reply('❌ No active game! Start one with .blackjack');
      }

      if (action === 'hit') {
        game.playerHand.push(game.deck.pop());
        const pv = handValue(game.playerHand);

        if (pv > 21) {
          activeGames.delete(gameKey);
          await extra.react('😢');
          return extra.reply(`╭━━〔 🃏 BLACKJACK 〕━━⬣
┃
┃ 🧑 *You:* ${showHand(game.playerHand)} (${pv})
┃ 🤖 *Dealer:* ${showHand(game.dealerHand)} (${handValue(game.dealerHand)})
┃
┃ 💥 *BUST! You lose!*
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
        }

        return extra.reply(`╭━━〔 🃏 BLACKJACK 〕━━⬣
┃
┃ 🧑 *You:* ${showHand(game.playerHand)} (${pv})
┃ 🤖 *Dealer:* ${game.dealerHand[0].display} 🂠
┃
┃ *.blackjack hit* or *.blackjack stand*
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      if (action === 'stand') {
        while (handValue(game.dealerHand) < 17) {
          game.dealerHand.push(game.deck.pop());
        }

        const pv = handValue(game.playerHand);
        const dv = handValue(game.dealerHand);

        activeGames.delete(gameKey);

        let result, emoji;
        if (dv > 21) {
          result = '🎉 *Dealer busts! You win!*';
          emoji = '🎉';
        } else if (pv > dv) {
          result = '🎉 *You win!*';
          emoji = '🎉';
        } else if (dv > pv) {
          result = '😢 *Dealer wins!*';
          emoji = '😢';
        } else {
          result = "🤝 *Push! It's a tie!*";
          emoji = '🤝';
        }

        await extra.react(emoji);

        return extra.reply(`╭━━〔 🃏 BLACKJACK 〕━━⬣
┃
┃ 🧑 *You:* ${showHand(game.playerHand)} (${pv})
┃ 🤖 *Dealer:* ${showHand(game.dealerHand)} (${dv})
┃
┃ ${result}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      return extra.reply('❌ Use *.blackjack hit* or *.blackjack stand*');
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
