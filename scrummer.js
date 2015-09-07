var debounce = function(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

var listChangeObserver = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    // If the list was modified, recalculate
    if (mutation.target.classList.contains('list-cards') ||
        mutation.target.classList.contains('list-header-num-cards')) {
      setTimeout(calculateStoryPointsForBoardDebounced, 250);
      return;
    }

    if (mutation.removedNodes.length === 1 || mutation.addedNodes.length === 1) {
      return;
    }

    // If a single card's content is mutated
    if (mutation.target.classList.contains('js-card-name')) {
      mutation.target.setAttribute('data-mutated', true);

      calculateStoryPointsForBoardDebounced();
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

var calculateStoryPointsForCard = function (card) {
  // Get the title from the card
  var cardNameElement = card.querySelector('.js-card-name');

  if (!cardNameElement) {
    return 0;
  }

  var originalTitle = card.getAttribute('data-original-title');

  if (!originalTitle || cardNameElement.getAttribute('data-mutated')) {
    originalTitle = cardNameElement.lastChild.textContent;
    card.setAttribute('data-mutated', false);
  }

  if (!originalTitle) {
    return 0;
  }

  var calculatedPoints = calculateStoryPointsForTitle(originalTitle);

  // If the calculated points are not different from what we have
  if (card.getAttribute('data-calculated-points') === calculatedPoints) {
    return calculatedPoints;
  }

  // Store the original title and calculated points
  card.setAttribute('data-original-title', originalTitle);
  card.setAttribute('data-calculated-points', calculatedPoints);

  var badgeElement = card.querySelector('.scrummer-points');
  if (calculatedPoints) {
    if (!badgeElement) {
      badgeElement = document.createElement('span');
      badgeElement.className = 'scrummer-points';
      cardNameElement.insertBefore(badgeElement, cardNameElement.firstChild);
    }

    badgeElement.innerText = calculatedPoints;

    cardNameElement.lastChild.textContent = originalTitle.replace('(' + calculatedPoints + ')', '').trim();
  } else if (badgeElement) {
    badgeElement.parentNode.removeChild(badgeElement);
  }

  if (calculatedPoints) {
    return calculatedPoints;
  }

  return 0;
}

var calculateStoryPointsForList = function (list) {
  // Observe this list for changes
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

  var cards = list.querySelectorAll('.list-card:not(.hide)');
  for (var i = 0; i < cards.length; i++) {
		var cardPoints = calculateStoryPointsForCard(cards[i]);
		if (cardPoints !== '?') {
    	listPoints += cardPoints;
		}
  }

  var listHeader = list.querySelector('.js-list-name');
  var badgeElement = listHeader.querySelector('.scrummer-list-points');
  if (!badgeElement) {
    badgeElement = document.createElement('span');
    badgeElement.className = 'scrummer-list-points';
    listHeader.insertBefore(badgeElement, listHeader.firstChild);
  }

  badgeElement.innerText = listPoints;
}

var calculateStoryPointsForBoard = function () {
  var lists = document.querySelectorAll('.list');
  for (var i = 0; i < lists.length; i++) {
    calculateStoryPointsForList(lists[i]);
  }
}

var calculateStoryPointsForBoardDebounced = function () {
  debounce(calculateStoryPointsForBoard, 200, true)();
}

var checkForLists = function () {
	if (document.querySelectorAll('.list').length > 0) {
		calculateStoryPointsForBoard();

		setupWindowListener(function () {
			if (document.querySelector('.scrummer-picker-container')) {
				return;
			}

			var editControls = document.querySelector('.edit .edit-controls');

			editControls.insertBefore(buildPicker(['X', '?', '0', '1', '3', '5', '8', '13', '20', '40', '100'], function (value, e) {
				e.stopPropagation();

				var titleField = document.querySelector('.window-title .edit .field');

				// Remove old points
				var storypointsForTitle = calculateStoryPointsForTitle(titleField.value);
				var cleanedTitle = titleField.value.replace('(' + storypointsForTitle + ')', '').trim();

				// Prepend new points
				if (value !== 'X') {
					titleField.value = '(' + value + ') ' + cleanedTitle;
				} else {
					titleField.value = cleanedTitle;
				}

				// Close and save
				editControls.querySelector('.js-save-edit').click();
			}), editControls.firstChild);
		});
	} else {
		setTimeout(checkForLists, 300);
	}
}

// Launch the plugin by checking at a certain interval if any
// lists have been loaded.
checkForLists();

/**
 * The point picker
 */
var buildPicker = function (values, callback) {
	var itemsContainer = document.createElement('div');
	itemsContainer.className = 'scrummer-picker-container';

	values.forEach(function (value) {
		var button = document.createElement('a');
		button.innerText = value;
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
			if (mutation.target.classList.contains('edit-controls')) {
				callback();
			}
		});
	});

	windowChangeObserver.observe(document.querySelector('.window-overlay'), {
		childList: true,
		characterData: false,
		attributes: false,
		subtree: true
	});
}
