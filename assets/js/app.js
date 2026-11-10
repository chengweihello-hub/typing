/* =========================================================
   词语小森林 · Word Grove
   Adaptive typing game logic
   ========================================================= */

(function () {
  'use strict';

  var DATA = window.TYPING_DATA;
  if (!DATA || !DATA.zh || !DATA.en) {
    console.error('词语小森林：词库加载失败。');
    return;
  }

  var SESSION_SIZE = 10;
  var STORAGE_KEY = 'word-grove-profile-v1';
  var LEVELS = [
    { name: '小种子', icon: '🌱' },
    { name: '小嫩芽', icon: '🌿' },
    { name: '小树苗', icon: '🪴' },
    { name: '小树', icon: '🌳' },
    { name: '大树', icon: '🌲' }
  ];

  var MODES = {
    zh: {
      name: '语文小森林',
      short: '语文',
      ready: '照着拼音，敲出字母。拼音连起来敲，不用加空格哦！',
      prompt: '看拼音 · 敲字母',
      success: [
        '太棒了！这个词语被你点亮啦！',
        '打得又快又准，真厉害！',
        '漂亮！小树又长高了一截。',
        '就是这样，继续向前！'
      ],
      cheers: [
        '手指飞起来啦！',
        '你越来越熟练了！',
        '这个词语记住你啦！'
      ],
      start: '准备好了吗？'
    },
    en: {
      name: 'English Adventure',
      short: 'English',
      ready: 'Read it, then type it. 大胆敲下去！',
      prompt: 'Read & type · 敲出这个词',
      success: [
        'Great job! 你点亮了一个词！',
        'Nice! Keep going!',
        'Woohoo! 太棒啦！',
        'Perfect! 继续探险。'
      ],
      cheers: [
        'You are on fire!',
        'Keep that rhythm!',
        'Wonderful typing!'
      ],
      start: 'Ready?'
    }
  };

  var KEY_NAMES = {
    ' ': '空格',
    '.': '句号',
    ',': '逗号',
    "'": '撇号',
    '!': '感叹号',
    '?': '问号',
    '(': '左括号',
    ')': '右括号'
  };

  var TONE_MAP = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
    'ü': 'v', 'ń': 'n', 'ň': 'n', 'ǹ': 'n', 'ḿ': 'm'
  };

  /* ---------------- helpers ---------------- */

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function stripTone(text) {
    return String(text).replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹḿ]/g, function (ch) {
      return TONE_MAP[ch] || ch;
    });
  }

  function getLevel(level) {
    var item = LEVELS[clamp(level, 1, 5) - 1];
    return item.icon + ' ' + item.name;
  }

  function getLevelName(level) {
    return LEVELS[clamp(level, 1, 5) - 1].name;
  }

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function displayKey(key) {
    if (key === ' ') return '空格';
    if (/^[a-z]$/i.test(key)) return key.toUpperCase();
    return key;
  }

  function keyHintText(key) {
    if (key === ' ') return '空格键';
    if (KEY_NAMES[key]) return KEY_NAMES[key] + '「' + key + '」';
    return '「' + displayKey(key) + '」';
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (error) { /* ignore */ }
    }
  }

  /* ---------------- profile ---------------- */

  function defaultMode() {
    return {
      level: 1,
      stars: 0,
      sessions: 0,
      bestCombo: 0,
      words: {}
    };
  }

  function defaultProfile() {
    return {
      version: 1,
      sound: true,
      modes: {
        zh: defaultMode(),
        en: defaultMode()
      }
    };
  }

  function sanitizeMode(raw) {
    var mode = defaultMode();
    if (!raw || typeof raw !== 'object') return mode;
    mode.level = clamp(parseInt(raw.level, 10) || 1, 1, 5);
    mode.stars = Math.max(0, parseInt(raw.stars, 10) || 0);
    mode.sessions = Math.max(0, parseInt(raw.sessions, 10) || 0);
    mode.bestCombo = Math.max(0, parseInt(raw.bestCombo, 10) || 0);
    if (raw.words && typeof raw.words === 'object') {
      Object.keys(raw.words).forEach(function (key) {
        var item = raw.words[key];
        if (!item || typeof item !== 'object') return;
        mode.words[key] = {
          seen: Math.max(0, parseInt(item.seen, 10) || 0),
          correct: Math.max(0, parseInt(item.correct, 10) || 0),
          wrong: Math.max(0, parseInt(item.wrong, 10) || 0),
          streak: Math.max(0, parseInt(item.streak, 10) || 0),
          mastery: clamp(parseInt(item.mastery, 10) || 0, 0, 5),
          lastSeen: parseInt(item.lastSeen, 10) || 0
        };
      });
    }
    return mode;
  }

  function loadProfile() {
    var profile = defaultProfile();
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return profile;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return profile;
      profile.sound = parsed.sound !== false;
      profile.modes.zh = sanitizeMode(parsed.modes && parsed.modes.zh);
      profile.modes.en = sanitizeMode(parsed.modes && parsed.modes.en);
    } catch (error) {
      console.warn('词语小森林：读取本地进度失败，将使用新进度。', error);
    }
    return profile;
  }

  function saveProfile() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profile));
    } catch (error) {
      /* Private mode or file:// storage may fail; the game still works. */
    }
  }

  /* ---------------- data preparation ---------------- */

  var WORDS = { zh: [], en: [] };

  function prepareWords() {
    ['zh', 'en'].forEach(function (modeId) {
      var source = DATA[modeId].words;
      var list = source.map(function (word, index) {
        var chars = Array.from(word.text);
        var score;
        if (modeId === 'zh') {
          score = word.keys.length + chars.length * 0.35;
        } else {
          var letters = word.keys.replace(/[^a-z]/g, '').length;
          var wordCount = word.text.trim().split(/\s+/).length;
          score = letters + (wordCount - 1) * 1.8;
        }
        return {
          text: word.text,
          pinyin: word.pinyin ? word.pinyin.slice() : null,
          keys: word.keys,
          chars: chars,
          index: index,
          score: score,
          tier: 1
        };
      });

      var sorted = list.slice().sort(function (a, b) {
        return a.score - b.score || a.index - b.index;
      });
      var total = sorted.length;
      sorted.forEach(function (word, rank) {
        var ratio = rank / total;
        if (ratio < 0.3) word.tier = 1;
        else if (ratio < 0.55) word.tier = 2;
        else if (ratio < 0.78) word.tier = 3;
        else if (ratio < 0.92) word.tier = 4;
        else word.tier = 5;
      });

      WORDS[modeId] = list;
    });
  }

  /* ---------------- sound ---------------- */

  var Sound = (function () {
    var ctx = null;
    var master = null;
    var noiseBuffer = null;
    var enabled = true;

    function init() {
      if (ctx) return true;
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return false;
      try {
        ctx = new AudioCtor();
        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
        return true;
      } catch (error) {
        ctx = null;
        return false;
      }
    }

    function unlock() {
      if (!enabled) return;
      if (!init()) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(function () { /* ignore */ });
      }
    }

    function setEnabled(value) {
      enabled = Boolean(value);
      if (master) {
        master.gain.setTargetAtTime(enabled ? 0.55 : 0, ctx.currentTime, 0.02);
      }
    }

    function note(freq, duration, options) {
      if (!enabled || !init()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(function () { /* ignore */ });
      var opts = options || {};
      var now = ctx.currentTime + (opts.delay || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = opts.type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (opts.endFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), now + duration);
      }
      var volume = opts.volume == null ? 0.04 : opts.volume;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    }

    function clickNoise(volume) {
      if (!enabled || !init()) return;
      if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
        var data = noiseBuffer.getChannelData(0);
        for (var i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      }
      var now = ctx.currentTime;
      var src = ctx.createBufferSource();
      var filter = ctx.createBiquadFilter();
      var gain = ctx.createGain();
      src.buffer = noiseBuffer;
      filter.type = 'highpass';
      filter.frequency.value = 1800;
      gain.gain.setValueAtTime(volume || 0.018, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(now);
      src.stop(now + 0.03);
    }

    function click(combo) {
      if (!enabled) return;
      var step = (combo || 0) % 8;
      note(520 + step * 34, 0.055, { type: 'triangle', volume: 0.025 });
      clickNoise(0.014);
    }

    function error() {
      note(190, 0.16, { type: 'sawtooth', endFreq: 95, volume: 0.035 });
      clickNoise(0.01);
    }

    function success() {
      [523.25, 659.25, 783.99].forEach(function (freq, index) {
        note(freq, 0.22, { type: 'triangle', volume: 0.045, delay: index * 0.065 });
      });
    }

    function combo() {
      note(880, 0.11, { type: 'sine', volume: 0.035 });
      note(1174.66, 0.15, { type: 'sine', volume: 0.03, delay: 0.07 });
    }

    function countdown(isGo) {
      if (isGo) {
        [523.25, 659.25, 783.99].forEach(function (freq, index) {
          note(freq, 0.26, { type: 'triangle', volume: 0.045, delay: index * 0.035 });
        });
      } else {
        note(440, 0.1, { type: 'sine', volume: 0.03 });
      }
    }

    function fanfare() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (freq, index) {
        note(freq, 0.38, { type: 'triangle', volume: 0.042, delay: index * 0.085 });
      });
      note(261.63, 0.7, { type: 'sine', volume: 0.03, delay: 0.1 });
    }

    function levelUp() {
      [659.25, 783.99, 987.77, 1318.5].forEach(function (freq, index) {
        note(freq, 0.3, { type: 'sine', volume: 0.038, delay: index * 0.07 });
      });
    }

    return {
      unlock: unlock,
      setEnabled: setEnabled,
      click: click,
      error: error,
      success: success,
      combo: combo,
      countdown: countdown,
      fanfare: fanfare,
      levelUp: levelUp
    };
  }());

  /* ---------------- state and elements ---------------- */

  var state = {
    profile: loadProfile(),
    screen: 'home',
    modeId: null,
    session: null,
    current: null,
    locked: true,
    lastInputWasError: false,
    countdownActive: false,
    countdownTimers: [],
    transitionTimer: null,
    hintTimer: null,
    lastFocused: null
  };

  var el = {
    homeScreen: $('homeScreen'),
    gameScreen: $('gameScreen'),
    resultScreen: $('resultScreen'),
    brandBtn: $('brandBtn'),
    totalStars: $('totalStars'),
    soundBtn: $('soundBtn'),
    resetBtn: $('resetBtn'),
    zhLevel: $('zhLevel'),
    zhSeen: $('zhSeen'),
    zhStars: $('zhStars'),
    zhProgress: $('zhProgress'),
    enLevel: $('enLevel'),
    enSeen: $('enSeen'),
    enStars: $('enStars'),
    enProgress: $('enProgress'),
    homeStars: $('homeStars'),
    homeSessions: $('homeSessions'),
    homeCombo: $('homeCombo'),
    backBtn: $('backBtn'),
    gameModeName: $('gameModeName'),
    gameLevel: $('gameLevel'),
    roundBar: $('roundBar'),
    roundCount: $('roundCount'),
    gameStars: $('gameStars'),
    coachBubble: $('coachBubble'),
    coachFox: $('coachFox'),
    comboWrap: $('comboWrap'),
    comboCount: $('comboCount'),
    promptCard: $('promptCard'),
    promptBadge: $('promptBadge'),
    wordStage: $('wordStage'),
    keyDots: $('keyDots'),
    typedPreview: $('typedPreview'),
    feedback: $('feedback'),
    hintBtn: $('hintBtn'),
    keyboardRows: $('keyboardRows'),
    nextKeyText: $('nextKeyText'),
    keyboard: document.querySelector('.keyboard'),
    countdown: $('countdown'),
    countdownLabel: $('countdownLabel'),
    countdownNumber: $('countdownNumber'),
    countdownMode: $('countdownMode'),
    resetModal: $('resetModal'),
    resetCancel: $('resetCancel'),
    resetConfirm: $('resetConfirm'),
    toastLayer: $('toastLayer'),
    sparkLayer: $('sparkLayer'),
    confettiLayer: $('confettiLayer'),
    resultMedal: $('resultMedal'),
    medalStars: $('medalStars'),
    resultTitle: $('resultTitle'),
    resultSubtitle: $('resultSubtitle'),
    resultAccuracy: $('resultAccuracy'),
    resultCpm: $('resultCpm'),
    resultCombo: $('resultCombo'),
    resultStars: $('resultStars'),
    resultLevelBanner: $('resultLevelBanner'),
    levelBannerText: $('levelBannerText'),
    resultNewWords: $('resultNewWords'),
    resultReviewWords: $('resultReviewWords'),
    playAgainBtn: $('playAgainBtn'),
    resultHomeBtn: $('resultHomeBtn')
  };

  /* ---------------- home ---------------- */

  function countSeen(mode) {
    return Object.keys(mode.words).filter(function (key) {
      return mode.words[key] && mode.words[key].seen > 0;
    }).length;
  }

  function updateStarBank() {
    el.totalStars.textContent = state.profile.modes.zh.stars + state.profile.modes.en.stars;
  }

  function renderHome() {
    var zh = state.profile.modes.zh;
    var en = state.profile.modes.en;
    var zhSeen = countSeen(zh);
    var enSeen = countSeen(en);

    el.zhLevel.textContent = getLevel(zh.level);
    el.zhSeen.textContent = zhSeen;
    el.zhStars.textContent = zh.stars;
    el.zhProgress.style.width = ((zhSeen / WORDS.zh.length) * 100).toFixed(2) + '%';

    el.enLevel.textContent = getLevel(en.level);
    el.enSeen.textContent = enSeen;
    el.enStars.textContent = en.stars;
    el.enProgress.style.width = ((enSeen / WORDS.en.length) * 100).toFixed(2) + '%';

    el.homeStars.textContent = zh.stars + en.stars;
    el.homeSessions.textContent = zh.sessions + en.sessions;
    el.homeCombo.textContent = Math.max(zh.bestCombo, en.bestCombo);
    updateStarBank();
  }

  /* ---------------- screens ---------------- */

  function showScreen(name) {
    clearToasts();
    clearConfetti();
    state.screen = name;
    el.homeScreen.classList.toggle('is-active', name === 'home');
    el.gameScreen.classList.toggle('is-active', name === 'game');
    el.resultScreen.classList.toggle('is-active', name === 'result');
    el.homeScreen.setAttribute('aria-hidden', name === 'home' ? 'false' : 'true');
    el.gameScreen.setAttribute('aria-hidden', name === 'game' ? 'false' : 'true');
    el.resultScreen.setAttribute('aria-hidden', name === 'result' ? 'false' : 'true');
    document.body.classList.remove('on-home', 'on-game', 'on-result');
    document.body.classList.add('on-' + name);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function goHome() {
    clearSessionTimers();
    hideCountdown();
    state.locked = true;
    state.session = null;
    state.current = null;
    state.modeId = null;
    renderHome();
    showScreen('home');
    el.promptCard.classList.remove('is-success', 'is-shaking');
    resetCoach();
  }

  /* ---------------- session selection ---------------- */

  function wordWeight(word, stats, session, currentLevel) {
    var weight = 1;
    if (!stats || !stats.seen) {
      weight = 5.2;
    } else {
      var wrong = stats.wrong || 0;
      var mastery = stats.mastery || 0;
      weight = 1.15 + Math.min(wrong, 5) * 1.55 + (3 - Math.min(mastery, 3)) * 0.5;
      if (stats.streak >= 3) weight *= 0.55;
      var age = Date.now() - (stats.lastSeen || 0);
      if (age < 60 * 60 * 1000) weight *= 0.55;
      else if (age < 24 * 60 * 60 * 1000) weight *= 0.8;
    }
    if (word.tier === currentLevel) weight *= 1.45;
    if (word.tier < currentLevel - 1) weight *= 0.82;
    if (session && session.words.indexOf(word) !== -1) weight = 0;
    return weight;
  }

  function weightedPick(pool, weights) {
    var total = weights.reduce(function (sum, value) { return sum + value; }, 0);
    if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
    var target = Math.random() * total;
    var running = 0;
    for (var i = 0; i < pool.length; i += 1) {
      running += weights[i];
      if (target <= running) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function selectWords(modeId, level) {
    var modeStats = state.profile.modes[modeId].words;
    var source = WORDS[modeId].filter(function (word) {
      return word.tier <= level;
    });
    var picked = [];
    var guard = 0;

    while (picked.length < SESSION_SIZE && guard < 2000) {
      guard += 1;
      var available = source.filter(function (word) {
        return picked.indexOf(word) === -1;
      });
      if (!available.length) break;
      var weights = available.map(function (word) {
        return wordWeight(word, modeStats[word.text], null, level);
      });
      var chosen = weightedPick(available, weights);
      if (picked.indexOf(chosen) === -1) picked.push(chosen);
    }

    // Extremely defensive fallback: if a level somehow has too few words.
    if (picked.length < SESSION_SIZE) {
      var all = WORDS[modeId].filter(function (word) {
        return picked.indexOf(word) === -1;
      });
      while (picked.length < SESSION_SIZE && all.length) {
        picked.push(all.splice(Math.floor(Math.random() * all.length), 1)[0]);
      }
    }

    // Put an easy/review word first, then shuffle the rest for variety.
    picked.sort(function () { return Math.random() - 0.5; });
    return picked.slice(0, SESSION_SIZE);
  }

  function createSession(modeId) {
    var level = state.profile.modes[modeId].level;
    var words = selectWords(modeId, level);
    return {
      modeId: modeId,
      words: words,
      index: 0,
      results: [],
      correctKeys: 0,
      totalKeys: 0,
      errors: 0,
      combo: 0,
      maxCombo: 0,
      stars: 0,
      typingMs: 0,
      lastKeyAt: 0,
      startLevel: level,
      startedAt: Date.now()
    };
  }

  /* ---------------- keyboard ---------------- */

  var KEY_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
    [
      { key: ' ', label: '空格', className: 'space', aria: '空格键' },
      { key: "'", label: "'", className: 'punct', aria: '撇号' },
      { key: ',', label: ',', className: 'punct', aria: '逗号' },
      { key: '.', label: '.', className: 'punct', aria: '句号' },
      { key: '!', label: '!', className: 'punct', aria: '感叹号' },
      { key: '?', label: '?', className: 'punct', aria: '问号' },
      { key: '(', label: '(', className: 'punct', aria: '左括号' },
      { key: ')', label: ')', className: 'punct', aria: '右括号' }
    ]
  ];

  function buildKeyboard() {
    var fragment = document.createDocumentFragment();
    KEY_ROWS.forEach(function (row) {
      var rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      row.forEach(function (item) {
        var info = typeof item === 'string' ? { key: item, label: item } : item;
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'kb-key' + (info.className ? ' ' + info.className : '');
        button.dataset.key = info.key;
        button.textContent = info.label;
        button.setAttribute('aria-label', info.aria || ('按键 ' + displayKey(info.key)));
        button.addEventListener('click', function () {
          handleTypedKey(info.key);
          button.blur();
        });
        rowEl.appendChild(button);
      });
      fragment.appendChild(rowEl);
    });
    el.keyboardRows.appendChild(fragment);
  }

  function findKeyButton(key) {
    var buttons = el.keyboardRows.querySelectorAll('.kb-key');
    for (var i = 0; i < buttons.length; i += 1) {
      if (buttons[i].dataset.key === key) return buttons[i];
    }
    return null;
  }

  function expectedKey() {
    if (state.locked || !state.current || state.screen !== 'game') return null;
    var key = state.current.word.keys[state.current.keyIndex];
    return key == null ? null : key;
  }

  function updateKeyboard() {
    var next = expectedKey();
    var buttons = el.keyboardRows.querySelectorAll('.kb-key');
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].classList.toggle('is-next', next !== null && buttons[i].dataset.key === next);
    }
    el.nextKeyText.textContent = next === null ? '这一词完成啦' : '下一个键会发光';
  }

  function flashKey(key) {
    var button = findKeyButton(key);
    if (!button) return;
    button.classList.remove('is-hint');
    void button.offsetWidth;
    button.classList.add('is-hint');
    window.setTimeout(function () {
      button.classList.remove('is-hint');
    }, 1600);
  }

  function pressKeyVisual(key) {
    var button = findKeyButton(key);
    if (!button) return;
    button.classList.add('is-pressed');
    window.setTimeout(function () {
      button.classList.remove('is-pressed');
    }, 110);
  }

  /* ---------------- prompt rendering ---------------- */

  function currentWord() {
    return state.current ? state.current.word : null;
  }

  function getCharRanges(word) {
    var starts = [];
    var cursor = 0;
    word.pinyin.forEach(function (pinyin) {
      starts.push({ start: cursor, end: cursor + stripTone(pinyin).length });
      cursor += stripTone(pinyin).length;
    });
    return starts;
  }

  function activeHanziIndex(word, keyIndex) {
    var ranges = getCharRanges(word);
    for (var i = 0; i < ranges.length; i += 1) {
      if (keyIndex >= ranges[i].start && keyIndex < ranges[i].end) return i;
    }
    return -1;
  }

  function renderWordStage() {
    if (!state.current) return;
    var word = currentWord();
    var keyIndex = state.current.keyIndex;
    var html = '';

    if (state.modeId === 'zh') {
      var ranges = getCharRanges(word);
      var active = activeHanziIndex(word, keyIndex);
      var justDone = active > 0 && keyIndex === ranges[active].start ? active - 1 : -1;
      html += '<div class="word word-zh" aria-hidden="true">';
      word.chars.forEach(function (char, index) {
        var isDone = keyIndex >= ranges[index].end;
        var isCurrent = index === active;
        var classes = 'hanzi-unit';
        if (isDone) classes += ' done';
        if (isCurrent) classes += ' current';
        if (index === justDone) classes += ' just-done';
        html += '<span class="' + classes + '">';
        html += '<span class="pinyin">' + escapeHtml(word.pinyin[index]) + '</span>';
        html += '<span class="hanzi">' + escapeHtml(char) + '</span>';
        html += '</span>';
      });
      html += '</div>';
      el.wordStage.setAttribute('aria-label', '词语：' + word.text + '。拼音：' + word.pinyin.join(' ') + '。');
    } else {
      var sizeClass = '';
      if (word.chars.length > 18) sizeClass = ' xlong';
      else if (word.chars.length > 12) sizeClass = ' long';
      html += '<div class="word word-en' + sizeClass + '" aria-hidden="true">';
      word.chars.forEach(function (char, index) {
        var classes = 'glyph';
        if (char === ' ') classes += ' space';
        if (index < keyIndex) classes += ' done';
        if (index === keyIndex) classes += ' current';
        html += '<span class="' + classes + '">' + (char === ' ' ? '&nbsp;' : escapeHtml(char)) + '</span>';
      });
      html += '</div>';
      el.wordStage.setAttribute('aria-label', '请打出：' + word.text);
    }

    el.wordStage.innerHTML = html;
  }

  function renderKeyDots() {
    var word = currentWord();
    if (!word) return;
    var keyIndex = state.current.keyIndex;
    var starts = {};
    if (state.modeId === 'zh' && word.pinyin) {
      var cursor = 0;
      word.pinyin.forEach(function (pinyin, index) {
        if (index > 0) starts[cursor] = true;
        cursor += stripTone(pinyin).length;
      });
    }

    var html = '';
    for (var i = 0; i < word.keys.length; i += 1) {
      var classes = 'key-dot';
      if (starts[i]) classes += ' dot-start';
      if (i < keyIndex) classes += ' done';
      if (i === keyIndex) classes += ' current';
      html += '<span class="' + classes + '"></span>';
    }
    el.keyDots.innerHTML = html;
  }

  function renderTypedPreview() {
    var word = currentWord();
    if (!word) return;
    var typed = word.keys.slice(0, state.current.keyIndex);
    if (!typed) {
      el.typedPreview.textContent = state.modeId === 'zh' ? '像 shanpo 这样连起来打…' : '等待第一个键…';
      el.typedPreview.classList.add('is-empty');
    } else {
      var trimmed = typed.length > 32 ? '…' + typed.slice(-31) : typed;
      el.typedPreview.textContent = trimmed;
      el.typedPreview.classList.remove('is-empty');
    }
  }

  function renderRoundHeader() {
    var session = state.session;
    if (!session) return;
    el.gameModeName.textContent = MODES[session.modeId].name;
    el.gameLevel.textContent = getLevel(state.profile.modes[session.modeId].level);
    el.roundCount.textContent = (session.index + 1) + ' / ' + session.words.length;
    el.roundBar.style.width = (((session.index + 1) / session.words.length) * 100).toFixed(2) + '%';
    el.gameStars.textContent = session.stars;
  }

  function setFeedback(text, type) {
    el.feedback.textContent = text;
    el.feedback.classList.remove('is-good', 'is-bad', 'is-hint');
    if (type) el.feedback.classList.add('is-' + type);
    if (type === 'good' || type === 'bad' || type === 'hint') {
      void el.feedback.offsetWidth;
      el.feedback.classList.add('is-' + type);
    }
  }

  function setCoach(text, type) {
    el.coachBubble.innerHTML = text;
    el.coachBubble.classList.remove('is-cheer', 'is-oops');
    if (type === 'cheer') el.coachBubble.classList.add('is-cheer');
    if (type === 'oops') el.coachBubble.classList.add('is-oops');
  }

  function resetCoach() {
    el.coachBubble.classList.remove('is-cheer', 'is-oops');
    if (el.coachFox) el.coachFox.classList.remove('is-happy', 'is-oops');
  }

  function defaultFeedback() {
    if (state.modeId === 'zh') return '照着拼音连起来敲，不用加空格。';
    return '看清楚字母，大小写都可以。';
  }

  function defaultCoach() {
    if (state.modeId === 'zh') return '照着拼音，敲出字母。<br>小键盘会亮起下一个键！';
    return '读一读，再敲一敲。<br>小键盘会亮起下一个键！';
  }

  function renderPrompt() {
    var word = currentWord();
    if (!word) return;
    renderRoundHeader();
    renderWordStage();
    renderKeyDots();
    renderTypedPreview();
    updateKeyboard();

    el.promptBadge.textContent = state.modeId === 'zh' ? MODES.zh.prompt : MODES.en.prompt;
    if (state.modeId === 'zh' && word.pinyin && word.pinyin.some(function (p) { return /[üǖǘǚǜ]/.test(p); })) {
      el.promptBadge.textContent = '看拼音 · ü 用 V 键打';
    }

    setCoach(defaultCoach(), '');
    setFeedback(defaultFeedback(), '');
    updateComboDisplay();
  }

  function loadPrompt() {
    var session = state.session;
    if (!session) return;
    var word = session.words[session.index];
    if (!word) return;
    var now = performance.now();
    state.current = {
      word: word,
      errors: 0,
      keyIndex: 0,
      startAt: now,
      lastInputAt: now
    };
    state.lastInputWasError = false;
    session.lastKeyAt = now;
    renderPrompt();
    resetCoach();
    if (state.modeId === 'zh' && word.pinyin && word.pinyin.some(function (p) { return /[üǖǘǚǜ]/.test(p); })) {
      setCoach('小提示：拼音里的 ü，<br>请用键盘上的 V 键来打。', '');
    }
  }

  function updateComboDisplay() {
    var session = state.session;
    if (!session) return;
    el.comboCount.textContent = session.combo;
    el.comboWrap.classList.toggle('is-visible', session.combo >= 3);
    el.comboWrap.classList.remove('is-hot');
    if (session.combo >= 3) {
      void el.comboWrap.offsetWidth;
      el.comboWrap.classList.add('is-hot');
    }
  }

  /* ---------------- countdown ---------------- */

  function clearCountdownTimers() {
    state.countdownTimers.forEach(function (timer) {
      window.clearTimeout(timer);
    });
    state.countdownTimers = [];
  }

  function hideCountdown() {
    state.countdownActive = false;
    clearCountdownTimers();
    el.countdown.hidden = true;
  }

  function showCountdown(modeId, done) {
    hideCountdown();
    state.countdownActive = true;
    el.countdown.hidden = false;
    el.countdownMode.textContent = MODES[modeId].name;
    el.countdownLabel.textContent = modeId === 'zh' ? '准备种树' : 'Ready to explore';
    var steps = [
      { number: '3', go: false },
      { number: '2', go: false },
      { number: '1', go: false },
      { number: '开始！', go: true }
    ];
    var index = 0;

    function nextStep() {
      if (!state.countdownActive) return;
      var step = steps[index];
      el.countdownNumber.textContent = step.number;
      el.countdownNumber.classList.toggle('is-go', step.go);
      el.countdownNumber.style.animation = 'none';
      void el.countdownNumber.offsetWidth;
      el.countdownNumber.style.animation = '';
      Sound.countdown(step.go);
      index += 1;
      if (index < steps.length) {
        state.countdownTimers.push(window.setTimeout(nextStep, 560));
      } else {
        state.countdownTimers.push(window.setTimeout(function () {
          if (!state.countdownActive) return;
          state.countdownActive = false;
          el.countdown.hidden = true;
          state.countdownTimers = [];
          done();
        }, 610));
      }
    }

    nextStep();
  }

  /* ---------------- game start / stop ---------------- */

  function clearSessionTimers() {
    clearCountdownTimers();
    if (state.transitionTimer) {
      window.clearTimeout(state.transitionTimer);
      state.transitionTimer = null;
    }
    if (state.hintTimer) {
      window.clearTimeout(state.hintTimer);
      state.hintTimer = null;
    }
    state.countdownActive = false;
  }

  function startMode(modeId) {
    if (!MODES[modeId] || !WORDS[modeId].length) return;
    if (state.screen === 'game') return;
    clearSessionTimers();
    Sound.unlock();
    state.modeId = modeId;
    state.session = createSession(modeId);
    state.locked = true;
    state.current = null;
    document.body.classList.remove('on-home', 'on-result');
    showScreen('game');
    el.gameLevel.textContent = getLevel(state.profile.modes[modeId].level);
    el.gameStars.textContent = '0';
    el.comboWrap.classList.remove('is-visible');
    el.promptBadge.textContent = MODES[modeId].prompt;
    loadPrompt();
    state.locked = true;
    updateKeyboard();
    showCountdown(modeId, function () {
      if (state.screen !== 'game' || !state.session) return;
      state.locked = false;
      var now = performance.now();
      if (state.current) state.current.startAt = now;
      state.session.lastKeyAt = now;
      setFeedback(state.modeId === 'zh' ? '出发！拼音连起来敲，不用空格。' : 'Go! 大小写都可以，大胆敲。', 'good');
      setCoach(state.modeId === 'zh' ? '手指放好啦，开始！<br>每个键都会发光。' : 'Here we go!<br>You can do it!', 'cheer');
      updateKeyboard();
    });
  }

  function leaveGame() {
    clearSessionTimers();
    hideCountdown();
    state.locked = true;
    state.session = null;
    state.current = null;
    state.modeId = null;
    resetCoach();
    renderHome();
    showScreen('home');
  }

  /* ---------------- typing logic ---------------- */

  function addTypingTime() {
    var session = state.session;
    if (!session) return;
    var now = performance.now();
    if (session.lastKeyAt) {
      session.typingMs += Math.min(Math.max(now - session.lastKeyAt, 0), 3000);
    }
    session.lastKeyAt = now;
    if (state.current) state.current.lastInputAt = now;
  }

  function handleTypedKey(key) {
    if (state.screen !== 'game' || state.locked || state.countdownActive) return;
    if (!state.current || !state.session) return;
    if (typeof key !== 'string' || key.length !== 1) return;
    if (/^[\u0000-\u001f]$/.test(key)) return;

    var expected = state.current.word.keys[state.current.keyIndex];
    if (expected == null) return;
    addTypingTime();

    var isLetterExpected = /^[a-z]$/i.test(expected);
    var isLetterTyped = /^[a-z]$/i.test(key);
    var matches = isLetterExpected && isLetterTyped
      ? expected.toLowerCase() === key.toLowerCase()
      : expected === key;

    state.session.totalKeys += 1;

    if (matches) {
      handleCorrectKey(key, expected);
    } else {
      handleWrongKey(key, expected);
    }
  }

  function handleCorrectKey(typed, expected) {
    var session = state.session;
    var current = state.current;
    var word = current.word;
    var wasError = state.lastInputWasError;

    state.lastInputWasError = false;
    current.keyIndex += 1;
    session.correctKeys += 1;
    session.combo += 1;
    session.maxCombo = Math.max(session.maxCombo, session.combo);
    Sound.click(session.combo);
    pressKeyVisual(expected);
    vibrate(8);

    renderWordStage();
    renderKeyDots();
    renderTypedPreview();
    updateKeyboard();
    updateComboDisplay();

    if (wasError) {
      setFeedback('对啦！就是这样。', 'good');
      setCoach('就是这样！你找到感觉啦。', 'cheer');
    }

    if (session.combo > 0 && session.combo % 10 === 0) {
      Sound.combo();
      showToast('连击 ' + session.combo + '！🔥', { gold: true });
      setCoach(randomFrom(MODES[state.modeId].cheers), 'cheer');
      el.coachFox.classList.remove('is-happy');
      void el.coachFox.offsetWidth;
      el.coachFox.classList.add('is-happy');
    }

    if (current.keyIndex >= word.keys.length) {
      completeWord();
    }
  }

  function handleWrongKey(typed, expected) {
    var session = state.session;
    var current = state.current;

    current.errors += 1;
    session.errors += 1;
    session.combo = 0;
    state.lastInputWasError = true;
    Sound.error();
    vibrate([20, 30, 20]);

    if (el.comboWrap) {
      el.comboWrap.classList.remove('is-visible', 'is-hot');
    }

    el.promptCard.classList.remove('is-shaking');
    void el.promptCard.offsetWidth;
    el.promptCard.classList.add('is-shaking');
    window.setTimeout(function () {
      el.promptCard.classList.remove('is-shaking');
    }, 420);

    el.coachFox.classList.remove('is-happy', 'is-oops');
    void el.coachFox.offsetWidth;
    el.coachFox.classList.add('is-oops');
    window.setTimeout(function () {
      el.coachFox.classList.remove('is-oops');
    }, 620);

    setFeedback('哎呀，下一个是' + keyHintText(expected) + '，再试一次～', 'bad');
    setCoach('没关系，看看发光的小键盘。<br>慢慢来，一定行！', 'oops');
    updateComboDisplay();
    updateKeyboard();

    if (current.errors >= 2) {
      flashKey(expected);
      setFeedback('看见发光的' + keyHintText(expected) + '了吗？按它！', 'hint');
    }
  }

  function completeWord() {
    var session = state.session;
    var current = state.current;
    var word = current.word;
    var errors = current.errors;
    var stars = errors === 0 ? 3 : (errors <= 2 ? 2 : 1);
    var mode = state.profile.modes[state.modeId];

    state.locked = true;
    session.stars += stars;
    mode.stars += stars;

    var stats = mode.words[word.text];
    if (!stats) {
      stats = {
        seen: 0,
        correct: 0,
        wrong: 0,
        streak: 0,
        mastery: 0,
        lastSeen: 0
      };
      mode.words[word.text] = stats;
    }
    stats.seen += 1;
    stats.correct += 1;
    stats.wrong += errors;
    stats.lastSeen = Date.now();
    if (errors === 0) {
      stats.streak += 1;
      stats.mastery = clamp(stats.mastery + 2, 0, 5);
    } else if (errors <= 2) {
      stats.streak = 0;
      stats.mastery = clamp(stats.mastery + 1, 0, 5);
    } else {
      stats.streak = 0;
      stats.mastery = clamp(stats.mastery - 1, 0, 5);
    }

    session.results.push({
      text: word.text,
      errors: errors,
      stars: stars
    });

    saveProfile();
    updateStarBank();
    el.gameStars.textContent = session.stars;

    renderWordStage();
    renderKeyDots();
    renderTypedPreview();
    updateKeyboard();
    updateComboDisplay();

    el.promptCard.classList.remove('is-success');
    void el.promptCard.offsetWidth;
    el.promptCard.classList.add('is-success');
    sparkBurst(el.wordStage);
    floatReward('+' + stars + ' ⭐');

    Sound.success();
    el.coachFox.classList.remove('is-oops');
    el.coachFox.classList.add('is-happy');
    setCoach(randomFrom(MODES[state.modeId].success), 'cheer');

    if (errors === 0) {
      setFeedback('完美！一次就打对了，+' + stars + ' 颗星。', 'good');
    } else if (errors <= 2) {
      setFeedback('完成啦！只差一点点，+' + stars + ' 颗星。', 'good');
    } else {
      setFeedback('坚持打完啦！+' + stars + ' 颗星，下轮会更顺。', 'good');
    }

    state.transitionTimer = window.setTimeout(function () {
      state.transitionTimer = null;
      if (state.screen !== 'game' || !state.session) return;
      state.session.index += 1;
      if (state.session.index >= state.session.words.length) {
        finishSession();
      } else {
        el.typedPreview.textContent = '';
        loadPrompt();
        state.locked = false;
        updateKeyboard();
      }
    }, 1050);
  }

  /* ---------------- finish and results ---------------- */

  function finishSession() {
    var session = state.session;
    if (!session) return;
    state.locked = true;
    var mode = state.profile.modes[session.modeId];
    var accuracy = session.totalKeys > 0 ? session.correctKeys / session.totalKeys : 1;
    var cpm = session.typingMs > 0 ? Math.round(session.correctKeys / (session.typingMs / 60000)) : 0;
    var cleanWords = session.results.filter(function (item) { return item.errors <= 1; }).length;
    var roughWords = session.results.filter(function (item) { return item.errors >= 3; }).length;
    var oldLevel = mode.level;
    var direction = 0;

    if (accuracy >= 0.9 && cleanWords >= 8 && oldLevel < 5) {
      mode.level += 1;
      direction = 1;
    } else if ((accuracy < 0.62 || roughWords >= 3) && oldLevel > 1) {
      mode.level -= 1;
      direction = -1;
    }

    mode.sessions += 1;
    mode.bestCombo = Math.max(mode.bestCombo, session.maxCombo);
    saveProfile();
    updateStarBank();

    session.summary = {
      accuracy: accuracy,
      cpm: cpm,
      oldLevel: oldLevel,
      newLevel: mode.level,
      direction: direction
    };

    renderResult(session);
    showScreen('result');
    Sound.fanfare();
    if (direction === 1) {
      window.setTimeout(function () {
        if (state.screen === 'result') Sound.levelUp();
      }, 500);
    }
    window.setTimeout(function () {
      if (state.screen === 'result') {
        burstConfetti(direction === 1 ? 85 : 60);
      }
    }, 260);

    state.session = session;
  }

  function renderResult(session) {
    var summary = session.summary;
    var results = session.results;
    var accuracy = Math.round(summary.accuracy * 100);
    var medal = 1;
    if (session.stars >= 27 && accuracy >= 95) medal = 3;
    else if (session.stars >= 18) medal = 2;

    var title = medal === 3 ? '星光闪闪！' : (medal === 2 ? '太棒啦！' : '完成一轮！');
    var subtitle = medal === 3
      ? '你就是今天的小森林之星'
      : (medal === 2 ? '小树又长高了一点点' : '慢慢来，每一次都在进步');

    el.resultTitle.textContent = title;
    el.resultSubtitle.textContent = subtitle;
    el.resultMedal.textContent = medal === 3 ? '🏆' : (medal === 2 ? '🏅' : '🌱');
    el.resultAccuracy.textContent = accuracy + '%';
    el.resultCpm.textContent = summary.cpm;
    el.resultCombo.textContent = session.maxCombo;
    el.resultStars.textContent = session.stars;

    var starHtml = '';
    for (var i = 0; i < 3; i += 1) {
      starHtml += '<span class="' + (i < medal ? 'is-lit' : '') + '" style="animation-delay:' + (i * 0.13) + 's">★</span>';
    }
    el.medalStars.innerHTML = starHtml;
    el.medalStars.setAttribute('aria-label', '本轮获得 ' + medal + ' 颗评价星');

    el.resultLevelBanner.classList.remove('is-up', 'is-down');
    if (summary.direction === 1) {
      el.resultLevelBanner.classList.add('is-up');
      el.resultLevelBanner.querySelector('.level-banner-icon').textContent = '🌟';
      el.levelBannerText.textContent = '升级啦！从「' + getLevelName(summary.oldLevel) + '」长成了「' + getLevelName(summary.newLevel) + '」！';
    } else if (summary.direction === -1) {
      el.resultLevelBanner.classList.add('is-down');
      el.resultLevelBanner.querySelector('.level-banner-icon').textContent = '🍃';
      el.levelBannerText.textContent = '我们把难度调低了一点，稳稳地来，下次再长高。';
    } else if (summary.newLevel >= 5) {
      el.resultLevelBanner.querySelector('.level-banner-icon').textContent = '🌲';
      el.levelBannerText.textContent = '已经在最高等级「大树」啦，继续收集星星吧！';
    } else {
      el.resultLevelBanner.querySelector('.level-banner-icon').textContent = '🌿';
      el.levelBannerText.textContent = '小树又长高了一点，下一次也许就升级啦。';
    }

    var clean = results.filter(function (item) { return item.errors === 0; });
    var review = results.filter(function (item) { return item.errors > 0; });
    fillChips(el.resultNewWords, clean, false);
    fillChips(el.resultReviewWords, review, true);

    el.playAgainBtn.dataset.mode = session.modeId;
    window.setTimeout(function () {
      if (state.screen !== 'result') return;
      el.resultTitle.setAttribute('tabindex', '-1');
      el.resultTitle.focus({ preventScroll: true });
    }, 120);
  }

  function fillChips(container, items, review) {
    if (!items.length) {
      container.innerHTML = '<span class="word-chip is-none">' +
        (review ? '没有需要复习的词，太棒了！' : '这一局有点挑战，下次更稳！') +
        '</span>';
      return;
    }
    container.innerHTML = items.slice(0, 10).map(function (item) {
      return '<span class="word-chip' + (review ? ' is-review' : '') + '">' + escapeHtml(item.text) + '</span>';
    }).join('');
  }

  /* ---------------- effects ---------------- */

  function showToast(text, options) {
    var opts = options || {};
    clearToasts();
    var toast = document.createElement('div');
    toast.className = 'toast' + (opts.gold ? ' is-gold' : '');
    toast.textContent = text;
    el.toastLayer.appendChild(toast);
    window.setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2100);
  }

  function clearToasts() {
    if (!el.toastLayer) return;
    while (el.toastLayer.firstChild) {
      el.toastLayer.removeChild(el.toastLayer.firstChild);
    }
  }

  function clearConfetti() {
    if (!el.confettiLayer) return;
    while (el.confettiLayer.firstChild) {
      el.confettiLayer.removeChild(el.confettiLayer.firstChild);
    }
  }

  function sparkBurst(anchor) {
    if (!anchor) return;
    var rect = anchor.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height / 2;
    var colors = ['#f0b21e', '#ff8a5c', '#62bd76', '#4aa6dc', '#e58bd5'];
    for (var i = 0; i < 9; i += 1) {
      var spark = document.createElement('span');
      spark.className = 'spark';
      spark.textContent = i % 2 === 0 ? '✦' : '✧';
      spark.style.left = (centerX + (Math.random() * 52 - 26)) + 'px';
      spark.style.top = (centerY + (Math.random() * 26 - 13)) + 'px';
      spark.style.color = colors[i % colors.length];
      spark.style.setProperty('--spark-x', (Math.random() * 100 - 50).toFixed(0) + 'px');
      spark.style.setProperty('--spark-y', (-45 - Math.random() * 65).toFixed(0) + 'px');
      spark.style.animationDelay = (Math.random() * 0.1) + 's';
      el.sparkLayer.appendChild(spark);
      (function (node) {
        window.setTimeout(function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        }, 900);
      }(spark));
    }
  }

  function floatReward(text) {
    var word = el.wordStage.getBoundingClientRect();
    var badge = document.createElement('div');
    badge.className = 'float-reward';
    badge.textContent = text;
    badge.style.left = (word.left + word.width / 2) + 'px';
    badge.style.top = (word.top + word.height / 2 - 10) + 'px';
    el.sparkLayer.appendChild(badge);
    window.setTimeout(function () {
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    }, 1100);
  }

  function burstConfetti(count) {
    var colors = ['#ffd35c', '#ff8a5c', '#62bd76', '#4aa6dc', '#e58bd5', '#8f7ae8', '#ffe9a6'];
    for (var i = 0; i < count; i += 1) {
      var piece = document.createElement('span');
      piece.className = 'confetti';
      piece.style.left = (Math.random() * 100) + '%';
      piece.style.background = colors[i % colors.length];
      piece.style.width = (5 + Math.random() * 7).toFixed(0) + 'px';
      piece.style.height = (9 + Math.random() * 9).toFixed(0) + 'px';
      piece.style.borderRadius = Math.random() > 0.6 ? '50%' : '2px';
      piece.style.setProperty('--drift', (Math.random() * 180 - 90).toFixed(0) + 'px');
      piece.style.setProperty('--spin', (Math.random() * 900 - 450).toFixed(0) + 'deg');
      piece.style.setProperty('--fall-duration', (2.4 + Math.random() * 1.9).toFixed(2) + 's');
      piece.style.setProperty('--fall-delay', (Math.random() * 0.55).toFixed(2) + 's');
      el.confettiLayer.appendChild(piece);
      (function (node) {
        window.setTimeout(function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        }, 5200);
      }(piece));
    }
  }

  /* ---------------- hint ---------------- */

  function showHint() {
    if (state.screen !== 'game' || state.locked || !state.current) return;
    var key = expectedKey();
    if (key == null) return;
    flashKey(key);
    el.keyboard.classList.remove('is-flash');
    void el.keyboard.offsetWidth;
    el.keyboard.classList.add('is-flash');
    el.nextKeyText.textContent = '下一个键：' + displayKey(key);
    setFeedback('下一个键是' + keyHintText(key) + '，它在发光哦。', 'hint');
    setCoach('找不到吗？<br>看小键盘上亮起来的那一个。', '');
    if (state.hintTimer) window.clearTimeout(state.hintTimer);
    state.hintTimer = window.setTimeout(function () {
      el.keyboard.classList.remove('is-flash');
      if (el.nextKeyText.textContent.indexOf('下一个键：') === 0) {
        el.nextKeyText.textContent = '下一个键会发光';
      }
      state.hintTimer = null;
    }, 2200);
  }

  /* ---------------- reset ---------------- */

  function openResetModal() {
    state.lastFocused = document.activeElement;
    el.resetModal.hidden = false;
    document.body.classList.add('modal-open');
    el.resetCancel.focus();
  }

  function closeResetModal() {
    el.resetModal.hidden = true;
    document.body.classList.remove('modal-open');
    if (state.lastFocused && state.lastFocused.focus) {
      state.lastFocused.focus({ preventScroll: true });
    }
  }

  function resetProgress() {
    var sound = state.profile.sound;
    state.profile = defaultProfile();
    state.profile.sound = sound;
    saveProfile();
    applySoundSetting();
    closeResetModal();
    renderHome();
    showToast('进度清空啦，我们重新出发！');
    Sound.click(0);
  }

  /* ---------------- sound UI ---------------- */

  function applySoundSetting() {
    var on = state.profile.sound !== false;
    document.body.classList.toggle('sound-muted', !on);
    el.soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    el.soundBtn.setAttribute('aria-label', on ? '关闭音效' : '打开音效');
    Sound.setEnabled(on);
  }

  function toggleSound() {
    state.profile.sound = !state.profile.sound;
    saveProfile();
    applySoundSetting();
    if (state.profile.sound) {
      Sound.unlock();
      Sound.click(0);
      showToast('音效打开啦 🔊');
    } else {
      showToast('已静音，专心打字 🤫');
    }
  }

  /* ---------------- events ---------------- */

  function bindEvents() {
    el.brandBtn.addEventListener('click', function () {
      if (state.screen === 'game') leaveGame();
      else if (state.screen === 'result') goHome();
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    el.backBtn.addEventListener('click', leaveGame);
    el.soundBtn.addEventListener('click', toggleSound);
    el.resetBtn.addEventListener('click', openResetModal);
    el.hintBtn.addEventListener('click', showHint);

    var startButtons = document.querySelectorAll('[data-start]');
    for (var i = 0; i < startButtons.length; i += 1) {
      startButtons[i].addEventListener('click', function (event) {
        startMode(event.currentTarget.dataset.start);
      });
    }

    el.playAgainBtn.addEventListener('click', function () {
      startMode(el.playAgainBtn.dataset.mode || 'zh');
    });
    el.resultHomeBtn.addEventListener('click', goHome);

    el.resetCancel.addEventListener('click', closeResetModal);
    el.resetConfirm.addEventListener('click', resetProgress);
    el.resetModal.addEventListener('click', function (event) {
      if (event.target === el.resetModal) closeResetModal();
    });

    document.addEventListener('keydown', function (event) {
      // Reset dialog gets first priority.
      if (!el.resetModal.hidden) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeResetModal();
          return;
        }
        if (event.key === 'Tab') {
          var focusables = [el.resetCancel, el.resetConfirm];
          var currentIndex = focusables.indexOf(document.activeElement);
          if (currentIndex === -1) return;
          event.preventDefault();
          var nextIndex = event.shiftKey
            ? (currentIndex - 1 + focusables.length) % focusables.length
            : (currentIndex + 1) % focusables.length;
          focusables[nextIndex].focus();
        }
        return;
      }

      if (state.screen !== 'game') return;
      if (event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        leaveGame();
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        if (!state.locked) {
          setFeedback('不用退格哦，打对才会向前走～', 'hint');
        }
        return;
      }

      if (event.key === 'Tab' || event.key === 'Enter' || event.key === 'Shift') return;

      if (event.key === ' ' || event.key.length === 1) {
        event.preventDefault();
        if (!event.repeat) handleTypedKey(event.key);
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state.screen === 'game' && state.session) {
        state.session.lastKeyAt = performance.now();
      }
    });

    window.addEventListener('beforeunload', function () {
      saveProfile();
    });
  }

  /* ---------------- boot ---------------- */

  function boot() {
    prepareWords();
    buildKeyboard();
    applySoundSetting();
    renderHome();
    bindEvents();
    showScreen('home');
  }

  boot();
}());
