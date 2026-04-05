function normalizeClarityProjectId(projectId) {
	if (typeof projectId !== 'string')
		return '';
	return projectId.trim();
}

function initializeClarity() {
	if (!CLARITY_PROJECT_ID || isLocalOrPrivateHost(window.location.hostname))
		return;

	window.clarity = window.clarity || function() {
		(window.clarity.q = window.clarity.q || []).push(arguments);
	};

	var script = document.createElement('script');
	script.async = true;
	script.src = 'https://www.clarity.ms/tag/' + encodeURIComponent(CLARITY_PROJECT_ID);
	document.head.appendChild(script);
	clarityReady = true;
}

function isLocalOrPrivateHost(hostname) {
	var normalized = String(hostname || '').toLowerCase();
	if (!normalized)
		return true;

	return normalized === 'localhost'
		|| normalized === '127.0.0.1'
		|| normalized === '::1'
		|| normalized.slice(-6) === '.local'
		|| normalized.indexOf('10.') === 0
		|| normalized.indexOf('192.168.') === 0
		|| /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
}

function trackClarityEvent(name) {
	if (!clarityReady || typeof window.clarity !== 'function')
		return;

	window.clarity('event', name);
}

var allItems = [];
var saveData = [];
var googleAccessToken = null;
var googleTokenExpiresAt = 0;
var googleSyncTimer = null;
var googlePendingStatus = null;
var APP_CONFIG = window.WARFRAME_CONFIG;
if (!APP_CONFIG)
	throw new Error('WARFRAME_CONFIG is missing. Load js/config.js before js/main.js.');

var CLARITY_CONFIG = APP_CONFIG.clarity || {};
var STORAGE_CONFIG = APP_CONFIG.storage || {};
var GOOGLE_CONFIG = APP_CONFIG.google || {};
var CLARITY_PROJECT_ID = normalizeClarityProjectId(CLARITY_CONFIG.projectId);
var clarityReady = false;

var STORAGE_KEY = STORAGE_CONFIG.saveDataKey;
var GOOGLE_CLIENT_ID = GOOGLE_CONFIG.clientId;
var GOOGLE_AUTO_SYNC_KEY = GOOGLE_CONFIG.autoSyncKey;
var GOOGLE_CONNECTED_KEY = GOOGLE_CONFIG.connectedKey;
var GOOGLE_LAST_SYNC_KEY = GOOGLE_CONFIG.lastSyncKey;
var GOOGLE_TOKEN_KEY = GOOGLE_CONFIG.accessTokenKey;
var GOOGLE_TOKEN_EXPIRY_KEY = GOOGLE_CONFIG.tokenExpiryKey;
var GOOGLE_OAUTH_STATE_KEY = GOOGLE_CONFIG.oauthStateKey;
var GOOGLE_DATA_FILE = GOOGLE_CONFIG.dataFile;
var GOOGLE_SCOPE = GOOGLE_CONFIG.scope;
var SEARCH_FILTER_STATES = ['any', 'is', 'not'];
var SEARCH_FILTER_LABELS = {
	any: 'Any',
	is: 'Is',
	not: 'Not'
};
var activeRelicFilter = 'any';

loadSavedData();
parseGoogleAuthRedirect();
restorePersistedGoogleSession();
initializeClarity();

$(document).ready(function() {
	$('#search').on('input', search);
	initializeSearchFilters();
	initializeRelicFilter();
	$(document).on('change', 'input[type=checkbox]', handleCheckboxChanged);
	$('#import-field').on('change', updateImportLabel);
	$('#export-button').click(function() {
		trackClarityEvent('export_save_file');
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
	var searchClauses = buildSearchClauses($('#search').val());
	$('.list-group-item').each(function() {
		var item = getItem($(this).data('id'));
		var matchesText = searchClauses.length === 0 || isItemMatch(item, searchClauses);
		if (matchesText && matchesStateFilters(item) && matchesRelicFilter(item))
			$(this).show();
		else
			$(this).hide();
	});

	updateVisibleCount();
	$('.list-group-item:visible:first').trigger('click');
}

function initializeSearchFilters() {
	$('.search-filter-toggle').on('click', function() {
		var nextState = getNextSearchFilterState($(this).data('filter-state'));
		setSearchFilterState($(this), nextState);
		search();
	});
}

function initializeRelicFilter() {
	$('.relic-filter-button').on('click', function() {
		activeRelicFilter = $(this).data('relic-filter');
		$('.relic-filter-button')
			.removeClass('active')
			.attr('aria-pressed', 'false');
		$(this)
			.addClass('active')
			.attr('aria-pressed', 'true');
		search();
	});
}

function getNextSearchFilterState(currentState) {
	var currentIndex = SEARCH_FILTER_STATES.indexOf(currentState);
	if (currentIndex === -1)
		return SEARCH_FILTER_STATES[0];

	return SEARCH_FILTER_STATES[(currentIndex + 1) % SEARCH_FILTER_STATES.length];
}

function setSearchFilterState(button, state) {
	button
		.data('filter-state', state)
		.attr('data-filter-state', state)
		.text(SEARCH_FILTER_LABELS[state] || SEARCH_FILTER_LABELS.any)
		.attr('aria-pressed', state === 'any' ? 'false' : 'true')
		.removeClass('state-is state-not');

	if (state === 'is')
		button.addClass('state-is');
	else if (state === 'not')
		button.addClass('state-not');
}

function buildSearchClauses(rawValue) {
	var normalized = String(rawValue || '').toLowerCase().trim();
	var groups = normalized ? normalized.split('|') : [''];
	var clauses = [];

	for (var i = 0; i < groups.length; ++i) {
		var terms = [];
		var groupTerms = groups[i].split(',');
		for (var t = 0; t < groupTerms.length; ++t) {
			var term = groupTerms[t].trim();
			if (term)
				terms.push(term);
		}

		if (terms.length)
			clauses.push(terms);
	}

	return clauses;
}

function matchesStateFilters(item) {
	var savedItem = getDataById(saveData, item.uniqueName);
	var isMastered = !!(savedItem && savedItem.mastered);
	var isCrafted = !!(savedItem && savedItem.crafted);
	var isVaulted = item.vaulted === true;

	return matchesTriStateFilter('mastered', isMastered)
		&& matchesTriStateFilter('crafted', isCrafted)
		&& matchesTriStateFilter('vaulted', isVaulted);
}

function matchesTriStateFilter(key, value) {
	var state = 'any';
	$('.search-filter-toggle').each(function() {
		if ($(this).data('filter-key') === key)
			state = $(this).data('filter-state') || 'any';
	});

	if (state === 'is')
		return value === true;
	if (state === 'not')
		return value !== true;
	return true;
}

function matchesRelicFilter(item) {
	if (activeRelicFilter === 'any')
		return true;

	var relicTypes = getItemRelicTypes(item);
	return relicTypes.includes(activeRelicFilter);
}

function getItemRelicTypes(item) {
	var relicTypes = [];
	if (!item.components)
		return relicTypes;

	for (var i = 0; i < item.components.length; ++i) {
		var component = item.components[i];
		if (!component.drops)
			continue;

		for (var d = 0; d < component.drops.length; ++d) {
			var relicType = getRelicTypeFromLocation(component.drops[d].location);
			if (relicType && !relicTypes.includes(relicType))
				relicTypes.push(relicType);
		}
	}

	return relicTypes;
}

function getRelicTypeFromLocation(location) {
	var normalized = String(location || '').toLowerCase();
	if (normalized.indexOf('lith ') === 0)
		return 'lith';
	if (normalized.indexOf('meso ') === 0)
		return 'meso';
	if (normalized.indexOf('neo ') === 0)
		return 'neo';
	if (normalized.indexOf('axi ') === 0)
		return 'axi';
	return null;
}

function isItemMatch(item, searches) {
	for (var i = 0; i < searches.length; ++i)
		if (andMatch(item, searches[i]))
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
					if (!isDropAllowedByActiveRelicFilter(drop))
						continue;

					var loc = drop.location.toLowerCase();
					if (loc.includes(cleanKeyword))
						return true;
				}
			}
		}
	}

	return false;
}

function isDropAllowedByActiveRelicFilter(drop) {
	if (activeRelicFilter === 'any')
		return true;

	return getRelicTypeFromLocation(drop.location) === activeRelicFilter;
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
$('.item-mastered, .item-crafted, .component-owned, .component-crafted', mainTag).prop('checked', false);
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
	search();
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
	trackClarityEvent('import_save_file');
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
	var autoSyncEnabled = localStorage.getItem(GOOGLE_AUTO_SYNC_KEY) !== 'false';
	localStorage.setItem(GOOGLE_AUTO_SYNC_KEY, autoSyncEnabled ? 'true' : 'false');
	$('#google-auto-sync').prop('checked', autoSyncEnabled);

	$('#google-connect-button').on('click', connectGoogleAccount);
	$('#google-disconnect-button').on('click', disconnectGoogleAccount);
	$('#google-upload-button').on('click', function() {
		pushSaveDataToGoogle(true);
	});
	$('#google-download-button').on('click', function() {
		pullSaveDataFromGoogle();
	});
	$('#google-auto-sync').on('change', function() {
		localStorage.setItem(GOOGLE_AUTO_SYNC_KEY, $(this).is(':checked') ? 'true' : 'false');
		if ($(this).is(':checked'))
			scheduleGoogleAutoSync();
	});

	if (googlePendingStatus)
		updateGoogleStatus(googlePendingStatus.pillText, googlePendingStatus.bodyText, googlePendingStatus.tone);
	else if (isGoogleSessionActive())
		updateGoogleStatus('Connected', 'Google Drive app-data sync is ready for this browser session.', 'connected');
	else if (localStorage.getItem(GOOGLE_CONNECTED_KEY) === 'true')
		updateGoogleStatus('Reconnect needed', 'Google token expired. Use Connect Google to refresh your Drive session.', 'warning');
	else
		updateGoogleStatus('Not connected', 'Connect your Google account to sync this tracker with Drive app data.', 'warning');
}

function connectGoogleAccount() {
	trackClarityEvent('google_connect_started');
	if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.indexOf('YOUR_GOOGLE_WEB_CLIENT_ID') === 0) {
		updateGoogleStatus('Google setup needed', 'Add your Google OAuth web client ID in js/main.js before using cloud sync.', 'warning');
		return;
	}

	localStorage.setItem(GOOGLE_CONNECTED_KEY, 'true');
	redirectToGoogleAuth(true);
}

function disconnectGoogleAccount() {
	trackClarityEvent('google_disconnected');
	if (googleAccessToken)
		revokeGoogleToken(googleAccessToken);

	clearGoogleSession(true);
	updateGoogleStatus('Disconnected', 'Local storage is still active. Reconnect Google whenever you want to sync.', 'warning');
}

function redirectToGoogleAuth(forceConsent) {
	var state = createGoogleOAuthState();
	localStorage.setItem(GOOGLE_OAUTH_STATE_KEY, state);
	window.location.assign(buildGoogleAuthUrl(state, forceConsent));
}

function buildGoogleAuthUrl(state, forceConsent) {
	var redirectUri = window.location.origin + window.location.pathname + window.location.search;
	var params = [
		'client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID),
		'redirect_uri=' + encodeURIComponent(redirectUri),
		'response_type=token',
		'scope=' + encodeURIComponent(GOOGLE_SCOPE),
		'include_granted_scopes=true',
		'state=' + encodeURIComponent(state)
	];

	if (forceConsent)
		params.push('prompt=' + encodeURIComponent('consent select_account'));

	return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.join('&');
}

function parseGoogleAuthRedirect() {
	if (!window.location.hash || window.location.hash.length < 2)
		return;

	var fragment = window.location.hash.substring(1);
	if (fragment.indexOf('access_token=') === -1 && fragment.indexOf('error=') === -1)
		return;

	var params = parseQueryString(fragment);
	var expectedState = localStorage.getItem(GOOGLE_OAUTH_STATE_KEY);
	localStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);

	if (params.state && expectedState && params.state !== expectedState) {
		googlePendingStatus = {
			pillText: 'Google auth failed',
			bodyText: 'The Google sign-in response did not match this browser session. Please try again.',
			tone: 'error'
		};
		clearGoogleSession(false);
		clearUrlHash();
		return;
	}

	if (params.error) {
		googlePendingStatus = {
			pillText: 'Connect failed',
			bodyText: formatGoogleError(params.error),
			tone: 'error'
		};
		clearGoogleSession(false);
		clearUrlHash();
		return;
	}

	if (params.access_token) {
		storeGoogleSession(params.access_token, params.expires_in);
		googlePendingStatus = {
			pillText: 'Connected',
			bodyText: 'Google Drive app-data sync is ready for this browser session.',
			tone: 'connected'
		};
		clearUrlHash();
	}
}

function restorePersistedGoogleSession() {
	var storedToken = localStorage.getItem(GOOGLE_TOKEN_KEY);
	var storedExpiry = parseInt(localStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY) || '0', 10);
	if (!storedToken || !storedExpiry)
		return;

	if (Date.now() >= storedExpiry) {
		clearGoogleSession(false);
		return;
	}

	googleAccessToken = storedToken;
	googleTokenExpiresAt = storedExpiry;
	localStorage.setItem(GOOGLE_CONNECTED_KEY, 'true');
}

function isGoogleSessionActive() {
	return !!googleAccessToken && Date.now() < googleTokenExpiresAt - 60000;
}

function storeGoogleSession(token, expiresInSeconds) {
	var expiry = Date.now() + ((parseInt(expiresInSeconds || '3600', 10)) * 1000);
	googleAccessToken = token;
	googleTokenExpiresAt = expiry;
	localStorage.setItem(GOOGLE_TOKEN_KEY, token);
	localStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, String(expiry));
	localStorage.setItem(GOOGLE_CONNECTED_KEY, 'true');
}

function clearGoogleSession(revoke) {
	var tokenToRevoke = googleAccessToken || localStorage.getItem(GOOGLE_TOKEN_KEY);
	if (revoke && tokenToRevoke)
		revokeGoogleToken(tokenToRevoke);

	googleAccessToken = null;
	googleTokenExpiresAt = 0;
	localStorage.removeItem(GOOGLE_TOKEN_KEY);
	localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
	localStorage.removeItem(GOOGLE_CONNECTED_KEY);
	localStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
}

function revokeGoogleToken(token) {
	fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(token), {
		method: 'POST',
		headers: {
			'Content-type': 'application/x-www-form-urlencoded'
		}
		}).catch(function() {
			return null;
		});
}

function createGoogleOAuthState() {
	if (window.crypto && window.crypto.getRandomValues) {
		var values = new Uint32Array(2);
		window.crypto.getRandomValues(values);
		return values[0].toString(16) + values[1].toString(16);
	}

	return String(Date.now()) + String(Math.random()).replace('.', '');
}

function parseQueryString(input) {
	var params = {};
	var pairs = input.split('&');
	for (var i = 0; i < pairs.length; ++i) {
		var parts = pairs[i].split('=');
		var key = decodeURIComponent(parts[0] || '');
		var value = decodeURIComponent((parts.slice(1).join('=') || '').replace(/\+/g, ' '));
		params[key] = value;
	}
	return params;
}

function clearUrlHash() {
	if (window.history && window.history.replaceState)
		window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
	else
		window.location.hash = '';
}

function formatGoogleError(errorCode) {
	if (errorCode === 'access_denied')
		return 'Google access was denied. Use Connect Google when you want to grant Drive sync again.';
	if (errorCode === 'origin_mismatch')
		return 'This site origin is not allowed for the configured Google OAuth client.';
	if (errorCode === 'redirect_uri_mismatch')
		return 'The redirect URI does not match the Google OAuth client settings.';
	return 'Google sign-in failed: ' + errorCode;
}

function getValidGoogleAccessToken() {
	if (!isGoogleSessionActive()) {
		clearGoogleSession(false);
		updateGoogleStatus('Reconnect needed', 'Google token expired. Use Connect Google to refresh your Drive session.', 'warning');
		throw new Error('Google session expired. Use Connect Google to continue.');
	}

	return googleAccessToken;
}

function scheduleGoogleAutoSync() {
	if (localStorage.getItem(GOOGLE_AUTO_SYNC_KEY) === 'false')
		return;

	if (!isGoogleSessionActive())
		return;

	if (googleSyncTimer)
		window.clearTimeout(googleSyncTimer);

	googleSyncTimer = window.setTimeout(function() {
		pushSaveDataToGoogle(false);
	}, 1200);
}

function pushSaveDataToGoogle(showAlerts) {
	trackClarityEvent(showAlerts ? 'google_upload_started_manual' : 'google_upload_started_auto');
	var token;
	try {
		token = getValidGoogleAccessToken();
	}
	catch (err) {
		if (showAlerts)
			alert(err.message);
		return;
	}

	upsertGoogleSaveFile(token, JSON.stringify(saveData))
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
				alert('Google upload failed. Check the built-in client ID, authorized origin, and sign-in permissions.');
		});
}

function pullSaveDataFromGoogle() {
	trackClarityEvent('google_download_started');
	var token;
	try {
		token = getValidGoogleAccessToken();
	}
	catch (err) {
		alert(err.message);
		return;
	}

	downloadGoogleSaveFile(token)
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
			alert('Google download failed. Check the built-in client ID, authorized origin, and sign-in permissions.');
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
	if (isGoogleSessionActive())
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











