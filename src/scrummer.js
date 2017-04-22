var pointsScale = [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100];
var storyPointsRegexp = /\((\?|\d+\.?,?\d*)\)/m;
var postPointsRegexp = /\[(\?|\d+\.?,?\d*)\]/m;

var debounceTimeout;

var debounce = function(func, wait, immediate) {
  return function() {
    var context = this, args = arguments;
    var later = function() {
      debounceTimeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !debounceTimeout;
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};

var containsNodeWithClass = function (nodeList, className) {
  for (var i = 0; i < nodeList.length; i++) {
    if (nodeList[i].classList && nodeList[i].classList.contains(className)) {
      return true;
    }
  }
}

var listChangeObserver = new MutationObserver(function (mutations) {
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

var findOrInsertSpan = function(parent, className, insertBeforeClass) {
  var span = parent.querySelector('.' + className);
  if (!span) {
    span = document.createElement('span');
    span.className = className;
    var insertBeforeElement = (insertBeforeClass ? parent.querySelector('.' + insertBeforeClass) : parent.firstChild);
    parent.insertBefore(span, insertBeforeElement);
  }
  return span;
}

var removeIfExists = function(parent, className) {
  var element = parent.querySelector('.' + className);
  if (element) {
    element.parentNode.removeChild(element);
  }
}

var calculateStoryPointsForTitle = function (title) {
  if (!settings.showStoryPoints) return;
  var matches = title.match(storyPointsRegexp);
  if (matches) {
    var points = matches[1];
    if (points === '?') return '?';
    return parseFloat(points.replace(',','.'));
  }
}

var calculatePostPointsForTitle = function (title) {
  if (!settings.showPostPoints) return;
  var matches = title.match(postPointsRegexp);
  if (matches) {
    var points = matches[1];
    if (points === '?') return '?';
    return parseFloat(points.replace(',','.'));
  }
}

var sanitizePoints = function (points) {
  if (points === '?') return 0;
  if (!points) return 0;
  return points;
}

var formatPoints = function (points) {
  if (points === '?') return '?';
  return Math.round(points * 10) / 10;
}

var calculatePointsForCard = function (card) {
  var contentMutated = false;

  var cardNameElement = card.querySelector('.js-card-name');
  if (!cardNameElement) {
    return {
      story: 0,
      post: 0
    };
  }

  var originalTitle = card.getAttribute('data-original-title');

  if (settings.showCardNumbers) {
    var cardShortId = cardNameElement.querySelector('.card-short-id');
    var cardIdElement = findOrInsertSpan(cardNameElement, 'scrummer-card-id');
    cardIdElement.textContent = cardShortId.textContent;
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
    return {
      story: 0,
      post: 0
    };
  }

  var calculatedPoints = calculateStoryPointsForTitle(originalTitle);
  var calculatedPostPoints = calculatePostPointsForTitle(originalTitle);

  if (
    !contentMutated &&
    card.getAttribute('data-calculated-points') == calculatedPoints &&
    card.getAttribute('data-calculated-post-points') == calculatedPostPoints
  ) {
    return {
      story: calculatedPoints || 0,
      post: calculatedPostPoints || 0
    }
  }

  if (calculatedPoints !== undefined) {
    var badgeElement = findOrInsertSpan(cardNameElement, 'scrummer-points', 'card-short-id');
    badgeElement.textContent = formatPoints(calculatedPoints);
    card.setAttribute('data-calculated-points', calculatedPoints);
  } else {
    removeIfExists(cardNameElement, 'scrummer-points');
  }

  if (calculatedPostPoints !== undefined) {
    var badgeElement = findOrInsertSpan(cardNameElement, 'scrummer-post-points', 'card-short-id');
    badgeElement.textContent = formatPoints(calculatedPostPoints);
    card.setAttribute('data-calculated-post-points', calculatedPostPoints);
  } else {
    removeIfExists(cardNameElement, 'scrummer-post-points');
  }

  var cleanedTitle = originalTitle;
  if (settings.showStoryPoints) cleanedTitle = cleanedTitle.replace(storyPointsRegexp, '');
  if (settings.showPostPoints)  cleanedTitle = cleanedTitle.replace(postPointsRegexp, '');
  cardNameElement.lastChild.textContent = cleanedTitle.trim();

  return {
    story: sanitizePoints(calculatedPoints),
    post: sanitizePoints(calculatedPostPoints)
  };
}

var calculatePointsForList = function (list) {
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
  var listPoints = Array.prototype.slice.call(list.querySelectorAll('.list-card:not(.hide)'))
  .reduce((listPoints, list) => {
    var cardPoints = calculatePointsForCard(list);
    listPoints.story += cardPoints.story;
    listPoints.post += cardPoints.post;
    return listPoints;
  }, { story: 0, post: 0 });

  var listHeader = null;
  if (settings.showColumnTotals && (listHeader = list.querySelector('.js-list-header'))) {
    // Add or update points badges
    if (settings.showStoryPoints) {
      var badge = findOrInsertSpan(listHeader, 'scrummer-list-points', 'js-list-name-input');
      badge.textContent = formatPoints(listPoints.story);
    }
    if (settings.showPostPoints) {
      var badge = findOrInsertSpan(listHeader, 'scrummer-list-post-points', 'js-list-name-input');
      badge.textContent = formatPoints(listPoints.post);
    }
  }

  return listPoints;
}

var calculatePointsForBoard = function () {

  // Array.slice can convert a NodeList to an array
  var boardPoints = Array.prototype.slice.call(document.querySelectorAll('.list'))
  .reduce((boardPoints, list) => {
    var listPoints = calculatePointsForList(list);
    boardPoints.story += listPoints.story;
    boardPoints.post += listPoints.post;
    return boardPoints;
  }, { story: 0, post: 0 });

  var boardHeader = null;
  if (settings.showBoardTotals && (boardHeader = document.querySelector('.js-board-header'))) {
    // Add or update points badges
    if (settings.showStoryPoints) {
      var badge = findOrInsertSpan(boardHeader, 'scrummer-board-points', 'board-header-btn-name');
      badge.textContent = formatPoints(boardPoints.story);
    }
    if (settings.showPostPoints) {
      var badge = findOrInsertSpan(boardHeader, 'scrummer-board-post-points', 'board-header-btn-name');
      badge.textContent = formatPoints(boardPoints.post);
    }
  }

  listChangeObserver.observe(document.querySelector('.js-list-sortable'), {
    childList: true,
    characterData: false,
    attributes: false
  });
}

var calculatePointsForBoardDebounced = function () {
  debounce(calculatePointsForBoard, 100)();
}

var buildPickerRow = (storyOrPost) => {
  var row = document.createElement('div');
  row.className = 'scrummer-picker-row';

  pointsScale.forEach(function (value) {
    var button = document.createElement('a');
    button.textContent = value;
    button.href = 'javascript:;';

    button.addEventListener('click', insertPoints.bind(this, value, storyOrPost));
    button.className = storyOrPost === 'story' ? 'scrummer-picker-button' : 'scrummer-picker-post-button';
    row.appendChild(button);
  });

  return row;
}

/**
 * The point picker
 */
var buildPicker = function () {
  var itemsContainer = document.createElement('div');
  itemsContainer.className = 'scrummer-picker-container';
  if (settings.showStoryPoints) itemsContainer.appendChild(buildPickerRow('story'));
  if (settings.showPostPoints) itemsContainer.appendChild(buildPickerRow('post'));

  return itemsContainer;
}

/**
 * This sets up a listener to see if a detail window is presented
 */
var setupWindowListener = function (callback) {
  var windowChangeObserver = new MutationObserver(function (mutations) {
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
Podium.keydown = function(k) {
  var oEvent = document.createEvent('KeyboardEvent');

  // Chromium Hack
  Object.defineProperty(oEvent, 'keyCode', {
    get: function() {
      return this.keyCodeVal;
    }
  });
  Object.defineProperty(oEvent, 'which', {
    get: function() {
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
var insertPoints = (value, storyOrPost, event) => {
  event.stopPropagation();

  var titleField = document.querySelector('.js-card-detail-title-input');

  titleField.click();
  titleField.focus();

  // Remove old points
  if (storyOrPost === 'story') {
    var storyPointsForTitle = calculateStoryPointsForTitle(titleField.value);
    var cleanedTitle = titleField.value.replace(storyPointsRegexp, '').trim();
    titleField.value = '(' + value + ') ' + cleanedTitle;
  }
  else {
    var postPointsForTitle = calculatePostPointsForTitle(titleField.value);
    var cleanedTitle = titleField.value.replace(postPointsRegexp, '').trim();
    titleField.value = '[' + value + '] ' + cleanedTitle;
  }

  Podium.keydown(13);

  // Hide controls
  document.querySelector('.scrummer-picker-container').parentNode.removeChild(document.querySelector('.scrummer-picker-container'));
}

var checkForLists = function () {
  if (document.querySelectorAll('.list').length > 0) {
    calculatePointsForBoard();

    if (settings.showPicker) {
      setupWindowListener(function () {
        if (document.querySelector('.scrummer-picker-container')) {
          return;
        }

        var editControls = document.querySelector('.js-current-list');
        editControls.insertBefore(buildPicker(), editControls.firstChild);
      });
    }
  } else {
    setTimeout(checkForLists, 300);
  }
}

var settings = {};
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
