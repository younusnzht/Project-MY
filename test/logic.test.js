const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../public/noor-logic.js');

test('number words', () => {
  assert.equal(L.wordsToNumbers('twelve multiplied by eight'), '12 multiplied by 8');
  assert.equal(L.wordsToNumbers('one hundred and five'), '105');
  assert.equal(L.wordsToNumbers('twenty-five'), '25');
  assert.equal(L.wordsToNumbers('two point five'), '2.5');
});

test('maths', () => {
  const r = (q) => L.tryMath(q);
  assert.equal(r('Noor, what is twelve multiplied by eight?').result, '96');
  assert.equal(r('what is 12 times 8').pretty, '12 × 8');
  assert.equal(r('7 x 6').result, '42');
  assert.equal(r('what is 100 divided by 8').result, '12.5');
  assert.equal(r('what is 0.1 plus 0.2').result, '0.3');
  assert.equal(r('what is 15 percent of 200').result, '30');
  assert.equal(r('square root of 81').result, '9');
  assert.equal(r('9 squared').result, '81');
  assert.equal(r('what is 2 + 3 * 4').result, '14');
  assert.equal(r('what is (2 + 3) * 4').result, '20');
  assert.equal(r('twenty five minus seven').result, '18');
  assert.equal(r('multiply 6 by 7').result, '42');
  assert.equal(r('subtract 3 from 10').result, '7');
  assert.equal(r('what is 1000 times 1000').result, '1,000,000');
  assert.ok(r('what is 5 divided by 0').error);
  for (const q of ['hello', 'explain the water cycle', 'what is 2020', 'I have 3 apples', 'set a timer for 5 minutes', 'tell me a story']) assert.equal(r(q), null, q);
});

test('names', () => {
  const n = (t, c) => (L.extractName(t, c) || {}).name;
  assert.equal(n('Hi, my name is Muhammad.'), 'Muhammad');
  assert.equal(n('call me sara'), 'Sara');
  assert.equal(n("I'm Ali"), 'Ali');
  assert.equal(n("I'm fine"), undefined);
  assert.equal(n("I'm Fine"), undefined);
  assert.equal(n("I'm hungry"), undefined);
  assert.equal(n('my name is not Sam, it is Tom', 'Sam'), 'Tom');
  assert.equal(n("No, it's Omar", 'Ali'), 'Omar');
  assert.equal(n("It's Sunday today"), undefined);
});

test('durations', () => {
  const d = L.parseDuration;
  assert.equal(d('set a timer for one minute'), 60);
  assert.equal(d('2 minutes and 30 seconds'), 150);
  assert.equal(d('half an hour'), 1800);
  assert.equal(d('an hour and a half'), 5400);
  assert.equal(d('one and a half minutes'), 90);
  assert.equal(d('ten seconds'), 10);
  assert.equal(d('5m'), 300);
  assert.equal(d('hello'), null);
  assert.equal(L.formatDuration(150), '2 minutes and 30 seconds');
  assert.equal(L.formatClock(65), '01:05');
});

test('commands', () => {
  const c = L.parseCommand;
  assert.deepEqual(c('Noor, set a timer for one minute.'), { type: 'timer', seconds: 60 });
  assert.deepEqual(c('start a 5 minute timer'), { type: 'timer', seconds: 300 });
  assert.equal(c('set a timer').type, 'needDuration');
  assert.deepEqual(c('remind me to drink water in 10 minutes'), { type: 'reminder', seconds: 600, what: 'drink water' });
  assert.deepEqual(c('remind me in 5 minutes to do my homework'), { type: 'reminder', seconds: 300, what: 'do your homework' });
  assert.deepEqual(c('remind me to turn in my homework in 2 minutes'), { type: 'reminder', seconds: 120, what: 'turn in your homework' });
  assert.equal(c('remind me to feed the fish').type, 'needTime');
  assert.equal(c('cancel the timer').type, 'cancel');
  assert.equal(c('how much time is left').type, 'timeLeft');
  assert.equal(c('stop').type, 'stopTalking');
  assert.equal(c('what is a timer'), null);
  assert.equal(c('explain the water cycle'), null);
});

test('demo conversation keeps context', () => {
  const mem = {};
  let ctx = { name: 'Muhammad', prevName: null };
  assert.equal(L.demoReply('Hi, my name is Muhammad.', ctx, mem), 'Hi, Muhammad! How are you doing today?');
  ctx = { name: 'Muhammad', prevName: 'Muhammad' };
  assert.match(L.demoReply("I'm fine. What is your name?", ctx, mem), /great to hear.*My name is Noor! I am your AI helper/);
  assert.match(L.demoReply('Can you help me with maths?', ctx, mem), /^Of course, Muhammad! What maths question/);
  assert.match(L.demoReply('Explain the water cycle', ctx, mem), /water cycle is how water travels/);
  assert.match(L.demoReply('explain that again', ctx, mem), /let me try again/i);
  assert.match(L.demoReply('give me another example', ctx, mem), /puddle/);
  assert.match(L.demoReply('give me another example', ctx, mem), /cold glass/);
  const short = L.demoReply('make it shorter', ctx, mem);
  assert.ok(short.split('.').length <= 2, short);
  const fix = L.demoReply('No, my name is Omar', { name: 'Omar', prevName: 'Muhammad' }, mem);
  assert.match(fix, /call you Omar/);
  assert.match(L.demoReply('tell me a short story about kindness', ctx, mem), /Bolt/);
  assert.match(L.demoReply('what does habitat mean', ctx, mem), /natural home/);
  assert.match(L.demoReply('blah blah quantum', ctx, mem), /not sure about that in Demo Mode/);
});

test('speakable', () => {
  assert.equal(L.speakable('12 × 8 = 96.'), '12 times 8 equals 96.');
  assert.equal(L.speakable('100 ÷ 4 = 25'), '100 divided by 4 equals 25');
  assert.equal(L.speakable('10 - 3 = 7 🙂'), '10 minus 3 equals 7');
});
