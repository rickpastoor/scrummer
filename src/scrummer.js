const POINTS_SCALE = [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100];

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
});

const getDefaultValueFromConfig = (titleDataConfiguration) => {
  const defaultValue = {};
  for (const dataIdentifier in titleDataConfiguration) {
    defaultValue[dataIdentifier] = titleDataConfiguration[dataIdentifier].defaultValue
  }
}

const containsNodeWithClass = (nodeList, className) => {
  for (let i = 0; i < nodeList.length; i++) {
    if (nodeList[i].classList && nodeList[i].classList.contains(className)) {
      return true;
    }
  }
}

let listChangeObserver = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    // if the mutation was triggered by us adding or removing badges, do not recalculate
    if (
      (mutation.addedNodes.length === 1 && containsNodeWithClass(mutation.addedNodes, 'scrummer-points')) ||
      (mutation.addedNodes.length === 1 && containsNodeWithClass(mutation.addedNodes, 'scrummer-post-points')) ||
      (mutation.addedNodes.length === 1 && containsNodeWithClass(mutation.addedNodes, 'scrummer-card-id')) ||
      (mutation.removedNodes.length === 1 && containsNodeWithClass(mutation.removedNodes, 'scrummer-points')) ||
      (mutation.removedNodes.length === 1 && containsNodeWithClass(mutation.removedNodes, 'scrummer-post-points'))
    ) return;

    // If the list was modified, recalculate
    if (mutation.target.classList.contains('list-cards') ||
      mutation.target.classList.contains('list-header-num-cards') ||
      mutation.target.classList.contains('js-list-sortable')) {
      setTimeout(calculatePointsForBoardDebounced);
      return;
    }

    // If a single card's content is mutated
    if (mutation.target.classList.contains('js-card-name')) {
      mutation.target.setAttribute('data-mutated', 1);

      setTimeout(calculatePointsForBoardDebounced);
    }
  });
});

const findOrInsertSpan = (parent, className, insertBeforeElement) => {
  let span = parent.querySelector('.' + className);
  if (!span) {
    span = document.createElement('span');
    span.className = className;
    parent.insertBefore(span, insertBeforeElement);
  }
  return span;
}

const removeIfExists = (parent, className) => {
  let element = parent.querySelector('.' + className);
  if (element) {
    element.parentNode.removeChild(element);
  }
}

const extractDataFromTitle = (title, isDataActivated, regexMatchingData) => {
  if (!isDataActivated) return;
  let matches = title.match(regexMatchingData);
  if (matches) {
    let points = matches[1];
    if (points === '?') return '?';
    return parseFloat(points.replace(',', '.'));
  }
}

const sanitizePoints = (points) => {
  if (points === '?') return 0;
  if (!points) return 0;
  return points;
}

const formatPoints = (points) => {
  if (points === '?') return '?';
  return Math.round(points * 10) / 10;
}

const calculatePointsForCard = (card) => {
  let contentMutated = false;
  const titleDataConfiguration = getTitleDataConfiguration(settings)

  let cardNameElement = card.querySelector('.js-card-name');
  if (!cardNameElement) {
    return getDefaultValueFromConfig(titleDataConfiguration)
  }

  let originalTitle = card.getAttribute('data-original-title');

  let cardShortId = cardNameElement.querySelector('.card-short-id');
  if (settings.showCardNumbers && cardShortId && !cardShortId.classList.contains('scrummer-card-id')) {
    cardShortId.classList.add('scrummer-card-id');
  }

  if (!originalTitle || cardNameElement.getAttribute('data-mutated') == 1) {
    originalTitle = cardNameElement.lastChild.textContent;
    cardNameElement.setAttribute('data-mutated', 0);
    card.setAttribute('data-original-title', originalTitle);
    contentMutated = true;
  }

  // Trello sometimes drops our badge, so if that happens we need to redraw
  if (card.getAttribute('data-calculated-points') !== null && !card.querySelector('.scrummer-points')) {
    contentMutated = true;
  }
  if (card.getAttribute('data-calculated-post-points') !== null && !card.querySelector('.scrummer-post-points')) {
    contentMutated = true;
  }

  if (!originalTitle) {
    return getDefaultValueFromConfig(titleDataConfiguration)
  }

  const storyPointsConfiguration = titleDataConfiguration.story
  let calculatedPoints = extractDataFromTitle(
    originalTitle,
    storyPointsConfiguration.isActivated,
    storyPointsConfiguration.regex
  );
  const postPointsConfiguration = titleDataConfiguration.post
  let calculatedPostPoints = extractDataFromTitle(
    originalTitle,
    postPointsConfiguration.isActivated,
    postPointsConfiguration.regex
  );

  if (
    !contentMutated &&
    card.getAttribute('data-calculated-points') == calculatedPoints &&
    card.getAttribute('data-calculated-post-points') == calculatedPostPoints
  ) {
    return {
      story: sanitizePoints(calculatedPoints),
      post: sanitizePoints(calculatedPostPoints)
    }
  }

  if (calculatedPoints !== undefined) {
    let badgeElement = findOrInsertSpan(cardNameElement, 'scrummer-points', cardNameElement.lastChild);
    badgeElement.textContent = formatPoints(calculatedPoints);
    card.setAttribute('data-calculated-points', calculatedPoints);
  } else {
    removeIfExists(cardNameElement, 'scrummer-points');
  }

  if (calculatedPostPoints !== undefined) {
    let badgeElement = findOrInsertSpan(cardNameElement, 'scrummer-post-points', cardNameElement.lastChild);
    badgeElement.textContent = formatPoints(calculatedPostPoints);
    card.setAttribute('data-calculated-post-points', calculatedPostPoints);
  } else {
    removeIfExists(cardNameElement, 'scrummer-post-points');
  }

  let cleanedTitle = originalTitle;
  if (settings.showStoryPoints) cleanedTitle = cleanedTitle.replace(titleDataConfiguration.story.regex, '');
  if (settings.showPostPoints) cleanedTitle = cleanedTitle.replace(titleDataConfiguration.post.regex, '');
  cardNameElement.lastChild.textContent = cleanedTitle.trim();

  return {
    story: sanitizePoints(calculatedPoints),
    post: sanitizePoints(calculatedPostPoints)
  };
}

const calculatePointsForList = (list) => {
  listChangeObserver.observe(list, {
    childList: true,
    characterData: false,
    attributes: false,
    subtree: true
  });
  listChangeObserver.observe(list.querySelector('.list-header-num-cards'), {
    attributes: true
  });

  // Array.slice can convert a NodeList to an array
  let listPoints = Array.prototype.slice.call(list.querySelectorAll('.list-card:not(.hide)'))
    .reduce((listPoints, card) => {
      let cardPoints = calculatePointsForCard(card);
      listPoints.story += cardPoints.story;
      listPoints.post += cardPoints.post;
      return listPoints;
    }, { story: 0, post: 0 });

  let listHeader = null;
  if (settings.showColumnTotals && (listHeader = list.querySelector('.js-list-header'))) {
    // Add or update points badges
    if (settings.showStoryPoints) {
      let badge = findOrInsertSpan(listHeader, 'scrummer-list-points', listHeader.querySelector('.js-list-name-input'));
      badge.textContent = formatPoints(listPoints.story);
    }
    if (settings.showPostPoints) {
      let badge = findOrInsertSpan(listHeader, 'scrummer-list-post-points', listHeader.querySelector('.js-list-name-input'));
      badge.textContent = formatPoints(listPoints.post);
    }
  }

  return listPoints;
}

const calculatePointsForBoard = () => {
  // Array.slice can convert a NodeList to an array
  let boardPoints = Array.prototype.slice.call(document.querySelectorAll('.list'))
    .reduce((boardPoints, list) => {
      let listPoints = calculatePointsForList(list);
      boardPoints.story += listPoints.story;
      boardPoints.post += listPoints.post;
      return boardPoints;
    }, { story: 0, post: 0 });

  let boardHeader = null;
  if (settings.showBoardTotals && (boardHeader = document.querySelector('.js-board-header'))) {
    // Add or update points badges
    if (settings.showStoryPoints) {
      let badge = findOrInsertSpan(boardHeader, 'scrummer-board-points', boardHeader.querySelector('.board-header-btn-name'));
      badge.textContent = formatPoints(boardPoints.story);
    }
    if (settings.showPostPoints) {
      let badge = findOrInsertSpan(boardHeader, 'scrummer-board-post-points', boardHeader.querySelector('.board-header-btn-name'));
      badge.textContent = formatPoints(boardPoints.post);
    }
  }

  listChangeObserver.observe(document.querySelector('.js-list-sortable'), {
    childList: true,
    characterData: false,
    attributes: false
  });
}

let debounceTimeout;

const debounce = (func, wait, immediate) => {
  return function () {
    let context = this, args = arguments;
    const later = () => {
      debounceTimeout = null;
      if (!immediate) func.apply(context, args);
    };
    let callNow = immediate && !debounceTimeout;
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};

const calculatePointsForBoardDebounced = () => {
  debounce(calculatePointsForBoard, 100)();
}

const buildPickerRow = (buttonClassnameF, regexMatchingDataInTitle, delimitersOfDataInTitle) => {
  let row = document.createElement('div');
  row.className = 'scrummer-picker-row';

  POINTS_SCALE.forEach(function (value) {
    let button = document.createElement('a');
    button.textContent = value;
    button.href = 'javascript:;';
    button.className = buttonClassnameF;
    button.addEventListener(
      'click',
      insertDataInTitle.bind(this, value, regexMatchingDataInTitle, delimitersOfDataInTitle)
    );

    row.appendChild(button);
  });

  return row;
}

/**
 * The point picker
 */
const buildPicker = () => {
  let itemsContainer = document.createElement('div');
  itemsContainer.className = 'scrummer-picker-container';
  const titleDataConfiguration = getTitleDataConfiguration(settings)
  for (const dataIdentifier in titleDataConfiguration) {
    const { isActivated, pickerClass, regex, delimiters } = titleDataConfiguration[dataIdentifier]
    if (isActivated && pickerClass) {
      itemsContainer.appendChild(
        buildPickerRow(pickerClass, regex, delimiters)
      );
    }
  }

  return itemsContainer;
}

/**
 * This sets up a listener to see if a detail window is presented
 */
const setupWindowListener = (callback) => {
  let windowChangeObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.target.classList.contains('js-card-detail-title-input') &&
        mutation.target.classList.contains('is-editing')) {
        callback();
      }
    });
  });

  windowChangeObserver.observe(document.querySelector('.window-overlay'), {
    childList: false,
    characterData: false,
    attributes: true,
    subtree: true,
    attributeFilter: ['class']
  });
}

Podium = {};
Podium.keydown = function (k) {
  let oEvent = document.createEvent('KeyboardEvent');

  // Chromium Hack
  Object.defineProperty(oEvent, 'keyCode', {
    get: function () {
      return this.keyCodeVal;
    }
  });
  Object.defineProperty(oEvent, 'which', {
    get: function () {
      return this.keyCodeVal;
    }
  });

  if (oEvent.initKeyboardEvent) {
    oEvent.initKeyboardEvent("keydown", true, true, document.defaultView, false, false, false, false, k, k);
  } else {
    oEvent.initKeyEvent("keydown", true, true, document.defaultView, false, false, false, false, k, 0);
  }

  oEvent.keyCodeVal = k;

  if (oEvent.keyCode !== k) {
    alert("keyCode mismatch " + oEvent.keyCode + "(" + oEvent.which + ")");
  }

  document.dispatchEvent(oEvent);
}

/**
 * Action when a picker button is clicked
 */
const insertDataInTitle = (value, regexMatchingDataInTitle, delimitersOfDataInTitle, event) => {
  event.stopPropagation();

  const titleField = document.querySelector('.js-card-detail-title-input');

  titleField.click();
  titleField.focus();

  // Remove old points
  const cleanedTitle = titleField.value.replace(regexMatchingDataInTitle, '').trim();
  titleField.value = `${delimitersOfDataInTitle[0]}${value}${delimitersOfDataInTitle[1]}  ${cleanedTitle}`;

  Podium.keydown(13);

  // Hide controls
  document.querySelector('.scrummer-picker-container').parentNode.removeChild(document.querySelector('.scrummer-picker-container'));
}

const checkForLists = () => {
  if (document.querySelectorAll('.list').length > 0) {
    calculatePointsForBoard();

    if (settings.showPicker) {
      setupWindowListener(function () {
        if (document.querySelector('.scrummer-picker-container')) {
          return;
        }

        let editControls = document.querySelector('.js-current-list');
        editControls.insertBefore(buildPicker(), editControls.firstChild);
      });
    }
  } else {
    setTimeout(checkForLists, 300);
  }
}

let settings = {};
chrome.storage.sync.get(null, (_settings) => {
  ['showCardNumbers', 'showStoryPoints', 'showPostPoints', 'showColumnTotals', 'showBoardTotals', 'showPicker']
    .forEach((option) => {
      if (_settings[option] === undefined) _settings[option] = true;
    });
  settings = _settings;

  // Launch the plugin by checking at a certain interval if any lists have been loaded.
  // Wait 1 second because some DOM rebuilding may happen late.
  setTimeout(checkForLists, 1000);
});
