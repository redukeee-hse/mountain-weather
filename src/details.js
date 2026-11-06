/** Модальное окно вершины и семидневный прогноз Open-Meteo. */

import { getMountainPhoto } from './photos.js'
import { describeWeather } from './weather.js'

/**
 * @param {HTMLElement} results контейнер карточек
 * @param {(id: string) => import('./api.js').MountainWithWeather | undefined} getMountain
 */
export function setupDetails(results, getMountain) {
  const dialog = document.createElement('dialog')
  dialog.className = 'details-dialog'
  dialog.setAttribute('aria-labelledby', 'details-title')
  const content = el('div', 'details-content')
  dialog.append(content)
  document.body.append(dialog)

  let opener = null
  let controller = null
  let openedMountain = null
  let openId = 0

  /** @param {HTMLElement} card */
  function open(card) {
    const mountain = getMountain(card.dataset.id)
    if (!mountain) return
    if (dialog.open) dialog.close()
    opener = card
    openedMountain = mountain
    const id = ++openId
    renderHeader(mountain, id)
    dialog.showModal()
    loadForecast()
  }

  /** Загружает прогноз заново после открытия или нажатия «Повторить». */
  async function loadForecast() {
    controller?.abort()
    controller = new AbortController()
    const request = controller
    const mountain = openedMountain
    const forecast = content.querySelector('.details-forecast')
    forecast.replaceChildren(el('p', 'details-loading', 'Загрузка прогноза…'))

    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', mountain.lat)
    url.searchParams.set('longitude', mountain.lon)
    url.searchParams.set('elevation', mountain.elevation)
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,snowfall_sum')
    url.searchParams.set('timezone', 'auto')
    url.searchParams.set('forecast_days', '7')

    try {
      const response = await fetch(url, { signal: request.signal })
      if (!response.ok) throw new Error(`Сервер погоды вернул ${response.status}.`)
      const data = await response.json()
      if (!isValidForecast(data.daily)) throw new Error('Сервер погоды прислал неполный прогноз.')
      if (request.signal.aborted || !dialog.open) return
      renderForecast(forecast, data.daily)
    } catch (error) {
      if (request.signal.aborted || !dialog.open) return
      const message = error instanceof TypeError
        ? 'Не удалось связаться с сервером погоды. Проверьте подключение к интернету.'
        : error.message
      showForecastError(forecast, message, loadForecast)
    }
  }

  /** @param {import('./api.js').MountainWithWeather} mountain */
  function renderHeader(mountain, id) {
    content.replaceChildren()
    const hero = el('div', 'details-hero')
    const close = el('button', 'details-close', '×')
    close.type = 'button'
    close.setAttribute('aria-label', 'Закрыть подробности')
    close.addEventListener('click', () => dialog.close())
    hero.append(close)
    getMountainPhoto(mountain).then((photo) => {
      if (!photo || !dialog.open || id !== openId) return
      const image = document.createElement('img')
      image.className = 'details-photo'
      image.alt = `Вершина ${mountain.name}`
      image.src = photo.original || photo.thumbnail
      image.addEventListener('error', () => image.remove(), { once: true })
      hero.prepend(image)
    })

    const info = el('div', 'details-info')
    const title = el('h2', 'details-title', mountain.name)
    title.id = 'details-title'
    const facts = el('p', 'details-facts', `${mountain.rangeName} · ${mountain.country} · ${mountain.elevation.toLocaleString('ru-RU')} м`)
    const coords = el('p', 'details-coords', `Координаты: ${mountain.lat.toFixed(4)}, ${mountain.lon.toFixed(4)}`)
    const weather = el('p', 'details-current', `${mountain.weather.icon} Сейчас ${mountain.weather.text.toLowerCase()}, ${formatTemp(mountain.weather.temperature)} · ветер ${mountain.weather.windSpeed} км/ч`)
    const link = el('a', 'details-link', 'Статья в Википедии')
    link.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(mountain.wiki)}`
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    const heading = el('h3', 'details-section-title', 'Прогноз на 7 дней')
    info.append(title, facts, coords, weather, link, heading, el('div', 'details-forecast'))
    content.append(hero, info)
  }

  results.addEventListener('click', (event) => {
    const card = event.target.closest('.card')
    if (card && results.contains(card)) open(card)
  })
  results.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const card = event.target.closest('.card')
    if (card && event.target === card && results.contains(card)) {
      event.preventDefault()
      open(card)
    }
  })
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect()
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close()
  })
  dialog.addEventListener('close', () => {
    controller?.abort()
    controller = null
    openedMountain = null
    openId++
    if (opener?.isConnected) opener.focus()
    opener = null
  })

  return { close: () => { if (dialog.open) dialog.close() } }
}

/** @param {unknown} daily */
function isValidForecast(daily) {
  return daily && ['time', 'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'wind_speed_10m_max', 'snowfall_sum']
    .every((key) => Array.isArray(daily[key]) && daily[key].length >= 7)
}

/** @param {HTMLElement} container @param {object} daily */
function renderForecast(container, daily) {
  const lows = daily.temperature_2m_min.slice(0, 7)
  const highs = daily.temperature_2m_max.slice(0, 7)
  const minimum = Math.floor(Math.min(...lows))
  const span = Math.max(1, Math.ceil(Math.max(...highs)) - minimum)
  const list = el('div', 'forecast-list')

  for (let i = 0; i < 7; i++) {
    const date = new Date(`${daily.time[i]}T12:00:00`)
    const day = el('div', 'forecast-day')
    const label = el('div', 'forecast-date', new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).format(date))
    const description = describeWeather(daily.weather_code[i], true)
    const conditions = el('div', 'forecast-conditions', `${description.icon} ${description.text}`)
    const temperatures = el('div', 'forecast-temperatures', `${formatTemp(lows[i])} / ${formatTemp(highs[i])}`)
    const track = el('div', 'forecast-track')
    const bar = el('span', 'forecast-bar')
    bar.style.left = `${((lows[i] - minimum) / span) * 100}%`
    bar.style.width = `${Math.max(2, ((highs[i] - lows[i]) / span) * 100)}%`
    track.append(bar)
    const extras = el('div', 'forecast-extras', `Ветер ${Math.round(daily.wind_speed_10m_max[i])} км/ч · снег ${Number(daily.snowfall_sum[i]).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} см`)
    day.append(label, conditions, temperatures, track, extras)
    list.append(day)
  }
  container.replaceChildren(list)
}

/** @param {HTMLElement} container @param {string} message @param {() => void} onRetry */
function showForecastError(container, message, onRetry) {
  const box = el('div', 'details-error')
  box.setAttribute('role', 'alert')
  box.append(el('strong', '', 'Не удалось загрузить прогноз'), el('p', '', message || 'Проверьте подключение к интернету.'))
  const retry = el('button', 'button button--primary', 'Повторить')
  retry.type = 'button'
  retry.addEventListener('click', onRetry)
  box.append(retry)
  container.replaceChildren(box)
  retry.focus()
}

/** @param {number} value */
function formatTemp(value) {
  const rounded = Math.round(value)
  return `${rounded < 0 ? '−' : ''}${Math.abs(rounded)}°`
}

/** @param {string} tag @param {string} className @param {string} [text] */
function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
