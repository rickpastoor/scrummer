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

var changeObserver = new MutationObserver(function (mutations) {
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
      return null;
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
  changeObserver.observe(list, {
    childList: true,
    characterData: false,
    attributes: false,
    subtree: true
  });

  changeObserver.observe(list.querySelector('.list-header-num-cards'), {
    attributes: true
  });

  var listPoints = 0;

  var cards = list.querySelectorAll('.list-card:not(.hide)');
  for (var i = 0; i < cards.length; i++) {
    listPoints += calculateStoryPointsForCard(cards[i])
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

setTimeout(calculateStoryPointsForBoard, 3000)
