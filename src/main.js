import { ApiError, fetchMountains, getCategories } from './api.js'
import { setupControls } from './controls.js'
import { setupDetails } from './details.js'
import { loadPhotos } from './photos.js'
import { renderMountains } from './render.js'
import { clearStatus, showEmpty, showError, showLoading } from './status.js'

const controlsEl = document.querySelector('#controls')
const statusEl = document.querySelector('#status')
const resultsEl = document.querySelector('#results')

/** Текущие параметры запроса. Меняются через элементы управления. */
const state = {
  query: '',
  category: '',
  sort: 'elevation',
}

/** Последний ответ API: сортировка использует его без нового запроса. */
let loadedMountains = []

/** Контроллер текущего запроса: новый запрос отменяет старый. */
let currentRequest = null

const controls = setupControls(controlsEl, {
  onSearch(query) {
    state.query = query.trim()
    loadMountains()
  },
  onCategoryChange(category) {
    state.category = category
    loadMountains()
  },
  onSortChange(sort) {
    state.sort = sort
    renderLoadedMountains()
  },
  onRefresh() {
    loadMountains()
  },
  onReset() {
    state.query = ''
    state.category = ''
    state.sort = 'elevation'
    loadMountains()
  },
})

const details = setupDetails(resultsEl, (id) => loadedMountains.find((m) => m.id === id))

/** Показывает последний ответ в выбранном порядке и добавляет фото. */
function renderLoadedMountains() {
  if (!loadedMountains.length) return
  const mountains = [...loadedMountains]
  const byName = (a, b) => a.name.localeCompare(b.name, 'ru')
  if (state.sort === 'temperature') mountains.sort((a, b) => a.weather.temperature - b.weather.temperature || byName(a, b))
  else if (state.sort === 'wind') mountains.sort((a, b) => b.weather.windSpeed - a.weather.windSpeed || byName(a, b))
  else if (state.sort === 'name') mountains.sort(byName)
  else mountains.sort((a, b) => b.elevation - a.elevation)
  renderMountains(resultsEl, mountains, state.sort)
  loadPhotos(resultsEl, mountains)
}

async function loadMountains() {
  details.close()
  currentRequest?.abort()
  const request = new AbortController()
  currentRequest = request

  resultsEl.replaceChildren()
  loadedMountains = []
  showLoading(statusEl)
  controls.setBusy?.(true)

  try {
    const mountains = await fetchMountains({ ...state, signal: request.signal })
    if (request.signal.aborted) return

    if (mountains.length === 0) {
      showEmpty(statusEl)
    } else {
      clearStatus(statusEl)
      loadedMountains = mountains
      renderLoadedMountains()
    }
  } catch (error) {
    if (error.name === 'AbortError') return
    if (!(error instanceof ApiError)) console.error(error)
    showError(statusEl, getErrorMessage(error), loadMountains)
  } finally {
    if (currentRequest === request) controls.setBusy?.(false)
  }
}

/** @param {unknown} error */
function getErrorMessage(error) {
  if (error instanceof ApiError) return error.message
  return 'Произошла непредвиденная ошибка. Попробуйте ещё раз.'
}

controls.setCategories(getCategories())
loadMountains()
