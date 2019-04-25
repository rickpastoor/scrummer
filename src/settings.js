[
  'showCardNumbers',
  'showStoryPoints',
  'showPostPoints',
  'showHourPoints',
  'showColumnTotals',
  'showBoardTotals',
  'showPicker'
].forEach(option => {
  var checkboxDiv = document.getElementById(option);

  chrome.storage.sync.get(option, items => {
    if (items[option] !== undefined) {
      checkboxDiv.checked = items[option];
      return;
    }
    if ('showHourPoints' === option) {
      checkboxDiv.checked = false;
      return;
    }
    checkboxDiv.checked = true;
  });

  checkboxDiv.addEventListener('click', event => {
    chrome.storage.sync.set({ [event.target.id]: event.target.checked });
  });
});
