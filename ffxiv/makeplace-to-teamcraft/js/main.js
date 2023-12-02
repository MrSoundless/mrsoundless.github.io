var uploadedMakeplaceFile = null;
const requiredFields = ["interiorFixture", "exteriorFixture", "exteriorFurniture", "interiorFurniture"];
const baseUrl = "https://ffxivteamcraft.com/import/";

(function(){
    
    function makeplaceFileInputChanged(event) {
        var reader = new FileReader();
        reader.onload = makeplaceFileUploaded;
        reader.readAsText(event.target.files[0]);
    }

    function makeplaceFileUploaded(event){
		try {
			uploadedMakeplaceFile = JSON.parse(event.target.result);
			if (!isValidMakeplaceFile(uploadedMakeplaceFile))
				handleInvalidMakeplaceFile();
			else
				handleValidMakeplaceFile();
		}
		catch(ex) {
			uploadedMakeplaceFile = null;
			handleInvalidMakeplaceFile();
		}
    }

	function isValidMakeplaceFile(saveFile) {
		for (var i = 0; i < requiredFields.length; ++i) {
			if (!saveFile[requiredFields[i]])
				return false;
		}
		return true;
	}
    
	function handleInvalidMakeplaceFile() {
		setVisibility('upload-success-message', false);
		setVisibility('upload-error-message', true);
		importToTeamCraftButton.disabled = true;
	}
	function handleValidMakeplaceFile() {
		setVisibility('upload-success-message', true);
		setVisibility('upload-error-message', false);
		importToTeamCraftButton.disabled = false;
	}

	function loadIntoTeamcraft() {
		const items = [];
		for(var i in requiredFields) {
			const key = requiredFields[i];
			for (var itemKey in uploadedMakeplaceFile[key]) {
				const item = uploadedMakeplaceFile[key][itemKey];
				if (item.itemId > 0) {
					if (items[item.itemId])
						items[item.itemId]++;
					else
						items[item.itemId] = 1;
				}
			}
		}
		var lines = items.map((value,key) => key+",null,"+value);
		var dataString = lines.reduce((x,y) => x + ";" + y);
		window.open(baseUrl + btoa(dataString));
	}

	function setVisibility(elementId, isVisible) {
		const element = document.getElementById(elementId);
		if (isVisible)
			element.classList.remove("visually-hidden");
		else
			element.classList.add("visually-hidden");
	}
 
    document.getElementById('makeplaceFile').addEventListener('change', makeplaceFileInputChanged);
    document.getElementById('importToTeamCraftButton').addEventListener('click', loadIntoTeamcraft);
}());