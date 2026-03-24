var allItems = [];
var saveData = [];
var googleTokenClient = null;
var googleAccessToken = null;
var googleTokenExpiresAt = 0;
var googleSyncTimer = null;

var STORAGE_KEY = 'warframe-collections';
var GOOGLE_CLIENT_ID_KEY = 'warframe-google-client-id';
var GOOGLE_AUTO_SYNC_KEY = 'warframe-google-auto-sync';
var GOOGLE_LAST_SYNC_KEY = 'warframe-google-last-sync';
var GOOGLE_DATA_FILE = 'warframe-collections.json';
var GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

loadSavedData();

$(document).ready(function() {
	$('#search').on('input', search);
	$(document).on('change', 'input[type=checkbox]', handleCheckboxChanged);
	$('#import-field').on('change', updateImportLabel);
	$('#export-button').click(function() {
		downloadObjectAsJson(saveData, 'warframe-collections');
	});
	$('#import-button').click(function() {
		handleFileSelect();
	});

	initializeSaveMenuUi();
	initializeGoogleSyncUi();

	$.when(
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Arch-Gun.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Arch-Melee.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Archwing.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Melee.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Primary.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Secondary.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Sentinels.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Warframes.json')
	).then(function() {
		allItems = allItems.sort(function(x, y) {
			return x.name < y.name ? -1 : 1;
		});

		var firstTag = null;
		var listTag = $('#all-items');
		for (var i = 0; i < allItems.length; ++i) {
			var item = allItems[i];
			var name = item.name;
			if (item.vaulted)
				name += ' *';
			var itemTag = $('<li>')
				.addClass('list-group-item')
				.text(name)
				.click(itemClick)
				.data('id', item.uniqueName)
				.tooltip({ html: true });

			var savedItem = getDataById(saveData, item.uniqueName);
			if (savedItem) {
				if (savedItem.mastered)
					itemTag.addClass('list-group-item-success');
				else if (savedItem.crafted)
					itemTag.addClass('list-group-item-warning');
			}

			if (!firstTag)
				firstTag = itemTag;
			listTag.append(itemTag);
		}

		updateSummary();
		if (firstTag)
			firstTag.trigger('click');
	});
});

function initializeSaveMenuUi() {
	$('#save-menu-toggle').on('click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		toggleSaveMenu();
	});

	$('#save-menu-close').on('click', function() {
		closeSaveMenu();
	});

	$('#save-menu-popover').on('click', function(e) {
		e.stopPropagation();
	});

	$('.auth-tabs .nav-link').on('click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		activateSaveTab($(this));
	});

	$(document).on('click', function() {
		closeSaveMenu();
	});

	$(document).on('keydown', function(e) {
		if (e.key === 'Escape')
			closeSaveMenu();
	});

	activateSaveTab($('#local-tab-link'));
}

function toggleSaveMenu() {
	if ($('#save-menu-popover').prop('hidden'))
		openSaveMenu();
	else
		closeSaveMenu();
}

function openSaveMenu() {
	$('#save-menu-popover').prop('hidden', false);
	$('#save-menu-toggle').attr('aria-expanded', 'true');
}

function closeSaveMenu() {
	$('#save-menu-popover').prop('hidden', true);
	$('#save-menu-toggle').attr('aria-expanded', 'false');
}

function activateSaveTab(tab) {
	if (!tab || !tab.length)
		return;

	var targetSelector = tab.attr('href');
	$('.auth-tabs .nav-link').removeClass('active').attr('aria-selected', 'false');
	tab.addClass('active').attr('aria-selected', 'true');

	$('.auth-pane').removeClass('show active');
	$(targetSelector).addClass('show active');
}

function loadItems(url) {
	return $.getJSON(url, function(data) {
		allItems = allItems.concat(data);
	});
}

function search() {
	var val = $(this).val().toLowerCase();
	var searchStrings = val.split('|');
	$('.list-group-item').each(function() {
		var item = getItem($(this).data('id'));
		if (val == '' || isItemMatch(item, searchStrings))
			$(this).show();
		else
			$(this).hide();
	});

	updateVisibleCount();
	$('.list-group-item:visible:first').trigger('click');
}

function isItemMatch(item, searches) {
	for (var i = 0; i < searches.length; ++i)
		if (andMatch(item, searches[i].split(',')))
			return true;
	return false;
}

function andMatch(item, searches) {
	for (var i = 0; i < searches.length; ++i)
		if (!matchKeyword(item, searches[i].trim()))
			return false;
	return true;
}

function matchKeyword(item, keyword) {
	if (!keyword)
		return false;

	var savedItem = getDataById(saveData, item.uniqueName);
	switch (keyword) {
		case 'is:vaulted':
			return item.vaulted === true;
		case 'not:vaulted':
			return item.vaulted !== true;
		case 'is:mastered':
			return savedItem && savedItem.mastered;
		case 'not:mastered':
			return !savedItem || !savedItem.mastered;
		case 'is:crafted':
			return savedItem && savedItem.crafted;
		case 'not:crafted':
			return !savedItem || !savedItem.crafted;
	}

	if (item.name.toLowerCase().includes(keyword))
		return true;

	if (item.category.toLowerCase().trim() == keyword)
		return true;

	if (item.components) {
		for (var c = 0; c < item.components.length; ++c) {
			var component = item.components[c];
			var savedComponent = savedItem ? getDataById(savedItem.components, component.uniqueName) : null;
			if (component.name.toLowerCase().includes('forma'))
				continue;

			var cleanKeyword = keyword;
			if (keyword.startsWith('notowned:')) {
				if (savedComponent && savedComponent.owned)
					continue;

				cleanKeyword = keyword.substring('notowned:'.length);
			}

			if (component.drops) {
				for (var d = 0; d < component.drops.length; ++d) {
					var drop = component.drops[d];
					var loc = drop.location.toLowerCase();
					if (loc.includes(cleanKeyword))
						return true;
				}
			}
		}
	}

	return false;
}

function itemClick() {
	var tag = $(this);
	$('#all-items>li').removeClass('active');
	tag.addClass('active');
	showItem(tag.data('id'));
}

function getItem(id) {
	for (var i = 0; i < allItems.length; ++i) {
		if (allItems[i].uniqueName == id)
			return allItems[i];
	}
	return null;
}

function showItem(id) {
	var item = getItem(id);
	if (item == null)
		return;

	var mainTag = $('#main-content');
	mainTag.data('id', item.uniqueName);
	$('h1', '#main-content').text(item.name);
	$('.category-chip', mainTag).text(item.category);
	$('.vaulted-chip', mainTag).toggle(!!item.vaulted).toggleClass('is-vaulted', !!item.vaulted);
	$('.empty-copy', mainTag).hide();
	var componentsTag = $('table.components');
	$('input[type=checkbox]').prop('checked', false);
	$('table.components tbody tr:not(.component-template)').remove();

	if (item.components) {
		for (var i = 0; i < item.components.length; ++i) {
			var component = item.components[i];

			var componentTag = $('.component-template', componentsTag)
				.clone()
				.data('id', component.uniqueName)
				.show()
				.removeClass('component-template');
			$('.amount .amount-badge', componentTag).text(component.itemCount);
			$('.name .component-name', componentTag).text(component.name);

			var dropText = createDropInfoText(component.drops);
			if (dropText) {
				$('.component-info', componentTag)
					.prop('title', dropText)
					.show();
			} else {
				$('.component-info', componentTag).hide();
			}

			componentsTag.append(componentTag);

			if (component.name == 'Blueprint')
				$('.component-crafted', componentTag).hide();
		}
	}
	$('[data-toggle="tooltip"]').tooltip();
	loadCheckboxStates(id);
}

function loadCheckboxStates(id) {
	var item = getDataById(saveData, id);
	if (item == null)
		return;

	var main = $('#main-content');
	$('.item-mastered').prop('checked', item.mastered);
	$('.item-crafted').prop('checked', item.crafted);

	$('.components tr', main).each(function() {
		var component = getDataById(item.components, $(this).data('id'));
		if (component == null)
			return;

		$('.component-crafted', $(this)).prop('checked', component.crafted);
		$('.component-owned', $(this)).prop('checked', component.owned);
	});
}

function createDropInfoText(drops) {
	if (!drops)
		return null;

	drops = drops.sort(function(x, y) {
		return x.location < y.location ? -1 : 1;
	});
	var dropNames = [];
	var list = $('<ul>');
	for (var i = 0; i < drops.length; ++i) {
		var location = drops[i].location;
		if (location.toLowerCase().startsWith('lith') ||
			location.toLowerCase().startsWith('meso') ||
			location.toLowerCase().startsWith('neo') ||
			location.toLowerCase().startsWith('axi')) {
			var relicParts = location.split(' ');
			relicParts.pop();
			location = relicParts.join(' ');
		}

		if (dropNames.includes(location.toLowerCase()))
			continue;

		dropNames.push(location.toLowerCase());

		if (drops[i].rarity)
			location += ' (' + drops[i].rarity + ')';

		list.append($('<li>').text(location));
	}
	return $('<div>').append(list).html();
}

function loadSavedData() {
	var rawData = localStorage.getItem(STORAGE_KEY);
	saveData = JSON.parse(rawData);
	if (saveData == null)
		saveData = [];
}

function saveCurrentItem() {
	var itemId = $('#main-content').data('id');
	removeDataById(saveData, itemId);

	var item = {
		id: itemId,
		crafted: $('.item-crafted', '#main-content').is(':checked'),
		mastered: $('.item-mastered', '#main-content').is(':checked'),
		components: []
	};
	$('table.components tbody tr:not(.component-template)').each(function() {
		var component = {
			id: $(this).data('id'),
			owned: $('.component-owned', this).is(':checked'),
			crafted: $('.component-crafted', this).is(':checked')
		};
		item.components.push(component);
	});

	saveData.push(item);
	persistSaveData();

	var tag = findItemTagById(itemId);
	if (tag) {
		tag.removeClass('list-group-item-success');
		tag.removeClass('list-group-item-warning');
		if (item.mastered)
			tag.addClass('list-group-item-success');
		else if (item.crafted)
			tag.addClass('list-group-item-warning');
	}

	updateSummary();
	scheduleGoogleAutoSync();
}

function persistSaveData() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
}

function findItemTagById(id) {
	var result = null;
	$('.list-group-item', '#all-items').each(function() {
		if ($(this).data('id') == id)
			return result = $(this);
	});
	return result;
}

function getDataById(data, id) {
	for (var i = 0; i < data.length; ++i) {
		if (data[i].id == id)
			return data[i];
	}
	return null;
}

function removeDataById(data, id) {
	var item = getDataById(data, id);
	if (item == null)
		return;

	var index = data.indexOf(item);
	if (index > -1)
		data.splice(index, 1);
}

function handleCheckboxChanged() {
	var checked = $(this).is(':checked');
	var item = $('#main-content');
	if ($(this).hasClass('item-mastered')) {
		if (checked)
			$('input[type=checkbox]', item).prop('checked', true);
	}
	else if ($(this).hasClass('item-crafted')) {
		if (checked)
			$('.component-owned, .component-crafted', item).prop('checked', true);
		else
			$('.item-mastered', item).prop('checked', false);
	}
	else if ($(this).hasClass('component-crafted')) {
		var component = $(this).closest('tr');
		if (checked)
			$('.component-owned', component).prop('checked', true);
		else
			$('.item-mastered, .item-crafted', item).prop('checked', false);
	}
	else if ($(this).hasClass('component-owned')) {
		var component = $(this).closest('tr');
		if (!checked) {
			$('.component-crafted', component).prop('checked', false);
			$('.item-mastered, .item-crafted', item).prop('checked', false);
		}
	}

	saveCurrentItem();
}

function downloadObjectAsJson(exportObj, exportName) {
	var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj));
	var downloadAnchorNode = document.createElement('a');
	downloadAnchorNode.setAttribute('href', dataStr);
	downloadAnchorNode.setAttribute('download', exportName + '.json');
	document.body.appendChild(downloadAnchorNode);
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}

function handleFileSelect() {
	if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
		alert('The File APIs are not fully supported in this browser.');
		return;
	}

	var input = document.getElementById('import-field');
	if (!input) {
		alert("Um, couldn't find the fileinput element.");
	}
	else if (!input.files) {
		alert("This browser doesn't seem to support the `files` property of file inputs.");
	}
	else if (!input.files[0]) {
		alert("Please select a file before clicking 'Import'");
	}
	else {
		var file = input.files[0];
		var fr = new FileReader();
		fr.onload = function() {
			receiveImportedText(fr.result);
		};
		fr.readAsText(file);
	}
}

function receiveImportedText(text) {
	try {
		saveData = JSON.parse(text);
		if (!Array.isArray(saveData))
			throw new Error('Imported data must be an array.');
	}
	catch (err) {
		alert('That file is not a valid Warframe collection export.');
		return;
	}

	persistSaveData();
	scheduleGoogleAutoSync();
	location.reload();
}

function updateSummary() {
	var tracked = 0;
	var mastered = 0;
	for (var i = 0; i < saveData.length; ++i) {
		var item = saveData[i];
		if (item.crafted || item.mastered)
			tracked++;
		if (item.mastered)
			mastered++;
	}

	$('#tracked-count').text(tracked);
	$('#mastered-count').text(mastered);
	updateVisibleCount();
}

function updateVisibleCount() {
	$('#visible-count').text($('.list-group-item:visible').length);
}

function updateImportLabel() {
	var input = $('#import-field')[0];
	var label = 'Choose a saved collection JSON';
	if (input && input.files && input.files[0])
		label = input.files[0].name;

	$('.custom-file-label').text(label);
}

function initializeGoogleSyncUi() {
	$('#google-client-id').val(getGoogleClientId());
	$('#google-auto-sync').prop('checked', localStorage.getItem(GOOGLE_AUTO_SYNC_KEY) === 'true');
	$('#google-last-sync').text(localStorage.getItem(GOOGLE_LAST_SYNC_KEY) || 'Never');

	$('#save-google-client-id').on('click', saveGoogleClientId);
	$('#google-connect-button').on('click', connectGoogleAccount);
	$('#google-disconnect-button').on('click', disconnectGoogleAccount);
	$('#google-upload-button').on('click', function() {
		pushSaveDataToGoogle(true, true);
	});
	$('#google-download-button').on('click', function() {
		pullSaveDataFromGoogle(true);
	});
	$('#google-auto-sync').on('change', function() {
		localStorage.setItem(GOOGLE_AUTO_SYNC_KEY, $(this).is(':checked') ? 'true' : 'false');
		if ($(this).is(':checked'))
			scheduleGoogleAutoSync();
	});

	updateGoogleStatus('Not connected', 'Store a client ID, then connect a Google account to sync with Drive app data.', 'warning');
	waitForGoogleIdentityLibrary();
}

function waitForGoogleIdentityLibrary() {
	if (window.google && google.accounts && google.accounts.oauth2) {
		initializeGoogleTokenClient();
		return;
	}

	window.setTimeout(waitForGoogleIdentityLibrary, 250);
}

function getGoogleClientId() {
	return (localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || '').trim();
}

function saveGoogleClientId() {
	var clientId = ($('#google-client-id').val() || '').trim();
	if (!clientId) {
		localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
		googleTokenClient = null;
		googleAccessToken = null;
		googleTokenExpiresAt = 0;
		updateGoogleStatus('Client ID missing', 'Paste a Google OAuth Web Client ID to enable Drive sync.', 'warning');
		return;
	}

	localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId);
	googleTokenClient = null;
	googleAccessToken = null;
	googleTokenExpiresAt = 0;
	initializeGoogleTokenClient();
	updateGoogleStatus('Client ID saved', 'You can connect your Google account now.', 'warning');
}

function initializeGoogleTokenClient() {
	if (!(window.google && google.accounts && google.accounts.oauth2))
		return false;

	var clientId = getGoogleClientId();
	if (!clientId) {
		updateGoogleStatus('Client ID missing', 'Paste a Google OAuth Web Client ID to enable Drive sync.', 'warning');
		return false;
	}

	googleTokenClient = google.accounts.oauth2.initTokenClient({
		client_id: clientId,
		scope: GOOGLE_SCOPE,
		callback: function() {},
		error_callback: function(err) {
			console.error(err);
			updateGoogleStatus('Google auth failed', 'The Google sign-in request failed. Check your OAuth client and page origin.', 'error');
		}
	});

	return true;
}

function connectGoogleAccount() {
	requestGoogleAccessToken(true)
		.then(function() {
			updateGoogleStatus('Connected', 'Google Drive app-data sync is ready for this browser session.', 'connected');
		})
		.catch(function(err) {
			console.error(err);
			updateGoogleStatus('Connect failed', err.message || 'Unable to start Google sign-in. Check the saved client ID and authorized origin.', 'error');
		});
}

function disconnectGoogleAccount() {
	if (window.google && google.accounts && google.accounts.oauth2 && googleAccessToken)
		google.accounts.oauth2.revoke(googleAccessToken, function() {});

	googleAccessToken = null;
	googleTokenExpiresAt = 0;
	updateGoogleStatus('Disconnected', 'Local storage is still active. Reconnect Google whenever you want to sync.', 'warning');
}

function requestGoogleAccessToken(forceConsent) {
	return new Promise(function(resolve, reject) {
		if (googleAccessToken && Date.now() < googleTokenExpiresAt - 60000) {
			resolve(googleAccessToken);
			return;
		}

		if (!initializeGoogleTokenClient()) {
			reject(new Error('Google OAuth client is not configured.'));
			return;
		}

		googleTokenClient.callback = function(response) {
			if (response && response.access_token) {
				googleAccessToken = response.access_token;
				googleTokenExpiresAt = Date.now() + ((response.expires_in || 3600) * 1000);
				updateGoogleStatus('Connected', 'Google Drive app-data sync is ready for this browser session.', 'connected');
				resolve(googleAccessToken);
				return;
			}

			reject(new Error('No access token returned by Google.'));
		};

		try {
			googleTokenClient.requestAccessToken({ prompt: forceConsent ? 'consent' : '' });
		}
		catch (err) {
			reject(err);
		}
	});
}

function scheduleGoogleAutoSync() {
	if (localStorage.getItem(GOOGLE_AUTO_SYNC_KEY) !== 'true')
		return;

	if (!googleAccessToken)
		return;

	if (googleSyncTimer)
		window.clearTimeout(googleSyncTimer);

	googleSyncTimer = window.setTimeout(function() {
		pushSaveDataToGoogle(false, false);
	}, 1200);
}

function pushSaveDataToGoogle(showAlerts, forceConsent) {
	requestGoogleAccessToken(!!forceConsent)
		.then(function(token) {
			return upsertGoogleSaveFile(token, JSON.stringify(saveData));
		})
		.then(function(fileInfo) {
			recordGoogleSyncTimestamp(fileInfo && fileInfo.modifiedTime ? fileInfo.modifiedTime : null);
			updateGoogleStatus('Cloud save updated', 'Local progress has been uploaded to your Google Drive app data.', 'connected');
			if (showAlerts)
				alert('Uploaded your tracker data to Google Drive app data.');
		})
		.catch(function(err) {
			console.error(err);
			updateGoogleStatus('Upload failed', err.message || 'Google Drive upload failed.', 'error');
			if (showAlerts)
				alert('Google upload failed. Check the saved client ID, authorized origin, and sign-in permissions.');
		});
}

function pullSaveDataFromGoogle(forceConsent) {
	requestGoogleAccessToken(!!forceConsent)
		.then(function(token) {
			return downloadGoogleSaveFile(token);
		})
		.then(function(payload) {
			if (!payload) {
				updateGoogleStatus('No cloud save found', 'This Google account does not have a saved tracker file yet.', 'warning');
				alert('No cloud save was found in Google Drive app data for this account yet.');
				return;
			}

			var parsed = JSON.parse(payload.content);
			if (!Array.isArray(parsed))
				throw new Error('Cloud save is not in the expected format.');

			saveData = parsed;
			persistSaveData();
			recordGoogleSyncTimestamp(payload.modifiedTime || null);
			updateGoogleStatus('Cloud save loaded', 'Downloaded the latest cloud progress into local storage.', 'connected');
			alert('Downloaded your cloud save. The page will refresh to apply it.');
			location.reload();
		})
		.catch(function(err) {
			console.error(err);
			updateGoogleStatus('Download failed', err.message || 'Google Drive download failed.', 'error');
			alert('Google download failed. Check the saved client ID, authorized origin, and sign-in permissions.');
		});
}

function updateGoogleStatus(pillText, bodyText, tone) {
	var pill = $('#google-status-pill');
	pill.text(pillText);
	pill.removeClass('connected warning error');
	if (tone)
		pill.addClass(tone);
	$('#google-status-text').text(bodyText);
	updateSaveMenuButtonLabel();
}

function updateSaveMenuButtonLabel() {
	var label = 'Save & Auth';
	if (googleAccessToken)
		label = 'Save & Auth: Google Connected';
	$('#save-menu-toggle').html('<i class="fas fa-user-shield"></i>' + label);
}

function recordGoogleSyncTimestamp(modifiedTime) {
	var readable = modifiedTime ? new Date(modifiedTime).toLocaleString() : new Date().toLocaleString();
	localStorage.setItem(GOOGLE_LAST_SYNC_KEY, readable);
	$('#google-last-sync').text(readable);
}

function findGoogleSaveFile(token) {
	return fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)', {
		method: 'GET',
		headers: {
			'Authorization': 'Bearer ' + token
		}
	})
		.then(assertGoogleResponse)
		.then(function(data) {
			if (!data.files)
				return null;

			for (var i = 0; i < data.files.length; ++i) {
				if (data.files[i].name === GOOGLE_DATA_FILE)
					return data.files[i];
			}
			return null;
		});
}

function upsertGoogleSaveFile(token, content) {
	return findGoogleSaveFile(token).then(function(existingFile) {
		var metadata = existingFile ? { name: GOOGLE_DATA_FILE } : { name: GOOGLE_DATA_FILE, parents: ['appDataFolder'] };
		var boundary = 'warframe-boundary-' + Date.now();
		var body =
			'--' + boundary + '\r\n' +
			'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
			JSON.stringify(metadata) + '\r\n' +
			'--' + boundary + '\r\n' +
			'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
			content + '\r\n' +
			'--' + boundary + '--';
		var url = existingFile
			? 'https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(existingFile.id) + '?uploadType=multipart&fields=id,modifiedTime'
			: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime';
		var method = existingFile ? 'PATCH' : 'POST';

		return fetch(url, {
			method: method,
			headers: {
				'Authorization': 'Bearer ' + token,
				'Content-Type': 'multipart/related; boundary=' + boundary
			},
			body: body
		}).then(assertGoogleResponse);
	});
}

function downloadGoogleSaveFile(token) {
	return findGoogleSaveFile(token).then(function(file) {
		if (!file)
			return null;

		return fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(file.id) + '?alt=media', {
			method: 'GET',
			headers: {
				'Authorization': 'Bearer ' + token
			}
		})
			.then(function(response) {
				if (!response.ok)
					return response.json().then(function(data) {
						throw new Error(getGoogleErrorMessage(data));
					});
				return response.text();
			})
			.then(function(content) {
				return {
					content: content,
					modifiedTime: file.modifiedTime
				};
			});
	});
}

function assertGoogleResponse(response) {
	if (!response.ok) {
		return response.json().then(function(data) {
			throw new Error(getGoogleErrorMessage(data));
		});
	}
	return response.json();
}

function getGoogleErrorMessage(data) {
	if (data && data.error) {
		if (typeof data.error === 'string')
			return data.error;
		if (data.error.message)
			return data.error.message;
	}
	return 'Google Drive request failed.';
}



