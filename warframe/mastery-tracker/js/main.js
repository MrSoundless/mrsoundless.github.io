var allItems = [];
var saveData = [];

loadSavedData();

$(document).ready(function() {
	$('#search').on('input', search);
	$(document).on('change', 'input[type=checkbox]', handleCheckboxChanged);
	$('#export-button').click(function() {
		downloadObjectAsJson(saveData, "warframe-collections");
	});
	$('#import-button').click(function() {
		handleFileSelect();
	});
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
		allItems = allItems.sort(function(x,y) {
			return x.name < y.name ? -1 : 1;
		});

		var firstTag = null;
		var listTag = $('#all-items');
		for (var i = 0; i < allItems.length; ++i) {
			var item = allItems[i];
			var name = item.name;
			if (item.vaulted)
				name += " *";
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

		firstTag.trigger('click');
	});
});


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
		if (val == "" || isItemMatch(item, searchStrings))
			$(this).show();
		else
			$(this).hide();
	});
	
	$('.list-group-item:visible:first').trigger('click');
}

function isItemMatch(item, searches) {
	for (var i = 0; i < searches.length; ++i)
		if (andMatch(item, searches[i].split(',')))
			return true;
		//if (source.includes(searches[i].trim()))
			//return true;
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
	switch(keyword) {
		case "is:vaulted":
			return item.vaulted === true;
		case "not:vaulted":
			return item.vaulted !== true;
		case "is:mastered":
			return savedItem && savedItem.mastered; 
		case "not:mastered":
			return !savedItem || !savedItem.mastered;
		case "is:crafted":
			return savedItem && savedItem.crafted; 
		case "not:crafted":
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

				cleanKeyword = keyword.substring("notowned:".length);
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
			$('.amount', componentTag).text(component.itemCount);
			$('.name', componentTag).text(component.name);

			var dropText = createDropInfoText(component.drops);
			if (dropText) {
				$('.component-info', componentTag)
					.prop('title', dropText)
					.show();
			} else {
				$('.component-info', componentTag).hide();
			}
			
			componentsTag.append(componentTag);
			
			if (component.name == "Blueprint")
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
			location.toLowerCase().startsWith('axi'))
		{
			var bla = location.split(' ');
			bla.pop();
			location = bla.join(' ');
		}

		if (dropNames.includes(location.toLowerCase()))
			continue;

		dropNames.push(location.toLowerCase());

		if (drops[i].rarity)
			location += " (" + drops[i].rarity + ")";

		list.append($('<li>').text(location));
	}
	return $('<div>').append(list).html();
}

function loadSavedData() {
	var rawData = localStorage.getItem('warframe-collections');
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
	localStorage.setItem('warframe-collections', JSON.stringify(saveData));
	
	var tag = findItemTagById(itemId);
	tag.removeClass('list-group-item-success');
	tag.removeClass('list-group-item-warning');
	if (item.mastered)
		tag.addClass('list-group-item-success');
	else if (item.crafted)
		tag.addClass('list-group-item-warning');
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
	for(var i = 0; i < data.length; ++i) {
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

function downloadObjectAsJson(exportObj, exportName){
	var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
	var downloadAnchorNode = document.createElement('a');
	downloadAnchorNode.setAttribute("href",     dataStr);
	downloadAnchorNode.setAttribute("download", exportName + ".json");
	document.body.appendChild(downloadAnchorNode); // required for firefox
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}
function handleFileSelect()
{               
	if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
		alert('The File APIs are not fully supported in this browser.');
		return;
	}   

	input = document.getElementById('import-field');
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
		file = input.files[0];
		fr = new FileReader();
		fr.onload = receivedText;
		//fr.readAsText(file);
		fr.readAsText(file);
	}
}

function receivedText() {
	localStorage.setItem('warframe-collections', fr.result);
	location.reload();
}    
  