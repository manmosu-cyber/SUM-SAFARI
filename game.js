const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// UI要素の取得
const menu = document.getElementById('menu');
const countdownEl = document.getElementById('countdown');
const infoEl = document.getElementById('info');
const endButton = document.getElementById('endButton');

const targetEl = document.getElementById('target');
const sumEl = document.getElementById('sum');
const successEl = document.getElementById('success');
const failEl = document.getElementById('fail');
const timeEl = document.getElementById('time');

const recordScreen = document.getElementById('recordScreen');
const recordList = document.getElementById('recordList');
const retryButton = document.getElementById('retryButton');
const backButton = document.getElementById('backButton');

// アプリ説明画面関連
const aboutButton = document.getElementById('aboutButton');
const aboutScreen = document.getElementById('aboutScreen');
const closeAboutButton = document.getElementById('closeAboutButton');

// ==========================================
// ヘルパー関数（セキュリティ対策）
// ==========================================
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// ゲーム基本設定
// ==========================================
const GAME_CONFIG = {
  WALL_THICKNESS: 20,
  ESCAPE_SEGMENT_RATIO: 0.30, // 脱出エリアの幅（単位 画面サイズに対する%）
  ESCAPE_THRESHOLD: 0.8, // 脱出判定の重なり割合（単位 %）

  MAX_NUMBERS: 5,
  TARGET_SUCCESS_COUNT: 3,
  CLICK_LOCK_MS: 500,

  BG_COLOR: "#111",
  WALL_COLOR: "#555",
};

// ==========================================
// 難易度設定（統合・一元管理エリア）
// menuScale: ステージ(1〜5)ごとのスケール
// gameScale: game画面での動物固有の固定スケール
// ==========================================
const DIFFICULTY_CONFIG = {
  turtle: {
    multiplier: 1.1,
    speed: 1.2,
    size: 70,
    menuScale: { 1: 1.30, 2: 1.30, 3: 1.30, 4: 1.30, 5: 1.30 },
    gameScale: 1.20,
    textOffset: { x: -5, y: -5 },
    menuImagePattern: "img/menu_{stage}_turtle.png",
    gameImagePath: "img/game_turtle.png"
  },
  rabbit: {
    multiplier: 1.0,
    speed: 1.8,
    size: 65,
    menuScale: { 1: 1.00, 2: 1.00, 3: 1.00, 4: 1.00, 5: 1.00 },
    gameScale: 1.10,
    textOffset: { x: -5, y: 5 },
    menuImagePattern: "img/menu_{stage}_rabbit.png",
    gameImagePath: "img/game_rabbit.png"
  },
  cheetah: {
    multiplier: 1.0,
    speed: 2.8,
    size: 70,
    menuScale: { 1: 1.10, 2: 1.10, 3: 1.10, 4: 1.10, 5: 1.10 },
    gameScale: 1.10,
    textOffset: { x: 0, y: -8 },
    menuImagePattern: "img/menu_{stage}_cheetah.png",
    gameImagePath: "img/game_cheetah.png"
  },
  falcon: {
    multiplier: 1.2,
    speed: 5.0,
    size: 70,
    menuScale: { 1: 1.10, 2: 1.10, 3: 1.10, 4: 1.10, 5: 1.10 },
    gameScale: 1.00,
    textOffset: { x: 0, y: 5 },
    menuImagePattern: "img/menu_{stage}_falcon.png",
    gameImagePath: "img/game_falcon.png"
  }
};

// スケール取得ヘルパー
function getMenuScale(lv, stage) {
  const conf = DIFFICULTY_CONFIG[lv];
  if (conf && conf.menuScale) {
    return conf.menuScale[stage] || 1.0;
  }
  return 1.0;
}

function getGameScale(lv) {
  const conf = DIFFICULTY_CONFIG[lv];
  if (conf && typeof conf.gameScale === 'number') {
    return conf.gameScale;
  }
  return 1.0;
}

// メニュー用画像パス取得
function getMenuImagePathForLevel(lv, stage) {
  const conf = DIFFICULTY_CONFIG[lv];
  if (!conf || !conf.menuImagePattern) return "";
  return conf.menuImagePattern.replace("{stage}", stage);
}

// ゲーム中用画像パス取得（ステージ非依存）
function getGameImagePathForLevel(lv) {
  const conf = DIFFICULTY_CONFIG[lv];
  if (!conf || !conf.gameImagePath) return "";
  return conf.gameImagePath;
}

const COLORS = {
  1: "#8B4513", 2: "#FF0044", 3: "#FF6600",
  4: "#FFCC00", 5: "#00E676", 6: "#00B0FF",
  7: "#D500F9", 8: "#788898", 9: "#FFFFFF"
};

// 全画像の事前キャッシュ・プリロード処理
const IMAGE_CACHE = {
  menu: {},
  game: {}
};

function preloadAllImages() {
  const levels = Object.keys(DIFFICULTY_CONFIG);
  const promises = [];

  levels.forEach(lv => {
    IMAGE_CACHE.menu[lv] = {};

    // Menu画像（stage 1〜5）プリロード
    for (let stage = 1; stage <= 5; stage++) {
      const menuImg = new Image();
      const menuSrc = getMenuImagePathForLevel(lv, stage);
      promises.push(new Promise(resolve => {
        menuImg.onload = () => resolve();
        menuImg.onerror = () => { console.warn(`Menu画像読込失敗: ${menuSrc}`); resolve(); };
        menuImg.src = menuSrc;
      }));
      IMAGE_CACHE.menu[lv][stage] = menuImg;
    }

    // Game画像（動物ごと固定）プリロード
    const gameImg = new Image();
    const gameSrc = getGameImagePathForLevel(lv);
    promises.push(new Promise(resolve => {
      gameImg.onload = () => resolve();
      gameImg.onerror = () => { console.warn(`Game画像読込失敗: ${gameSrc}`); resolve(); };
      gameImg.src = gameSrc;
    }));
    IMAGE_CACHE.game[lv] = gameImg;
  });

  return Promise.all(promises);
}

// アプリ起動時に全画像をプリロード
preloadAllImages().then(() => {
  console.log("すべての動物画像（menu/game固定）のプリロードが完了しました");
});

// ゲーム内で使用するアクティブな画像参照
const IMAGES = {};
Object.keys(DIFFICULTY_CONFIG).forEach(lv => {
  IMAGES[lv] = IMAGE_CACHE.game[lv] || new Image();
});

let cached3DImages = {};
let animFrameId = null;

// ==========================================
// 状態変数
// ==========================================
let level = null;
let baseSpeed = 2.5;

let numbers = [];
let target = 10;
let currentSum = 0;
let success = 0;
let fail = 0;
let escapedCountTotal = 0;

let effect = {
  active: false,
  type: null,
  start: 0,
  value: 0
};

let capturedAnimations = [];

let startTime = 0;
let gameOver = false;
let ESCAPE_EDGES = {};

function loadRecordsSafely() {
  const defaultRecords = {};
  Object.keys(DIFFICULTY_CONFIG).forEach(lv => {
    defaultRecords[lv] = [];
  });

  try {
    const parsed = JSON.parse(localStorage.getItem('sum_safari_records_v2'));
    if (parsed && typeof parsed === 'object') {
      return { ...defaultRecords, ...parsed };
    }
  } catch (e) {
    console.warn("レコード読み込みエラー。初期化します。");
  }
  return defaultRecords;
}

let records = loadRecordsSafely();

function getAnimalStage(score) {
  const numScore = Number(score) || 0;
  if (numScore < 100) return 1;
  if (numScore < 450) return 2;
  if (numScore < 750) return 3;
  if (numScore < 950) return 4;
  return 5;
}

function getCurrentStageForLevel(lv) {
  const list = records[lv] || [];
  const highScore = list.length > 0 ? (Number(list[0].score) || 0) : 0;
  return getAnimalStage(highScore);
}

function updateMenuUI() {
  const levels = Object.keys(DIFFICULTY_CONFIG);
  levels.forEach(lv => {
    const list = records[lv] || [];
    const highScore = list.length > 0 ? (Number(list[0].score) || 0) : 0;
    const stage = getAnimalStage(highScore);

    const btn = document.querySelector(`#menu button[data-level="${lv}"]`);
    if (btn) {
      const img = btn.querySelector('img');
      if (img) {
        img.src = getMenuImagePathForLevel(lv, stage);
        const scaleVal = getMenuScale(lv, stage); // メニューは従来通りstageごと
        img.style.transform = `scale(${scaleVal})`;
      }
      const scoreSpan = btn.querySelector('.high-score');
      if (scoreSpan) {
        scoreSpan.textContent = highScore > 0 ? `HIGH: ${highScore}pt` : 'HIGH: ---';
      }
    }
  });
}

updateMenuUI();

function resizeCanvas() {
  const infoHeight = infoEl.offsetHeight || 50;
  const endBtnHeight = 60;
  const availableHeight = window.innerHeight - infoHeight - endBtnHeight - 30;
  const availableWidth = window.innerWidth * 0.95;
  
  const size = Math.floor(Math.min(availableWidth, availableHeight));
  canvas.width = Math.max(size, 200);
  canvas.height = Math.max(size, 200);
}

resizeCanvas();

let W = canvas.width;
let H = canvas.height;

window.addEventListener('resize', () => {
  resizeCanvas();
  W = canvas.width;
  H = canvas.height;
  updateEscapeEdges();
  cached3DImages = {};
});

function updateNumberSize(n) {
  const img = IMAGES[level];
  const scale = getGameScale(level); // game画面は動物ごとの固定スケールを使用

  if (!img || !img.complete || img.naturalWidth === 0) {
    n.drawW = n.size * scale;
    n.drawH = n.size * scale;
    return;
  }

  const aspect = img.naturalWidth / img.naturalHeight;
  let drawW = n.size * scale;
  let drawH = n.size * scale;

  if (aspect > 1) {
    drawH = drawW / aspect;
  } else {
    drawW = drawH * aspect;
  }

  n.drawW = drawW;
  n.drawH = drawH;
}

if (aboutButton && aboutScreen && closeAboutButton) {
  aboutButton.addEventListener('click', () => {
    menu.style.display = "none";
    aboutScreen.style.display = "block";
  });

  closeAboutButton.addEventListener('click', () => {
    aboutScreen.style.display = "none";
    menu.style.display = "block";
  });
}

menu.addEventListener('click', e => {
  const btn = e.target.closest('button[data-level]');
  if (!btn) return;

  level = btn.dataset.level;
  const conf = DIFFICULTY_CONFIG[level] || DIFFICULTY_CONFIG.turtle;
  baseSpeed = conf.speed;

  if (IMAGE_CACHE.game[level]) {
    IMAGES[level] = IMAGE_CACHE.game[level];
  }

  cached3DImages = {};

  menu.style.display = "none";
  countdown();
});

function countdown() {
  countdownEl.style.display = "block";
  let count = 3;
  countdownEl.textContent = count;

  const timer = setInterval(() => {
    count--;
    if (count === 0) {
      countdownEl.textContent = "Go!";
    } else if (count < 0) {
      clearInterval(timer);
      countdownEl.style.display = "none";
      startGame();
    } else {
      countdownEl.textContent = count;
    }
  }, 1000);
}

function startGame() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  recordScreen.style.display = "none";

  resizeCanvas();
  W = canvas.width;
  H = canvas.height;
  updateEscapeEdges();
  cached3DImages = {};

  canvas.style.display = "block";
  infoEl.style.display = "block";
  endButton.style.display = "inline-block";

  startTime = performance.now();
  success = 0;
  fail = 0;
  escapedCountTotal = 0;
  currentSum = 0;

  capturedAnimations = [];

  newTarget();
  sumEl.textContent = currentSum;
  successEl.textContent = success;
  failEl.textContent = fail;

  numbers = [];
  for (let i = 0; i < GAME_CONFIG.MAX_NUMBERS; i++) spawnNumber();

  gameOver = false;
  loop();
}

endButton.addEventListener('click', () => {
  finishGame(false);
});

function finishGame(isCleared = false) {
  if (gameOver) return;
  gameOver = true;

  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  const time = parseFloat(((performance.now() - startTime) / 1000).toFixed(1));
  let currentResult = null;

  if (isCleared) {
    const conf = DIFFICULTY_CONFIG[level];
    const mult = conf ? conf.multiplier : 1.0;
    const basePoints = 1000;
    const timePenalty = time * 10;
    const failPenalty = fail * 50;
    const escapePenalty = escapedCountTotal * 3;

    const rawScore = (basePoints - timePenalty - failPenalty - escapePenalty) * mult;
    const score = Math.max(0, Math.floor(rawScore));

    const achievedStage = getAnimalStage(score);
    unlockGalleryItem(level, achievedStage);
    currentResult = { score, time, fail, escaped: escapedCountTotal };

    if (!records[level]) records[level] = [];
    records[level].push(currentResult);
    records[level].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    records[level] = records[level].slice(0, 5);

    try {
      localStorage.setItem('sum_safari_records_v2', JSON.stringify(records));
    } catch (e) {
      console.warn("localStorageへの保存に失敗しました。");
    }
  }

  showRecordScreen(currentResult, isCleared);
}

function newTarget() {
  target = 10 + Math.floor(Math.random() * 10);
  targetEl.textContent = target;
}

function updateEscapeEdges() {
  const wall = GAME_CONFIG.WALL_THICKNESS;
  const seg = W * GAME_CONFIG.ESCAPE_SEGMENT_RATIO;

  ESCAPE_EDGES = {
    topLeft:     { x1: 0,       y1: 0,        x2: seg,     y2: wall },
    topRight:    { x1: W - seg, y1: 0,        x2: W,       y2: wall },
    bottomLeft:  { x1: 0,       y1: H - wall, x2: seg,     y2: H },
    bottomRight: { x1: W - seg, y1: H - wall, x2: W,       y2: H },

    leftTop:     { x1: 0,       y1: 0,        x2: wall,    y2: seg },
    leftBottom:  { x1: 0,       y1: H - seg,  x2: wall,    y2: H },
    rightTop:    { x1: W - wall, y1: 0,       x2: W,       y2: seg },
    rightBottom: { x1: W - wall, y1: H - seg, x2: W,       y2: H }
  };
}

updateEscapeEdges();

function isInEscapeEdge(n) {
  const drawW = n.drawW || n.size;
  const drawH = n.drawH || n.size;
  const halfW = drawW / 2;
  const halfH = drawH / 2;

  const outerLeft   = n.x - halfW;
  const outerRight  = n.x + halfW;
  const outerTop    = n.y - halfH;
  const outerBottom = n.y + halfH;

  const segW = W * GAME_CONFIG.ESCAPE_SEGMENT_RATIO;
  const segH = H * GAME_CONFIG.ESCAPE_SEGMENT_RATIO;
  const wall = GAME_CONFIG.WALL_THICKNESS;
  const threshold = GAME_CONFIG.ESCAPE_THRESHOLD;

  if (outerLeft <= wall && n.vx < 0) {
    const overlapTop = Math.max(0, Math.min(outerBottom, segH) - Math.max(outerTop, 0));
    const overlapBottom = Math.max(0, Math.min(outerBottom, H) - Math.max(outerTop, H - segH));
    if ((overlapTop + overlapBottom) / drawH >= threshold) return true;
  }

  if (outerRight >= W - wall && n.vx > 0) {
    const overlapTop = Math.max(0, Math.min(outerBottom, segH) - Math.max(outerTop, 0));
    const overlapBottom = Math.max(0, Math.min(outerBottom, H) - Math.max(outerTop, H - segH));
    if ((overlapTop + overlapBottom) / drawH >= threshold) return true;
  }

  if (outerTop <= wall && n.vy < 0) {
    const overlapLeft = Math.max(0, Math.min(outerRight, segW) - Math.max(outerLeft, 0));
    const overlapRight = Math.max(0, Math.min(outerRight, W) - Math.max(outerLeft, W - segW));
    if ((overlapLeft + overlapRight) / drawW >= threshold) return true;
  }

  if (outerBottom >= H - wall && n.vy > 0) {
    const overlapLeft = Math.max(0, Math.min(outerRight, segW) - Math.max(outerLeft, 0));
    const overlapRight = Math.max(0, Math.min(outerRight, W) - Math.max(outerLeft, W - segW));
    if ((overlapLeft + overlapRight) / drawW >= threshold) return true;
  }

  return false;
}

function generateSafeNumber() {
  let value;
  let attempts = 0;
  do {
    value = 1 + Math.floor(Math.random() * 9);
    attempts++;
    if (attempts > 100) break;
  } while (numbers.filter(n => n.value === value).length >= 2);
  return value;
}

function spawnNumber() {
  if (numbers.length >= GAME_CONFIG.MAX_NUMBERS) return;

  const value = generateSafeNumber();
  const angle = Math.random() * Math.PI * 2;
  const speed = baseSpeed * (1.0 + Math.random() * 0.6);
  const conf = DIFFICULTY_CONFIG[level];
  const size = conf ? conf.size : 80;

  const n = {
    x: Math.random() * Math.max(W - size * 2, 10) + size,
    y: Math.random() * Math.max(H - size * 2, 10) + size,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    value,
    size,
    id: performance.now() + Math.random()
  };

  updateNumberSize(n);
  numbers.push(n);
}

let clickLocked = false;

function handleClick(mx, my) {
  if (clickLocked || gameOver) return;

  let hitTarget = null;

  numbers.forEach(n => {
    const drawW = n.drawW || n.size;
    const drawH = n.drawH || n.size;

    const halfW = drawW / 2;
    const halfH = drawH / 2;

    if (
      mx >= n.x - halfW &&
      mx <= n.x + halfW &&
      my >= n.y - halfH &&
      my <= n.y + halfH
    ) {
      if (!hitTarget || n.id < hitTarget.id) {
        hitTarget = n;
      }
    }
  });

  if (hitTarget) {
    clickLocked = true;
    setTimeout(() => {
      clickLocked = false;
    }, GAME_CONFIG.CLICK_LOCK_MS);

    capturedAnimations.push({
      x: hitTarget.x,
      y: hitTarget.y,
      value: hitTarget.value,
      drawW: hitTarget.drawW || hitTarget.size,
      drawH: hitTarget.drawH || hitTarget.size,
      size: hitTarget.size,
      start: performance.now(),
      duration: 200
    });

    currentSum += hitTarget.value;
    numbers = numbers.filter(n => n !== hitTarget);
    spawnNumber();
    checkSum();
  }

  sumEl.textContent = currentSum;
}

function getCanvasCoordinates(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

let isTouchDevice = false;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  isTouchDevice = true;
  const coords = getCanvasCoordinates(e);
  handleClick(coords.x, coords.y);
}, { passive: false });

canvas.addEventListener('click', e => {
  if (isTouchDevice) {
    isTouchDevice = false;
    return;
  }
  const coords = getCanvasCoordinates(e);
  handleClick(coords.x, coords.y);
});

function checkSum() {
  if (currentSum > target) {
    fail++;
    failEl.textContent = fail;

    effect.active = true;
    effect.type = "fail";
    effect.start = performance.now();
    effect.value = currentSum;
    effect.text = "FAIL";

    currentSum = 0;
    sumEl.textContent = currentSum;
    newTarget();
    return;
  }

  if (currentSum === target) {
    success++;
    successEl.textContent = success;

    effect.active = true;
    effect.type = "success";
    effect.start = performance.now();
    effect.value = target;
    effect.text = "SUCCESS";

    currentSum = 0;
    sumEl.textContent = currentSum;
    newTarget();

    if (success >= GAME_CONFIG.TARGET_SUCCESS_COUNT) {
      finishGame(true);
    }
    return;
  }
}

function update() {
  if (gameOver) return;

  numbers.forEach(n => {
    n.x += n.vx;
    n.y += n.vy;

    const drawW = n.drawW || n.size;
    const drawH = n.drawH || n.size;
    const halfW = drawW / 2;
    const halfH = drawH / 2;

    const isOutOfBounds = (
      n.x + halfW < 0 || 
      n.x - halfW > W || 
      n.y + halfH < 0 || 
      n.y - halfH > H
    );

    if (isOutOfBounds) {
      n.escaped = true;
      return;
    }

    if (n.isEscaping || isInEscapeEdge(n)) {
      n.isEscaping = true;
      return;
    }

    const wall = GAME_CONFIG.WALL_THICKNESS;
    if (n.x - halfW < wall && n.vx < 0) {
      n.vx = Math.abs(n.vx);
      n.x = wall + halfW;
    }
    if (n.x + halfW > W - wall && n.vx > 0) {
      n.vx = -Math.abs(n.vx);
      n.x = W - wall - halfW;
    }
    if (n.y - halfH < wall && n.vy < 0) {
      n.vy = Math.abs(n.vy);
      n.y = wall + halfH;
    }
    if (n.y + halfH > H - wall && n.vy > 0) {
      n.vy = -Math.abs(n.vy);
      n.y = H - wall - halfH;
    }
  });

  const escapedNumbers = numbers.filter(n => n.escaped);
  if (escapedNumbers.length > 0) {
    escapedCountTotal += escapedNumbers.length;
    numbers = numbers.filter(n => !n.escaped);

    for (let i = 0; i < escapedNumbers.length; i++) {
      spawnNumber();
    }
  }

  while (numbers.length < GAME_CONFIG.MAX_NUMBERS) {
    spawnNumber();
  }

  const now = performance.now();
  timeEl.textContent = ((now - startTime) / 1000).toFixed(1);
}

function drawWalls() {
  const segW = W * GAME_CONFIG.ESCAPE_SEGMENT_RATIO;
  const segH = H * GAME_CONFIG.ESCAPE_SEGMENT_RATIO;
  const wall = GAME_CONFIG.WALL_THICKNESS;

  ctx.fillStyle = '#666666';

  ctx.fillRect(segW, 0, W - segW * 2, wall);
  ctx.fillRect(segW, H - wall, W - segW * 2, wall);
  ctx.fillRect(0, segH, wall, H - segH * 2);
  ctx.fillRect(W - wall, segH, wall, H - segH * 2);
}

function create3DSilhouette(img, baseColorHex, w, h) {
  if (!img || !img.complete || img.naturalWidth === 0 || w <= 0 || h <= 0) return null;

  const intW = Math.ceil(w);
  const intH = Math.ceil(h);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = intW;
  maskCanvas.height = intH;
  const mctx = maskCanvas.getContext("2d");

  mctx.drawImage(img, 0, 0, intW, intH);
  mctx.globalCompositeOperation = "source-in";
  mctx.fillStyle = baseColorHex;
  mctx.fillRect(0, 0, intW, intH);

  mctx.globalCompositeOperation = "source-atop";
  const grad = mctx.createLinearGradient(0, 0, 0, intH);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.2)");
  mctx.fillStyle = grad;
  mctx.fillRect(0, 0, intW, intH);

  const hlGrad = mctx.createRadialGradient(
    intW * 0.4, intH * 0.25, 0,
    intW * 0.4, intH * 0.25, Math.max(intW, intH) * 0.6
  );
  hlGrad.addColorStop(0, "rgba(255, 255, 255, 0.4)");
  hlGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  mctx.fillStyle = hlGrad;
  mctx.fillRect(0, 0, intW, intH);

  const outlineCanvas = document.createElement("canvas");
  outlineCanvas.width = intW;
  outlineCanvas.height = intH;
  const olctx = outlineCanvas.getContext("2d");
  olctx.drawImage(img, 0, 0, intW, intH);
  olctx.globalCompositeOperation = "source-in";
  olctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  olctx.fillRect(0, 0, intW, intH);

  mctx.globalCompositeOperation = "destination-over";
  mctx.drawImage(outlineCanvas, 0, 0);

  return { canvas: maskCanvas, offset: 0 };
}

function getOrCreate3DImage(animalKey, value, img, w, h) {
  if (!img || !img.complete || img.naturalWidth === 0 || w <= 0 || h <= 0) return null;

  const key = `${animalKey}_${img.src}_val${value}_w${Math.round(w)}_h${Math.round(h)}`;
  if (!cached3DImages[key]) {
    const color = COLORS[value] || "#FFFFFF";
    const result = create3DSilhouette(img, color, w, h);
    if (!result) return null;
    cached3DImages[key] = result;
  }
  return cached3DImages[key];
}

function drawNumbers() {
  const sortedNumbers = [...numbers].sort((a, b) => b.id - a.id);

  sortedNumbers.forEach(n => {
    const img = IMAGES[level];
    
    updateNumberSize(n);
    const drawW = n.drawW || n.size;
    const drawH = n.drawH || n.size;

    if (img && img.complete && img.naturalWidth !== 0) {
      const cached = getOrCreate3DImage(level, n.value, img, drawW, drawH);
      if (cached) {
        ctx.drawImage(cached.canvas, n.x - drawW / 2, n.y - drawH / 2);
      }
    }

    ctx.save();
    ctx.font = `bold ${n.size * 0.4}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const conf = DIFFICULTY_CONFIG[level];
    const offset = (conf && conf.textOffset) ? conf.textOffset : { x: 0, y: 0 };
    const textX = n.x + offset.x;
    const textY = n.y + offset.y;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 3;
    ctx.strokeText(n.value, textX, textY);

    ctx.fillStyle = "#000000";
    ctx.fillText(n.value, textX, textY);
    ctx.restore();
  });
}

function drawEffect() {
  if (!effect.active) return;

  const t = (performance.now() - effect.start) / 400;
  if (t > 1) {
    effect.active = false;
    return;
  }

  const scale = 1 + Math.sin(t * Math.PI) * 0.6;
  const color = effect.type === "success" ? "#00FF00" : "#FF0000";

  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineJoin = "round";

  const numFontSize = Math.floor(100 * scale);
  const numX = W / 2;
  const numY = H / 2 - numFontSize * 0.2;

  ctx.font = `bold ${numFontSize}px sans-serif`;
  ctx.lineWidth = Math.floor(8 * scale);
  ctx.strokeText(effect.value, numX, numY);
  ctx.fillText(effect.value, numX, numY);

  const text = effect.type === "success" ? "SUCCESS" : "FAIL";
  const textFontSize = Math.floor(36 * scale);
  const textX = W / 2;
  const textY = H / 2 + numFontSize * 0.7;

  ctx.font = `bold ${textFontSize}px sans-serif`;
  ctx.lineWidth = Math.floor(4 * scale);
  ctx.strokeText(text, textX, textY);
  ctx.fillText(text, textX, textY);

  ctx.restore();
}

function drawCapturedAnimations() {
  const now = performance.now();

  capturedAnimations = capturedAnimations.filter(anim => {
    const elapsed = now - anim.start;
    const progress = elapsed / anim.duration;

    if (progress >= 1.0) return false;

    const easeProgress = progress * progress;

    const scaleX = Math.max(0.05, 1.0 - (0.8 * progress));
    const scaleY = Math.max(0.05, 1.0 + (3.0 * easeProgress));
    const alpha = Math.max(0, 1.0 - progress);

    const currentW = Math.max(1, Math.round(anim.drawW * scaleX));
    const currentH = Math.max(1, Math.round(anim.drawH * scaleY));

    const img = IMAGES[level];

    ctx.save();
    ctx.globalAlpha = alpha;

    if (img && img.complete && img.naturalWidth > 0 && currentW > 0 && currentH > 0) {
      const cached = getOrCreate3DImage(level, anim.value, img, anim.drawW, anim.drawH);
      
      if (cached && cached.canvas && cached.canvas.width > 0 && cached.canvas.height > 0) {
        ctx.drawImage(
          cached.canvas,
          Math.round(anim.x - currentW / 2),
          Math.round(anim.y - currentH / 2),
          currentW,
          currentH
        );
      } else {
        ctx.drawImage(
          img,
          Math.round(anim.x - currentW / 2),
          Math.round(anim.y - currentH / 2),
          currentW,
          currentH
        );
      }
    }

    const textFontSize = Math.max(1, Math.round(anim.size * 0.4 * scaleY));
    ctx.font = `bold ${textFontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const conf = DIFFICULTY_CONFIG[level];
    const offset = (conf && conf.textOffset) ? conf.textOffset : { x: 0, y: 0 };
    const textX = Math.round(anim.x + offset.x * scaleX);
    const textY = Math.round(anim.y + offset.y * scaleY);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 3;
    ctx.strokeText(anim.value, textX, textY);

    ctx.fillStyle = "#000000";
    ctx.fillText(anim.value, textX, textY);

    ctx.restore();

    return true;
  });
}

function showRecordScreen(currentResult = null, isCleared = false) {
  const currentResultEl = document.getElementById('currentResult');
  
  if (isCleared && currentResult) {
    const currentStage = getAnimalStage(currentResult.score);
    const scaleVal = getMenuScale(level, currentStage); // リザルトもメニュー合わせ
    const imgPath = getMenuImagePathForLevel(level, currentStage);

    const score = Number(currentResult.score) || 0;
    const time = Number(currentResult.time) || 0;
    const fail = Number(currentResult.fail) || 0;
    const escaped = Number(currentResult.escaped) || 0;

    currentResultEl.innerHTML = `
      <div style="background: #333; padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #FFCC00; display: flex; align-items: center; justify-content: space-around;">
        <div style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden;">
          <img src="${escapeHTML(imgPath)}" style="max-width: 50px; max-height: 50px; transform: scale(${scaleVal}); transform-origin: center; object-fit: contain;">
        </div>
        <div style="text-align: left;">
          <div style="color: #FFCC00; font-size: 13px; font-weight: bold; text-transform: uppercase;">Current Result</div>
          <div style="font-size: 22px; font-weight: bold; color: #fff; line-height: 1.2;">${score} <span style="font-size: 13px;">pt</span></div>
          <div style="font-size: 11px; color: #ccc; margin-top: 2px;">
            Time: ${time}s | Fail: ${fail} | Escaped: ${escaped}
          </div>
        </div>
      </div>
    `;
  } else {
    currentResultEl.innerHTML = `
      <div style="background: #2a2a2a; padding: 8px; border-radius: 8px; margin-bottom: 12px; color: #aaa; font-size: 13px;">
        ${isCleared ? 'No Record' : 'Game ended (Not Cleared)'}
      </div>
    `;
  }

  const list = records[level] || [];
  const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32", "#FFFFFF", "#FFFFFF"];
  const suffixes = ["st", "nd", "rd", "th", "th"];

  let html = "";

  for (let i = 0; i < 5; i++) {
    const color = rankColors[i];
    const rankText = `${i + 1}${suffixes[i]}`;
    const r = list[i];

    if (r) {
      const rScore = Number(r.score) || 0;
      const rTime = Number(r.time) || 0;
      const rFail = Number(r.fail) || 0;
      const rEscaped = Number(r.escaped) || 0;

      html += `
        <div style="color: ${color};">
          <span>${escapeHTML(rankText)}</span>
          <span>${rScore}pt</span>
          <span style="font-size: 12px; font-weight: normal; color: #aaa;">(${rTime}s / F:${rFail} / E:${rEscaped})</span>
        </div>
      `;
    } else {
      html += `
        <div style="color: ${color};">
          <span>${escapeHTML(rankText)}</span>
          <span>---</span>
          <span style="font-size: 12px; font-weight: normal; color: #aaa;">-</span>
        </div>
      `;
    }
  }

  recordList.innerHTML = html;

  recordScreen.style.display = "block";
  canvas.style.display = "none";
  infoEl.style.display = "none";
  endButton.style.display = "none";
}

retryButton.addEventListener("click", () => {
  startGame();
});

backButton.addEventListener("click", () => {
  recordScreen.style.display = "none";
  updateMenuUI();
  menu.style.display = "block";
});

function loop() {
  update();
  ctx.clearRect(0, 0, W, H);

  drawWalls();
  drawNumbers();
  drawCapturedAnimations();
  drawEffect();

  if (!gameOver) {
    animFrameId = requestAnimationFrame(loop);
  }
}

// game_5.js 追加コード・修正分
// UI要素追加取得
const galleryButton = document.getElementById('galleryButton');
const galleryScreen = document.getElementById('galleryScreen');
const closeGalleryButton = document.getElementById('closeGalleryButton');
const galleryGrid = document.getElementById('galleryGrid');

// 取得済み画像トラッキング用（localStorage保存）
function loadUnlockedGallery() {
  try {
    return JSON.parse(localStorage.getItem('sum_safari_gallery_v1')) || {};
  } catch (e) {
    return {};
  }
}

let unlockedGallery = loadUnlockedGallery();

function unlockGalleryItem(animal, rankStage) {
  if (!unlockedGallery[animal]) unlockedGallery[animal] = {};
  unlockedGallery[animal][rankStage] = true;
  try {
    localStorage.setItem('sum_safari_gallery_v1', JSON.stringify(unlockedGallery));
  } catch (e) {}
}

// ギャラリーオープン/クローズイベント
if (galleryButton && galleryScreen && closeGalleryButton) {
  galleryButton.addEventListener('click', () => {
    menu.style.display = "none";
    renderGallery();
    galleryScreen.style.display = "block";
  });

  closeGalleryButton.addEventListener('click', () => {
    galleryScreen.style.display = "none";
    menu.style.display = "block";
  });
}

function renderGallery() {
  const levels = Object.keys(DIFFICULTY_CONFIG);
  let html = "";
  levels.forEach(lv => {
    html += `<div style="background: #222; border-radius: 12px; padding: 16px; border: 1px solid #444;">`;
    html += `<h3 style="margin-top: 0; color: #FFCC00; font-size: 18px; border-bottom: 1px solid #444; padding-bottom: 8px; text-transform: capitalize;">${lv}</h3>`;
    html += `<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 12px;">`;
    for (let st = 1; st <= 5; st++) {
      const isUnlocked = unlockedGallery[lv] && unlockedGallery[lv][st];
      const imgPath = getMenuImagePathForLevel(lv, st);
      html += `<div style="aspect-ratio: 1; background: rgba(0,0,0,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #555;">`;
      if (isUnlocked) {
        html += `<img src="${escapeHTML(imgPath)}" style="max-width: 80%; max-height: 80%; object-fit: contain;">`;
      } else {
        html += `<span style="color: #555; font-size: 14px;">?</span>`;
      }
      html += `</div>`;
    }
    html += `</div></div>`;
  });
  galleryGrid.innerHTML = html;
}

