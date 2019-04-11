const POINTS_SCALE = [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100]

const getTitleDataConfiguration = settings => ({
  story: {
    attribute: 'data-calculated-points',
    cssClass: 'scrummer-points',
    pickerClass: 'scrummer-picker-button',
    isActivated: settings.showStoryPoints,
    regex: /\((\?|\d+\.?,?\d*)\)/m,
    delimiters: ['(', ')'],
    defaultValue: 0
  },
  post: {
    attribute: 'data-calculated-post-points',
    cssClass: 'scrummer-post-points',
    pickerClass: 'scrummer-picker-post-button',
    isActivated: settings.showPostPoints,
    regex: /\[(\?|\d+\.?,?\d*)\]/m,
    delimiters: ['[', ']'],
    defaultValue: 0
  },
  hour: {
    attribute: 'data-calculated-hour-points',
    cssClass: 'scrummer-hour-points',
    pickerClass: 'scrummer-picker-hour-button',
    isActivated: settings.showHourPoints,
    regex: /\$(\?|\d+\.?,?\d*)\$/m,
    delimiters: ['$', '$'],
    defaultValue: 0
  }
})

const getDefaultValueFromConfig = titleDataConfiguration => {
  const defaultValue = {}
  for (const dataIdentifier in titleDataConfiguration) {
    defaultValue[dataIdentifier] =
      titleDataConfiguration[dataIdentifier].defaultValue
  }
  return defaultValue
}

const containsNodeWithScrummerClass = nodeList => {
  if (!nodeList) return false
  return Array.from(nodeList.values()).some(node => {
    if (!node.classList) {
      return false
    }
    return Array.from(node.classList.values()).some(
      className => !!className.match(/^scrummer/i)
    )
  })
}

let listChangeObserver = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    // if the mutation was triggered by us adding or removing badges, do not recalculate
    if (
      mutation.addedNodes.length === 1 &&
      containsNodeWithScrummerClass(mutation.addedNodes)
    )
      return

    // If the list was modified, recalculate
    if (
      mutation.target.classList.contains('list-cards') ||
      mutation.target.classList.contains('list-header-num-cards') ||
      mutation.target.classList.contains('js-list-sortable')
    ) {
      setTimeout(calculatePointsForBoardDebounced)
      return
    }

    // If a single card's content is mutated
    if (mutation.target.classList.contains('js-card-name')) {
      mutation.target.setAttribute('data-mutated', 1)

      setTimeout(calculatePointsForBoardDebounced)
    }
  })
})

const findOrInsertSpan = (parent, className, insertBeforeElement) => {
  let span = parent.querySelector('.' + className)
  if (!span) {
    span = document.createElement('span')
    span.className = className
    parent.insertBefore(span, insertBeforeElement)
  }
  return span
}

const removeIfExists = (parent, className) => {
  let element = parent.querySelector('.' + className)
  if (element) {
    element.parentNode.removeChild(element)
  }
}

const extractDataFromTitle = (title, isDataActivated, regexMatchingData) => {
  if (!isDataActivated) return
  let matches = title.match(regexMatchingData)
  if (matches) {
    let points = matches[1]
    if (points === '?') return '?'
    return parseFloat(points.replace(',', '.'))
  }
}

const sanitizePoints = points => {
  if (points === '?') return 0
  if (!points) return 0
  return points
}

const sanitizeExtractedDataIndex = extractedDataIndex => {
  const sanitizedIndex = {}
  for (const dataIdentifier in extractedDataIndex) {
    sanitizedIndex[dataIdentifier] = sanitizePoints(
      extractedDataIndex[dataIdentifier]
    )
  }

  return sanitizedIndex
}

const formatPoints = points => {
  if (points === '?') return '?'
  return Math.round(points * 10) / 10
}

const insertDataAggregationInElement = (
  element,
  childrenQuerySelector,
  extractData,
  insertSlotQuerySelector,
  titleDataConfiguration
) => {
  // Array.slice can convert a NodeList to an array
  const dataToInsert = Array.prototype.slice
    .call(element.querySelectorAll(childrenQuerySelector))
    .reduce((dataFromChildrenAggregation, child) => {
      const childData = extractData(child)
      for (const dataIdentifier in dataFromChildrenAggregation) {
        dataFromChildrenAggregation[dataIdentifier] += childData[dataIdentifier]
      }
      return dataFromChildrenAggregation
    }, getDefaultValueFromConfig(titleDataConfiguration))

  const elementInsertSlot = element.querySelector(insertSlotQuerySelector)
  if (settings.showColumnTotals && elementInsertSlot) {
    // Add or update points badges
    for (const dataIdentifier in titleDataConfiguration) {
      const { isActivated, cssClass } = titleDataConfiguration[dataIdentifier]
      if (isActivated) {
        let badge = findOrInsertSpan(
          elementInsertSlot,
          cssClass,
          elementInsertSlot.querySelector('.js-list-name-input')
        )
        badge.textContent = formatPoints(dataToInsert[dataIdentifier])
      }
    }
  }

  return dataToInsert
}

const calculatePointsForCard = card => {
  let contentMutated = false
  const titleDataConfiguration = getTitleDataConfiguration(settings)

  let cardNameElement = card.querySelector('.js-card-name')
  if (!cardNameElement) {
    return getDefaultValueFromConfig(titleDataConfiguration)
  }

  let originalTitle = card.getAttribute('data-original-title')

  let cardShortId = cardNameElement.querySelector('.card-short-id')
  if (
    settings.showCardNumbers &&
    cardShortId &&
    !cardShortId.classList.contains('scrummer-card-id')
  ) {
    cardShortId.classList.add('scrummer-card-id')
  }

  if (!originalTitle || cardNameElement.getAttribute('data-mutated') == 1) {
    originalTitle = cardNameElement.lastChild.textContent
    cardNameElement.setAttribute('data-mutated', 0)
    card.setAttribute('data-original-title', originalTitle)
    contentMutated = true
  }

  if (!originalTitle) {
    return getDefaultValueFromConfig(titleDataConfiguration)
  }

  const extractedDataIndex = {}
  for (const dataIdentifier in titleDataConfiguration) {
    const { isActivated, regex, attribute, cssClass } = titleDataConfiguration[
      dataIdentifier
    ]

    const extractedData = extractDataFromTitle(
      originalTitle,
      isActivated,
      regex
    )
    extractedDataIndex[dataIdentifier] = extractedData

    // Trello sometimes drops our badge, so if that happens we need to redraw
    if (
      card.getAttribute(attribute) !== null &&
      !card.querySelector(cssClass)
    ) {
      contentMutated = true
    }
    if (card.getAttribute(attribute) !== extractedData) {
      contentMutated = true
    }
  }

  if (!contentMutated) {
    return sanitizeExtractedDataIndex(extractedDataIndex)
  }

  let cleanedTitle = originalTitle
  for (const dataIdentifier in extractedDataIndex) {
    const extractedData = extractedDataIndex[dataIdentifier]
    const { attribute, cssClass, isActivated, regex } = titleDataConfiguration[
      dataIdentifier
    ]
    if (extractedData === undefined || !isActivated) {
      removeIfExists(cardNameElement, cssClass)
      continue
    }
    const badgeElement = findOrInsertSpan(
      cardNameElement,
      cssClass,
      cardNameElement.lastChild
    )
    badgeElement.textContent = formatPoints(extractedData)
    card.setAttribute(attribute, extractedData)
    cleanedTitle = cleanedTitle.replace(regex, '')
  }

  cardNameElement.lastChild.textContent = cleanedTitle.trim()

  return sanitizeExtractedDataIndex(extractedDataIndex)
}

const calculatePointsForList = list => {
  listChangeObserver.observe(list, {
    childList: true,
    characterData: false,
    attributes: false,
    subtree: true
  })
  listChangeObserver.observe(list.querySelector('.list-header-num-cards'), {
    attributes: true
  })

  titleDataConfiguration = getTitleDataConfiguration(settings)
  const listData = insertDataAggregationInElement(
    list,
    '.list-card:not(.hide)',
    calculatePointsForCard,
    '.js-list-header',
    titleDataConfiguration
  )
  return listData
}

const calculatePointsForBoard = () => {
  titleDataConfiguration = getTitleDataConfiguration(settings)
  insertDataAggregationInElement(
    document,
    '.list',
    calculatePointsForList,
    '.js-board-header',
    titleDataConfiguration
  )

  listChangeObserver.observe(document.querySelector('.js-list-sortable'), {
    childList: true,
    characterData: false,
    attributes: false
  })
}

let debounceTimeout

const debounce = (func, wait, immediate) => {
  return function() {
    let context = this,
      args = arguments
    const later = () => {
      debounceTimeout = null
      if (!immediate) func.apply(context, args)
    }
    let callNow = immediate && !debounceTimeout
    clearTimeout(debounceTimeout)
    debounceTimeout = setTimeout(later, wait)
    if (callNow) func.apply(context, args)
  }
}

const calculatePointsForBoardDebounced = () => {
  debounce(calculatePointsForBoard, 100)()
}

const buildPickerRow = (
  buttonClassname,
  regexMatchingDataInTitle,
  delimitersOfDataInTitle
) => {
  let row = document.createElement('div')
  row.className = 'scrummer-picker-row'

  POINTS_SCALE.forEach(function(value) {
    let button = document.createElement('a')
    button.textContent = value
    button.href = 'javascript:;'
    button.className = buttonClassname
    button.addEventListener(
      'click',
      insertDataInTitle.bind(
        this,
        value,
        regexMatchingDataInTitle,
        delimitersOfDataInTitle
      )
    )

    row.appendChild(button)
  })

  return row
}

/**
 * The point picker
 */
const buildPicker = () => {
  let itemsContainer = document.createElement('div')
  itemsContainer.className = 'scrummer-picker-container'
  const titleDataConfiguration = getTitleDataConfiguration(settings)
  for (const dataIdentifier in titleDataConfiguration) {
    const {
      isActivated,
      pickerClass,
      regex,
      delimiters
    } = titleDataConfiguration[dataIdentifier]
    if (isActivated && pickerClass) {
      itemsContainer.appendChild(buildPickerRow(pickerClass, regex, delimiters))
    }
  }

  return itemsContainer
}

/**
 * This sets up a listener to see if a detail window is presented
 */
const setupWindowListener = callback => {
  let windowChangeObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (
        mutation.target.classList.contains('js-card-detail-title-input') &&
        mutation.target.classList.contains('is-editing')
      ) {
        callback()
      }
    })
  })

  windowChangeObserver.observe(document.querySelector('.window-overlay'), {
    childList: false,
    characterData: false,
    attributes: true,
    subtree: true,
    attributeFilter: ['class']
  })
}

Podium = {}
Podium.keydown = function(k) {
  let oEvent = document.createEvent('KeyboardEvent')

  // Chromium Hack
  Object.defineProperty(oEvent, 'keyCode', {
    get: function() {
      return this.keyCodeVal
    }
  })
  Object.defineProperty(oEvent, 'which', {
    get: function() {
      return this.keyCodeVal
    }
  })

  if (oEvent.initKeyboardEvent) {
    oEvent.initKeyboardEvent(
      'keydown',
      true,
      true,
      document.defaultView,
      false,
      false,
      false,
      false,
      k,
      k
    )
  } else {
    oEvent.initKeyEvent(
      'keydown',
      true,
      true,
      document.defaultView,
      false,
      false,
      false,
      false,
      k,
      0
    )
  }

  oEvent.keyCodeVal = k

  if (oEvent.keyCode !== k) {
    alert('keyCode mismatch ' + oEvent.keyCode + '(' + oEvent.which + ')')
  }

  document.dispatchEvent(oEvent)
}

/**
 * Action when a picker button is clicked
 */
const insertDataInTitle = (
  value,
  regexMatchingDataInTitle,
  delimitersOfDataInTitle,
  event
) => {
  event.stopPropagation()

  const titleField = document.querySelector('.js-card-detail-title-input')

  titleField.click()
  titleField.focus()

  // Remove old points
  const cleanedTitle = titleField.value
    .replace(regexMatchingDataInTitle, '')
    .trim()
  titleField.value = `${delimitersOfDataInTitle[0]}${value}${
    delimitersOfDataInTitle[1]
  }  ${cleanedTitle}`

  Podium.keydown(13)

  // Hide controls
  document
    .querySelector('.scrummer-picker-container')
    .parentNode.removeChild(
      document.querySelector('.scrummer-picker-container')
    )
}

const checkForLists = () => {
  if (document.querySelectorAll('.list').length > 0) {
    calculatePointsForBoard()

    if (settings.showPicker) {
      setupWindowListener(function() {
        if (document.querySelector('.scrummer-picker-container')) {
          return
        }

        let editControls = document.querySelector('.js-current-list')
        editControls.insertBefore(buildPicker(), editControls.firstChild)
      })
    }
  } else {
    setTimeout(checkForLists, 300)
  }
}

let settings = {}
chrome.storage.sync.get(null, _settings => {
  ;[
    'showCardNumbers',
    'showStoryPoints',
    'showPostPoints',
    'showHourPoints',
    'showColumnTotals',
    'showBoardTotals',
    'showPicker'
  ].forEach(option => {
    if (_settings[option] !== undefined) return
    if (option !== 'showHourPoints') {
      _settings[option] = true
      return
    }
    _settings[option] = false
  })
  settings = _settings

  // Launch the plugin by checking at a certain interval if any lists have been loaded.
  // Wait 1 second because some DOM rebuilding may happen late.
  setTimeout(checkForLists, 1000)
})
