var pointsScale = '0,0.5,1,2,3,5,8,13,20,40,100';

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
    if ((mutation.addedNodes.length === 1 && containsNodeWithClass(mutation.addedNodes, 'scrummer-points')) ||
        (mutation.removedNodes.length === 1 && containsNodeWithClass(mutation.removedNodes, 'scrummer-points'))) {
      return;
    }

    // If the list was modified, recalculate
    if (mutation.target.classList.contains('list-cards') ||
        mutation.target.classList.contains('list-header-num-cards') ||
        mutation.target.classList.contains('js-list-sortable')) {
      setTimeout(calculateStoryPointsForBoardDebounced);
      return;
    }

    // If a single card's content is mutated
    if (mutation.target.classList.contains('js-card-name')) {
      mutation.target.setAttribute('data-mutated', 1);

      setTimeout(calculateStoryPointsForBoardDebounced);
    }
  });
});

var pointsRegex = /((?:^|\s))\((\x3f|\d*\.?\d+)(\))\s?/m

var calculateStoryPointsForTitle = function (title) {
  var matches = title.match(pointsRegex);
  if (matches) {
    if (matches[2] === '?') {
      return '?';
    }

    return parseFloat(matches[2]);
  }
}

var calculateStoryPointsForCard = function (card, pointsSinceSeparator) {
  // Get the title from the card
  var cardNameElement = card.querySelector('.js-card-name');
  var contentMutated = false;

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

  if (!originalTitle) {
    return 0;
  }

  // If this is a separator-card, detect it here
  if (originalTitle.indexOf('#!!') === 0) {
    cardNameElement.lastChild.textContent = pointsSinceSeparator + ' points';

    if (originalTitle.replace('#!!', '').trim().length > 0) {
      cardNameElement.lastChild.textContent += ' - ' + originalTitle.replace('#!!', '').trim();
    }

    card.classList.add('scrummer-separator-card');

    return {
      points: 0,
      type: 'separator'
    };
  }

  var calculatedPoints = calculateStoryPointsForTitle(originalTitle);

  // If the calculated points are not different from what we have
  // (double == is to compare parsed floats and strings correctly)
  if (!contentMutated && card.getAttribute('data-calculated-points') == calculatedPoints) {
    return calculatedPoints;
  }

  var badgeElement = card.querySelector('.scrummer-points');
  if (calculatedPoints !== undefined) {
    if (!badgeElement) {
      badgeElement = document.createElement('span');
      badgeElement.className = 'scrummer-points';
      cardNameElement.insertBefore(badgeElement, cardNameElement.firstChild);
    }

    badgeElement.textContent = calculatedPoints;

    cardNameElement.lastChild.textContent = originalTitle.replace('(' + calculatedPoints + ')', '').trim();

    card.setAttribute('data-calculated-points', calculatedPoints);
  } else if (badgeElement) {
    badgeElement.parentNode.removeChild(badgeElement);
  }

  if (calculatedPoints) {
    return calculatedPoints;
  }

  return 0;
}

var calculateStoryPointsForList = function (list) {
  listChangeObserver.observe(list, {
    childList: true,
    characterData: false,
    attributes: false,
    subtree: true
  });

  listChangeObserver.observe(list.querySelector('.list-header-num-cards'), {
    attributes: true
  });

  var listPoints = 0;
  var pointsSinceSeparator = 0;

  var cards = list.querySelectorAll('.list-card:not(.hide)');
  for (var i = 0; i < cards.length; i++) {
    var cardPoints = calculateStoryPointsForCard(cards[i], pointsSinceSeparator);

    if (!cardPoints) {
      continue;
    }

    if (cardPoints.type && cardPoints.type === 'separator') {
      pointsSinceSeparator = 0;
    } else if (cardPoints !== '?') {
      listPoints += cardPoints;
      pointsSinceSeparator += cardPoints;
    }
  }

  var listHeader = list.querySelector('.js-list-header');
  var badgeElement = listHeader.querySelector('.scrummer-list-points');
  if (!badgeElement) {
    badgeElement = document.createElement('span');
    badgeElement.className = 'scrummer-list-points';
    listHeader.insertBefore(badgeElement, listHeader.querySelector('.js-list-name-input'))
  }

  badgeElement.textContent = listPoints;

  return listPoints;
}

var calculateStoryPointsForBoard = function () {
  var totalPoints = 0;

  var lists = document.querySelectorAll('.list');
  for (var i = 0; i < lists.length; i++) {
    totalPoints += calculateStoryPointsForList(lists[i]);
  }

  var boardHeader = document.querySelector('.js-board-header');
  var badgeElement = boardHeader.querySelector('.scrummer-board-points');
  if (!badgeElement) {
    badgeElement = document.createElement('span');
    badgeElement.className = 'scrummer-board-points';
    boardHeader.insertBefore(badgeElement, boardHeader.firstChild);
  }

  badgeElement.textContent = totalPoints;

  listChangeObserver.observe(document.querySelector('.js-list-sortable'), {
    childList: true,
    characterData: false,
    attributes: false
  });
}

var calculateStoryPointsForBoardDebounced = function () {
  debounce(calculateStoryPointsForBoard, 100)();
}

/**
 * The point picker
 */
var buildPicker = function (values, callback) {
  var itemsContainer = document.createElement('div');
  itemsContainer.className = 'scrummer-picker-container';

  values.forEach(function (value) {
    var button = document.createElement('a');
    button.textContent = value;
    button.addEventListener('click', callback.bind(this, value));
    button.href = 'javascript:;';
    button.className = 'scrummer-picker-button';
    itemsContainer.appendChild(button);
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
    calculateStoryPointsForBoard();

    setupWindowListener(function () {
      if (document.querySelector('.scrummer-picker-container')) {
        return;
      }

      var editControls = document.querySelector('.js-current-list');

      editControls.insertBefore(buildPicker(['X', '?'].concat(pointsScale.split(',')), function (value, e) {
        e.stopPropagation();

        var titleField = document.querySelector('.js-card-detail-title-input');

        titleField.click();
        titleField.focus();

        // Remove old points
        var storypointsForTitle = calculateStoryPointsForTitle(titleField.value);
        var cleanedTitle = titleField.value.replace('(' + storypointsForTitle + ')', '').trim();

        // Prepend new points
        if (value !== 'X') {
          titleField.value = '(' + value + ') ' + cleanedTitle;
        } else {
          titleField.value = cleanedTitle;
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
