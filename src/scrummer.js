var pointsScale = '0.5,0,1,2,3,5,8,13,20,40,100';

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
    if (
      (mutation.addedNodes.length === 1 && containsNodeWithClass(mutation.addedNodes, 'scrummer-points')) ||
      (mutation.addedNodes.length === 1 && containsNodeWithClass(mutation.addedNodes, 'scrummer-post-points')) ||
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

var pointsRegex = /((?:^|\s))\((\x3f|\d*\.?\d+)(\))\s?/m
var postPointsRegex = /((?:^|\s))\[(\x3f|\d*\.?\d+)(\])\s?/m

var findOrInsertSpan = function(parent, className, insertBeforeClass) {
  var span = parent.querySelector('.' + className);
  if (!span) {
    span = document.createElement('span');
    span.className = className;
    parent.insertBefore(span, parent.querySelector('.' + insertBeforeClass));
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
  var matches = title.match(pointsRegex);
  if (matches) {
    if (matches[2] === '?') {
      return '?';
    }
    return parseFloat(matches[2]);
  }
}

var calculatePostPointsForTitle = function (title) {
  var matches = title.match(postPointsRegex);
  if (matches) {
    if (matches[2] === '?') {
      return '?';
    }
    return parseFloat(matches[2]);
  }
}

var calculatePointsForCard = function (card) {
  var contentMutated = false;

  var cardNameElement = card.querySelector('.js-card-name');
  if (!cardNameElement) {
    return 0;
  }

  var originalTitle = card.getAttribute('data-original-title');

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
    return 0;
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
    badgeElement.textContent = Math.round(calculatedPoints * 10) / 10;
    card.setAttribute('data-calculated-points', calculatedPoints);
  } else {
    removeIfExists(cardNameElement, 'scrummer-points');
  }

  if (calculatedPostPoints !== undefined) {
    var badgeElement = findOrInsertSpan(cardNameElement, 'scrummer-post-points', 'card-short-id');
    badgeElement.textContent = Math.round(calculatedPostPoints * 10) / 10;
    card.setAttribute('data-calculated-post-points', calculatedPostPoints);
  } else {
    removeIfExists(cardNameElement, 'scrummer-post-points');
  }

  cardNameElement.lastChild.textContent = originalTitle
  .replace('(' + calculatedPoints + ')', '')
  .replace('[' + calculatedPostPoints + ']', '')
  .trim();

  return {
    story: calculatedPoints || 0,
    post: calculatedPostPoints || 0
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

  var listPoints = {
    story: 0,
    post: 0
  };

  var cards = list.querySelectorAll('.list-card:not(.hide)');
  for (var i = 0; i < cards.length; i++) {
    var points = calculatePointsForCard(cards[i]);
    listPoints.story += points.story;
    listPoints.post += points.post;
  }

  var listHeader = list.querySelector('.js-list-header');
  // Add or update points badges
  var badgeElement = findOrInsertSpan(listHeader, 'scrummer-list-points', 'js-list-name-input');
  badgeElement.textContent = Math.round(listPoints.story * 10) / 10;
  var postBadgeElement = findOrInsertSpan(listHeader, 'scrummer-list-post-points', 'js-list-name-input');
  postBadgeElement.textContent = Math.round(listPoints.post * 10) / 10;

  return listPoints;
}

var calculatePointsForBoard = function () {
  var boardPoints = {
    story: 0,
    post: 0
  };

  var lists = document.querySelectorAll('.list');
  for (var i = 0; i < lists.length; i++) {
    var points = calculatePointsForList(lists[i]);
    boardPoints.story += points.story;
    boardPoints.post += points.post;
  }

  var boardHeader = document.querySelector('.js-board-header');
  // Add or update points badges
  var badgeElement = findOrInsertSpan(boardHeader, 'scrummer-board-points', 'board-header-btn-name');
  badgeElement.textContent = Math.round(boardPoints.story * 10) / 10;
  var postBadgeElement = findOrInsertSpan(boardHeader, 'scrummer-board-post-points', 'board-header-btn-name');
  postBadgeElement.textContent = Math.round(boardPoints.post * 10) / 10;

  listChangeObserver.observe(document.querySelector('.js-list-sortable'), {
    childList: true,
    characterData: false,
    attributes: false
  });
}

var calculatePointsForBoardDebounced = function () {
  debounce(calculatePointsForBoard, 100)();
}

/**
 * The point picker
 */
var buildPicker = function (values, callback) {
  var itemsContainer = document.createElement('div');
  itemsContainer.className = 'scrummer-picker-container';
  var firstRow = document.createElement('div');
  firstRow.className = 'scrummer-picker-row';
  var secondRow = firstRow.cloneNode(true);
  itemsContainer.appendChild(firstRow);
  itemsContainer.appendChild(secondRow);

  values.forEach(function (value) {
    var button = document.createElement('a');
    button.textContent = value;
    button.href = 'javascript:;';
    var postButton = button.cloneNode();

    button.addEventListener('click', callback.bind(this, value, 'story'));
    button.className = 'scrummer-picker-button';
    firstRow.appendChild(button);
    postButton.addEventListener('click', callback.bind(this, value, 'post'));
    postButton.className = 'scrummer-picker-post-button';
    secondRow.appendChild(button);
  });

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
                get : function() {
                    return this.keyCodeVal;
                }
    });
    Object.defineProperty(oEvent, 'which', {
                get : function() {
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

var checkForLists = function () {
  if (document.querySelectorAll('.list').length > 0) {
    calculatePointsForBoard();

    setupWindowListener(function () {
      if (document.querySelector('.scrummer-picker-container')) {
        return;
      }

      var editControls = document.querySelector('.js-current-list');

      editControls.insertBefore(buildPicker(['?'].concat(pointsScale.split(',')), function (value, storyOrPost, e) {
        e.stopPropagation();

        var titleField = document.querySelector('.js-card-detail-title-input');

        titleField.click();
        titleField.focus();

        // Remove old points
        if (storyOrPost === 'story') {
          var storyPointsForTitle = calculateStoryPointsForTitle(titleField.value);
          var cleanedTitle = titleField.value.replace('(' + storyPointsForTitle + ')', '').trim();
          titleField.value = '(' + value + ') ' + cleanedTitle;
        }
        else {
          var postPointsForTitle = calculatePostPointsForTitle(titleField.value);
          var cleanedTitle = titleField.value.replace('[' + postPointsForTitle + ']', '').trim();
          titleField.value = '[' + value + '] ' + cleanedTitle;
        }

        Podium.keydown(13);

        // Hide controls
        document.querySelector('.scrummer-picker-container').parentNode.removeChild(document.querySelector('.scrummer-picker-container'));
      }), editControls.firstChild);
    });
  } else {
    setTimeout(checkForLists, 300);
  }
}

// Launch the plugin by checking at a certain interval if any
// lists have been loaded.
checkForLists();
