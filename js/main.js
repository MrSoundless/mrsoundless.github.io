var allItems = [];
var saveData = [];

loadSavedData();

$(document).ready(function() {
	$('#search').keydown(search);
	$(document).on('change', 'input[type=checkbox]', handleCheckboxChanged);

	$.when(
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/development/data/json/Archwing.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/development/data/json/Melee.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/development/data/json/Primary.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/development/data/json/Secondary.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/development/data/json/Sentinels.json'),
		loadItems('https://raw.githubusercontent.com/WFCD/warframe-items/development/data/json/Warframes.json')
	).then(function() {
		allItems = allItems.sort(function(x,y) {
			return x.name < y.name ? -1 : 1;
		});

		var firstTag = null;
		var listTag = $('#all-items');
		for (var i = 0; i < allItems.length; ++i) {
			var item = allItems[i];

			var searchString = JSON.stringify(createItemSearchText(item)).toLowerCase();
			var itemTag = $('<li>')
				.addClass('list-group-item')
				.text(item.name)
				.click(itemClick)
				.data('id', item.uniqueName)
				.data('search', searchString)
				.tooltip({ html: true });

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
	var searchStrings = $(this).val().toLowerCase().split(',');
	$('.list-group-item').each(function() {
		if (stringContains($(this).data('search'), searchStrings))
			$(this).show();
		else
			$(this).hide();
	});
}
function stringContains(source, searches) {
	for (var i = 0; i < searches.length; ++i)
		if (source.includes(searches[i].trim()))
			return true;
	return false;
}
function createItemSearchText(item) {
	var results = [item.name, item.category];
	if (item.components !== undefined) {
		for(var i = 0; i < item.components.length; ++i) {
			results = results.concat(createComponentSearchText(item.components[i]));
		}
	}
	return results;
}
function createComponentSearchText(component) {
	var results = [component.name];
	if (component.drops !== undefined) {
		for(var i = 0; i < component.drops.length; ++i) {
			if (component.name != 'Forma')
				results = results.concat(createDropSearchText(component.drops[i]));
		}
	}
	return results;
}
function createDropSearchText(drop) {
	return [drop.location, drop.type, drop.rarity];
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

/*

class Component {
	constructor(id) {
		this.id = id;
		this.owned = false;
		this.crafted = false;
	}
}
class Warframe {
	constructor(id, obj) {
		this.id = id;
		this.owned = false;
		this.mastered = false;
		this.components = [];
		
		obj && Object.assign(this, obj);
	}
	
	getComponent(id) {
		for(var i = 0; i < this.components.length; ++i) {
			if (this.components[i].id == id)
				return this.components[i];
		}
		return null;
	}
}

var componentsToSkip = [
	"/Lotus/Types/Items/MiscItems/Kuva",
	"/Lotus/Types/Items/MiscItems/OrokinCell",
	"/Lotus/Types/Items/MiscItems/ArgonCrystal",
	"/Lotus/Types/Keys/BardQuest/BardQuestSequencerItem",
	"/Lotus/Types/Items/MiscItems/Gallium",
	"/Lotus/Types/Items/MiscItems/Alertium"];

var rawData = localStorage.getItem('warframeCollection');
var warframeCollection = [];
if (rawData != null)
	warframeCollection = JSON.parse(rawData);
	
function getWarframeModel(id) {
	for(var i = 0; i < warframeCollection.length; ++i) {
		if (warframeCollection[i].id == id)
			return new Warframe('', warframeCollection[i]);
	}
	return null;
}
function saveData() {
	localStorage.setItem("warframeCollection", JSON.stringify(warframeCollection));
}
function updateComponent(item, updateFunction) {
	var checked = $(item).is(":checked");
	var component = $(item).closest('tr');
	
	var frame = $(item).closest('.warframe');
	var frameId = frame.data('uniqueName');
	var componentId = component.data('uniqueName');
	
	var model = getWarframeModel(frameId);
	var c = model.getComponent(componentId);
	updateFunction(c, checked);
	saveData();
}
function updateWarframe(item, updateFunction) {
	var checked = $(item).is(":checked");
	var component = $(item).closest('tr');
	
	var frame = $(item).closest('.warframe');
	var frameId = frame.data('uniqueName');
	var componentId = component.data('uniqueName');
	
	var model = getWarframeModel(frameId);
	updateFunction(model, checked);
	for (var i = 0; i < model.components.length; ++i) {
		var c = model.components[i];
		c.crafted = checked;
		c.owned = checked;
	}
	updateWarframeModel(model);
	saveData();
}
function updateWarframeModel(model) {
	for(var i = 0; i < warframeCollection.length; ++i) {
		if (warframeCollection[i].id == model.id) {
			warframeCollection[i] = model;
			return;
		}
	}
}

$(document).ready(function() {
	
	$('.warframe-filter').change(function() {
		var option = $(this).val();
		switch (option) {
			case 'notmastered':
				$('.warframe').show();
				$('.warframe-mastered:checked').closest('.warframe').hide();
				break;
			case 'notowned':
				$('.warframe').show();
				$('.warframe-owned:checked').closest('.warframe').hide();
				break;
			case 'mastered':
				$('.warframe').hide();
				$('.warframe-mastered:checked').closest('.warframe').show();
				break;
			case 'owned':
				$('.warframe').hide();
				$('.warframe-owned:checked').closest('.warframe').show();
				$('.warframe-mastered:checked').closest('.warframe').hide();
				break;
			default:
				$('.warframe').show();
		}
	});


	$.get('https://raw.githubusercontent.com/WFCD/warframe-items/development/data/json/Warframes.json', function(data) {
		JSON.parse(data).forEach(function(item) {
			var frame = $('#warframe-template').clone().attr('id', '').addClass('warframe').show();
			frame.data('uniqueName', item.uniqueName);
			$('body').append(frame);
			$('.warframe-name', frame).text(item.name);
			var warframeModel = getWarframeModel(item.uniqueName);
			if (warframeModel != null) {
				$('.warframe-owned', frame).prop('checked', warframeModel.owned);
				$('.warframe-mastered', frame).prop('checked', warframeModel.mastered);
			}
			else {
				warframeModel = new Warframe(item.uniqueName)
				warframeCollection.push(warframeModel);
			}
			
			var components = $('.warframe-components', frame);
			if (item.components != null) {
				item.components.forEach(function(component) {
					if (componentsToSkip.indexOf(component.uniqueName) != -1 || component.name == "Volt Neuroptics")
						return;
					
					var comp = $('.component-template', components).clone().data('uniqueName', component.uniqueName).show().removeClass('component-template');
					$('.component-name', comp).text(component.name);
					var dropText = '<ul>';
					for (var i = 0; component.drops && i < component.drops.length; ++i) {
						var drop = component.drops[i];
						dropText += "<li>" + drop.location + " (" + drop.rarity + ")</li>";
					}
					dropText += '</ul>';
					$('.component-info', comp).prop('title', dropText);
					
					components.append(comp);
					
					if (component.name == "Blueprint")
						$('.component-crafted', comp).hide();
						
					var componentModel = warframeModel.getComponent(component.uniqueName);
					if (componentModel != null) {
						$('.component-owned', comp).prop('checked', componentModel.owned);
						$('.component-crafted', comp).prop('checked', componentModel.crafted);
					}
					else {
						warframeModel.components.push(new Component(component.uniqueName));
					}
				});
			}
			else {
				$('table', frame).hide();
			}
		});
		
		$('.warframe-components .component-owned').change(function() {
			updateComponent($(this), function (component, checked) {
				component.owned = checked;
			});
		});
		$('.warframe-components .component-crafted').change(function() {
			$('.component-owned', $(this).closest('tr')).prop('checked', $(this).is(':checked'));
			updateComponent($(this), function (component, checked) {
				component.owned = checked;
				component.crafted = checked;
			});
		});
		$('.warframe-owned').change(function() {
			$('.warframe-components input', $(this).closest('.warframe')).prop('checked', $(this).is(':checked'));
			updateWarframe($(this), function (warframe, checked) {
				warframe.owned = checked;
			});
		});
		$('.warframe-mastered').change(function() {
			$('input', $(this).closest('.warframe')).prop('checked', $(this).is(':checked'));
			updateWarframe($(this), function (warframe, checked) {
				warframe.owned = checked;
				warframe.mastered = checked;
			});
		});
		
		$('.component-info').tooltip({ html: true });
	});
});*/