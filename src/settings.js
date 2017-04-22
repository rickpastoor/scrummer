['showCardNumbers', 'showStoryPoints', 'showPostPoints', 'showColumnTotals', 'showBoardTotals', 'showPicker']
.forEach((option) => {
  var checkboxDiv = document.getElementById(option);

  chrome.storage.sync.get(option, (items) => {
    checkboxDiv.checked = items[option] === undefined ? true : items[option];
  });

  checkboxDiv.addEventListener('click', (event) => {
    chrome.storage.sync.set({ [event.target.id]: event.target.checked });
  });
});
