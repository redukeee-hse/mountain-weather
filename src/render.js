/**
 * Вывод вершин карточками.
 *
 * renderMountains(container, mountains)
 *   container — <section id="results">
 *   mountains — непустой массив MountainWithWeather (см. src/api.js)
 * Загрузку, пустой результат и ошибки показывает src/status.js.
 *
 * Каждая карточка — <article class="card" data-id="…"> с блоком .card-media сверху:
 * в него можно добавлять фото, а по клику на карточку открывать подробности.
 */

const MAX_ELEVATION = 8849

/**
 * @param {HTMLElement} container
 * @param {import('./api.js').MountainWithWeather[]} mountains
 * @param {string} sort
 */
export function renderMountains(container, mountains, sort = 'elevation') {
  const summary = document.createElement('p')
  summary.className = 'results-summary'
  const sortLabels = {
    elevation: 'от самой высокой',
    temperature: 'от самой холодной',
    wind: 'от самого сильного ветра',
    name: 'по названию',
  }
  summary.textContent = `${pluralize(mountains.length, ['вершина', 'вершины', 'вершин'])} · ${sortLabels[sort] ?? sortLabels.elevation}`

  const grid = document.createElement('div')
  grid.className = 'grid'
  grid.append(...mountains.map(createCard))

  container.replaceChildren(summary, grid)
}

/** @param {import('./api.js').MountainWithWeather} mountain */
function createCard(mountain) {
  const { weather } = mountain

  const card = el('article', 'card')
  card.dataset.id = mountain.id
  card.tabIndex = 0
  card.setAttribute('role', 'button')
  card.setAttribute('aria-label', `Подробнее о вершине ${mountain.name}`)

  // Верх карточки: небо по погоде, силуэт горы, высота и горная система
  const media = el('div', `card-media sky--${skyType(weather.code)}`)
  media.classList.toggle('is-night', !weather.isDay)
  media.innerHTML = ridgeSvg(mountain)
  media.append(
    el('span', 'chip', mountain.rangeName),
    el('span', 'card-elevation', `${formatNumber(mountain.elevation)} м`),
    el('span', 'card-weather-icon', weather.icon),
  )
  media.lastChild.setAttribute('aria-hidden', 'true')

  // Название и страна
  const body = el('div', 'card-body')
  const title = el('h2', 'card-title', mountain.name)
  const country = el('p', 'card-country', mountain.country)

  // Температура
  const temp = el('div', `card-temp temp--${tempTone(weather.temperature)}`)
  const meta = el('div', 'temp-meta')
  meta.append(
    el('span', 'temp-text', weather.text),
    el('span', 'temp-feels', `ощущается как ${formatTemp(weather.feelsLike)}`),
  )
  temp.append(el('span', 'temp-value', formatTemp(weather.temperature)), meta)

  // Ветер, облачность, местное время
  const stats = el('dl', 'card-stats')
  stats.append(
    stat('Ветер', `${weather.windSpeed} км/ч`, `порывы до ${weather.windGusts}`),
    stat('Облачность', `${weather.cloudCover} %`),
    stat('Местное время', weather.localTime, weather.isDay ? 'день' : 'ночь'),
  )

  body.append(title, country, temp, stats)
  card.append(media, body)
  return card
}

/**
 * @param {string} term
 * @param {string} value
 * @param {string} [hint]
 */
function stat(term, value, hint) {
  const wrap = el('div', 'stat')
  const dd = el('dd', 'stat-value', value)
  if (hint) dd.append(el('small', 'stat-hint', hint))
  wrap.append(el('dt', 'stat-term', term), dd)
  return wrap
}

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 */
function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/* ---------- Форматирование ---------- */

/** @param {number} value */
function formatTemp(value) {
  return `${value < 0 ? '−' : ''}${Math.abs(value)}°`
}

/** @param {number} value */
function formatNumber(value) {
  return value.toLocaleString('ru-RU')
}

/**
 * @param {number} n
 * @param {[string, string, string]} forms «вершина», «вершины», «вершин»
 */
function pluralize(n, [one, few, many]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`
  return `${n} ${many}`
}

/** Тип неба по коду погоды WMO — определяет цвет верхней части карточки. */
function skyType(code) {
  if (code <= 1) return 'clear'
  if (code <= 3) return 'cloudy'
  if (code <= 48) return 'fog'
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  return 'rain'
}

/** Оттенок температуры: от лютого мороза до тепла. */
function tempTone(t) {
  if (t <= -30) return 'extreme'
  if (t <= -15) return 'frost'
  if (t < 0) return 'cold'
  if (t < 15) return 'mild'
  return 'warm'
}

/* ---------- Силуэт горы ---------- */

/**
 * Рисует силуэт: дальний хребет + главная вершина со снежной шапкой.
 * Форма постоянна для каждой горы (зависит от её id), высота пика — от реальной высоты.
 *
 * @param {import('./mountains.js').Mountain} mountain
 */
function ridgeSvg(mountain) {
  const rand = seededRandom(mountain.id)
  const W = 300
  const H = 140
  const peakX = 120 + rand() * 60
  const peakY = H - (52 + 58 * (mountain.elevation / MAX_ELEVATION))

  // Дальний хребет
  const back = [`M0 ${H}`]
  for (let x = 0; x <= W; x += 30) back.push(`L${x} ${H - 30 - rand() * 35}`)
  back.push(`L${W} ${H} Z`)

  // Главная вершина: ровные склоны у пика, неровные у подножия
  const lx = peakX - 38
  const ly = peakY + 30
  const rx = peakX + 42
  const ry = peakY + 34
  const front = [`M0 ${H}`, `L0 ${H - 22 - rand() * 12}`]
  for (let x = 30; x < lx; x += 28) front.push(`L${x} ${lerp(H - 26, ly, x / lx) + jitter(rand, 8)}`)
  front.push(`L${lx} ${ly}`, `L${peakX} ${peakY}`, `L${rx} ${ry}`)
  for (let x = rx + 28; x < W; x += 28) {
    front.push(`L${x} ${lerp(ry, H - 24, (x - rx) / (W - rx)) + jitter(rand, 8)}`)
  }
  front.push(`L${W} ${H - 20 - rand() * 14}`, `L${W} ${H} Z`)

  // Снежная шапка по склонам главной вершины с «рваным» краем
  const k = 0.62
  const sl = [peakX - 38 * k, peakY + 30 * k]
  const sr = [peakX + 42 * k, peakY + 34 * k]
  const snow = [
    `M${peakX} ${peakY}`,
    `L${sr[0]} ${sr[1]}`,
    `L${peakX + 14} ${sr[1] - 5}`,
    `L${peakX + 5} ${sr[1] + 3}`,
    `L${peakX - 6} ${sl[1] - 4}`,
    `L${peakX - 14} ${sl[1] + 2}`,
    `L${sl[0]} ${sl[1]}`,
    'Z',
  ]

  return `
    <svg class="card-ridge" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path class="ridge-back" d="${back.join(' ')}" />
      <path class="ridge-front" d="${front.join(' ')}" />
      <path class="ridge-snow" d="${snow.join(' ')}" />
    </svg>`
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function jitter(rand, amount) {
  return (rand() - 0.5) * 2 * amount
}

/** Детерминированный генератор случайных чисел (mulberry32) от строки. */
function seededRandom(text) {
  let seed = 0
  for (const ch of text) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
