/** Фотографии из Wikipedia REST API. Промисы в кеше предотвращают повторные запросы. */

const photoCache = new Map()
const queue = []
let active = 0
const MAX_REQUESTS = 4

/** @param {import('./mountains.js').Mountain} mountain */
export function getMountainPhoto(mountain) {
  if (!photoCache.has(mountain.wiki)) {
    photoCache.set(mountain.wiki, new Promise((resolve) => {
      queue.push({ mountain, resolve })
      runQueue()
    }))
  }
  return photoCache.get(mountain.wiki)
}

/** Не даёт сорока карточкам одновременно отправить сорок запросов. */
function runQueue() {
  while (active < MAX_REQUESTS && queue.length) {
    const { mountain, resolve } = queue.shift()
    active++
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(mountain.wiki)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Wikipedia HTTP ${response.status}`)
        return response.json()
      })
      .then((data) => resolve({ thumbnail: data.thumbnail?.source, original: data.originalimage?.source }))
      .catch(() => resolve(null))
      .finally(() => {
        active--
        runQueue()
      })
  }
}

/**
 * Добавляет фото в текущие карточки; неудачная загрузка оставляет нарисованный силуэт.
 * @param {HTMLElement} container
 * @param {import('./api.js').MountainWithWeather[]} mountains
 */
export function loadPhotos(container, mountains) {
  const cards = new Map([...container.querySelectorAll('.card')].map((card) => [card.dataset.id, card]))
  for (const mountain of mountains) {
    const card = cards.get(mountain.id)
    getMountainPhoto(mountain).then((photo) => {
      if (!photo?.thumbnail || !card?.isConnected) return
      const media = card.querySelector('.card-media')
      const image = document.createElement('img')
      image.className = 'card-photo'
      image.loading = 'lazy'
      image.alt = `Вершина ${mountain.name}`
      image.src = photo.thumbnail
      image.addEventListener('error', () => image.remove(), { once: true })
      media.insertBefore(image, media.querySelector('.chip'))
    })
  }
}
