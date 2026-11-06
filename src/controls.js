/**
 * Панель управления: поиск, фильтр, сортировка, «Обновить», «Сбросить».
 *
 * setupControls(container, handlers) → { setCategories, setBusy }
 *   onSearch(query)          — ввод в поле поиска (с задержкой 300 мс) или Enter
 *   onCategoryChange(slug)   — выбор горной системы; '' — все
 *   onSortChange(sort)       — сортировка уже загруженных вершин
 *   onRefresh()              — кнопка «Обновить»
 *   onReset()                — кнопка «Сбросить» (поле и фильтр уже очищены)
 */

const SEARCH_DELAY_MS = 300

/**
 * @param {HTMLElement} container
 * @param {{ onSearch: (query: string) => void,
 *           onCategoryChange: (slug: string) => void,
 *           onSortChange: (sort: string) => void,
 *           onRefresh: () => void,
 *           onReset: () => void }} handlers
 */
export function setupControls(container, { onSearch, onCategoryChange, onSortChange, onRefresh, onReset }) {
  container.innerHTML = `
    <form class="controls-form" role="search">
      <label class="field field--search">
        <span class="field-label">Поиск вершины</span>
        <span class="field-control">
          <svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input class="input" type="search" name="query" autocomplete="off"
                 placeholder="Эльбрус, Непал, Matterhorn…" />
        </span>
      </label>

      <label class="field field--sort">
        <span class="field-label">Сортировка</span>
        <span class="field-control">
          <select class="input select" name="sort">
            <option value="elevation">По высоте</option>
            <option value="temperature">По температуре (холодные)</option>
            <option value="wind">По ветру (сильный)</option>
            <option value="name">По названию</option>
          </select>
        </span>
      </label>

      <label class="field field--range">
        <span class="field-label">Горная система</span>
        <span class="field-control">
          <select class="input select" name="range">
            <option value="">Все горные системы</option>
          </select>
        </span>
      </label>

      <div class="controls-actions">
        <button class="button" type="button" data-action="refresh">
          <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v5h-5" />
          </svg>
          Обновить
        </button>
        <button class="button button--ghost" type="button" data-action="reset" hidden>
          Сбросить
        </button>
      </div>
    </form>`

  const form = container.querySelector('form')
  const input = form.elements.namedItem('query')
  const select = form.elements.namedItem('range')
  const sortSelect = form.elements.namedItem('sort')
  const refreshButton = form.querySelector('[data-action="refresh"]')
  const resetButton = form.querySelector('[data-action="reset"]')

  let timer = 0
  let lastQuery = ''

  const updateReset = () => {
    resetButton.hidden = !input.value.trim() && !select.value && sortSelect.value === 'elevation'
  }

  const submitQuery = () => {
    clearTimeout(timer)
    const query = input.value.trim()
    if (query === lastQuery) return
    lastQuery = query
    onSearch(query)
  }

  input.addEventListener('input', () => {
    updateReset()
    clearTimeout(timer)
    timer = setTimeout(submitQuery, SEARCH_DELAY_MS)
  })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submitQuery()
  })

  select.addEventListener('change', () => {
    updateReset()
    onCategoryChange(select.value)
  })

  sortSelect.addEventListener('change', () => {
    updateReset()
    onSortChange(sortSelect.value)
  })

  refreshButton.addEventListener('click', () => onRefresh())

  resetButton.addEventListener('click', () => {
    clearTimeout(timer)
    input.value = ''
    select.value = ''
    sortSelect.value = 'elevation'
    lastQuery = ''
    updateReset()
    onReset()
    input.focus()
  })

  return {
    /** @param {import('./api.js').Category[]} categories */
    setCategories(categories) {
      const options = categories.map(({ slug, name }) => new Option(name, slug))
      select.replaceChildren(new Option('Все горные системы', ''), ...options)
    },
    /** @param {boolean} isBusy */
    setBusy(isBusy) {
      refreshButton.disabled = isBusy
      refreshButton.classList.toggle('is-busy', isBusy)
    },
  }
}
