/* ***** BEGIN LICENSE BLOCK *****
 * Version: MIT/X11 License
 * 
 * Copyright (c) 2011 Girish Sharma
 * 
 * Permission is hereby granted, free of charge, to any person obtaining copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Creator:
 *   Girish Sharma <scrapmachines@gmail.com>
 *
 * ***** END LICENSE BLOCK ***** */

// Global Variable to store the style sheet data
// Format : [status, name, path, url, applies on, date added, date modified]
let styleSheetList = [], backUpLoaded = [], sortedStyleSheet = [];
// variable to be enabled only once to ensure that stylesheets data is properly set
let updateAffectedInfo = false;
// Global stylesheet service
let sss = Cc["@mozilla.org/content/style-sheet-service;1"].
  getService(Ci.nsIStyleSheetService);
// Global I/O service
let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
// Global prompt service
let promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
  .getService(Ci.nsIPromptService);

const XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

// Function to read the preferences
function readJSONPref(callback) {
  let JSONFile = getURIForFileInUserStyles("Preferences/usm.pref").QueryInterface(Ci.nsIFileURL).file;
  if (JSONFile.exists()) {
    let channel = NetUtil.newChannel(JSONFile);
    channel.contentType = "application/json";
    NetUtil.asyncFetch(channel, function(inputStream, status) {
      if (!Components.isSuccessCode(status)) {
        styleSheetList = JSON.parse(pref("userStyleList"));
        return;
      }
      let data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
      styleSheetList = JSON.parse(data);
      if (callback)
        callback();
    });
  }
  else {
    let prefDirectory = getURIForFileInUserStyles("Preferences/").QueryInterface(Ci.nsIFileURL).file;
    if (!prefDirectory.exists())
      prefDirectory.create(1, parseInt('0777', 8));
    JSONFile.create(0, parseInt('0666', 8));
    let ostream = FileUtils.openSafeFileOutputStream(JSONFile);
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
      .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    let istream = converter.convertToInputStream(JSON.stringify(styleSheetList));
    NetUtil.asyncCopy(istream, ostream, function(status) {
      if (callback)
        callback();
    });
  }
}

// Function to write the preferences
function writeJSONPref(callback) {
  pref("userStyleList", JSON.stringify(styleSheetList));
  let JSONFile = getURIForFileInUserStyles("Preferences/usm.pref").QueryInterface(Ci.nsIFileURL).file;
  let ostream = FileUtils.openSafeFileOutputStream(JSONFile);
  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
    .createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  let istream = converter.convertToInputStream(JSON.stringify(styleSheetList));
  NetUtil.asyncCopy(istream, ostream, function(status) {
    if (callback)
      callback();
  });
}

// Function to read each stylsheet and get the affected content
function updateAffectedContents(index) {
  if (index == null) {
    if (styleSheetList.length == 0)
      return;
    updateAffectedContents(0);
  }
  else {
    let fileURI = getFileURI(styleSheetList[index][2]);
    NetUtil.asyncFetch(fileURI, function(inputStream, status) {
      if (!Components.isSuccessCode(status))
        return;
      let data = "";
      try {
        data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
      } catch (ex) {
        data = "";
      }
      let matchedURL = data.match(/[@]-moz-document[ ]+(((url|url-prefix|domain)[ ]{0,}\([\'\"]{0,1}([^\'\"\)]+)[\'\"]{0,1}\)[ ,]{0,})+)/);
      if (!matchedURL)
        styleSheetList[index][4] = "chrome://";
      else {
        let urlList = matchedURL[1].replace(/[ ]{0,}(url|url-prefix|domain)\(['"]?/g, "").replace(/['"]?\)[ ]{0,}/g, "").split(",");
        if (!urlList)
           styleSheetList[index][4] = "";
        else
          styleSheetList[index][4] = urlList.join(",");
      }
      if (index < styleSheetList.length - 1)
        updateAffectedContents(++index);
      else
        writeJSONPref();
    });
  }
}

// Funtion to update the sorted list based on the target of each stylesheet
function updateSortedList() {
  let targetList = [];
  sortedStyleSheet = [];
  for (let index = 0; index < styleSheetList.length; index++) {
    // getting the targets for each style
    let targets = styleSheetList[index][4].toLowerCase()
      .split(",").map(function(val) {
        if (val.length == 0)
          return l10n("unknown");
        else if (val.indexOf("chrome://") == 0) {
          if (val.match(/\/[^.\/]+\.[^.\/]+$/))
            return l10n("fx") + "," + val.match(/\/([^.\/]+\.[^.\/]+)$/)[1];
          return l10n("fx");
        }
        return val.replace(/^https?:\/\//, "");
      }).join(",").split(",");
    for (let i = 0; i < targets.length; i++) {
      let matchedIndex = targetList.indexOf(targets[i]);
      if (matchedIndex >= 0)
        sortedStyleSheet[matchedIndex].push(index);
      else {
        targetList.push(targets[i]);
        sortedStyleSheet.push([targets[i], index]);
      }
    }
  }
}

/* Function to update the styleSheetList
   either in the variable or in the settings
   If called with no arguments, will check for null JSON
   If called with proper arguments, will update the JSON pref
*/
function updateStyleSheetList(name, path, url, appliesOn) {
  if (path == null) {
    // Case for a upgrade or a new install
    if (styleSheetList.length == 0) {
      // If an upgrade, json pref overrides the values.
      styleSheetList = JSON.parse(pref("userStyleList"));
      if (styleSheetList.length == 0) {
        addDefaultStyles();
        return false;
      }
      else {
        // Compatibility bump for 0.3
        if (styleSheetList[0].length < 5)
          for (let i = 0; i < styleSheetList.length; i++) {
            styleSheetList[i][4] = "";
            styleSheetList[i][5] = styleSheetList[i][6] = JSON.stringify(new Date());
          }
        writeJSONPref();
      }
    }
    // Compatibility bump for 0.3
    else if (styleSheetList[0].length < 5) {
      for (let i = 0; i < styleSheetList.length; i++) {
        styleSheetList[i][4] = "";
        styleSheetList[i][5] = styleSheetList[i][6] = JSON.stringify(new Date());
      }
      writeJSONPref();
    }
    // If user has chosen to maintain backup, do it
    if (pref("maintainBackup")) {
      let bckpDirectory = getURIForFileInUserStyles("Backup/")
        .QueryInterface(Ci.nsIFileURL).file;
      if (!bckpDirectory.exists())
        bckpDirectory.create(1, parseInt('0777', 8));
      styleSheetList.forEach(function([enabled, name, path, url, appOn, added, modified], index) {
        let origFile = getFileURI(path).QueryInterface(Ci.nsIFileURL).file;
        if (!origFile.exists())
          return;
        let bckpFile = getURIForFileInUserStyles("Backup/backupOfUserStyle" + index
          + ".css").QueryInterface(Ci.nsIFileURL).file;
        if (bckpFile.exists())
          bckpFile.remove(false);
        origFile.copyTo(bckpDirectory, "backupOfUserStyle" + index + ".css");
      });
    }
    // compatibility bump for 0.5
    if (updateAffectedInfo)
      updateAffectedContents();
    return true;
  }
  else {
    // Path not is null, i.e. add data for a new sheet
    let index = styleSheetList.length;
    styleSheetList.push(['enabled', unescape(name), "file:///" + path
      .replace(/[\\]/g, "/"), url?url:"", appliesOn?appliesOn: "",
      JSON.stringify(new Date()), JSON.stringify(new Date())]);
    loadStyleSheet(index);
    writeJSONPref();
  }
}

// Function to add default Style Sheets to the list
function addDefaultStyles() {
  // Add the default styles only once
  if (!pref("firstRun"))
    return;
  // Add AwesomeBar Popup
  styleSheetList.push(['enabled', "AwesomeBar Popup", "AwesomeBar_Popup.css",
    "http://userstyles.org/styles/19308/awesomebar-popup",
    "chrome://", JSON.stringify(new Date()), ""]);
  // Add Sleek Dialog boxes
  styleSheetList.push(['enabled', "Sleek Dialog boxes", "Sleek_Dialog_Box.css",
    "http://userstyles.org/styles/46249/firefox-4-sleek-dialog-boxes",
    "chrome://", JSON.stringify(new Date()), ""]);
  // Add Cleanest Add-on Manager
  styleSheetList.push(['enabled', "Cleanest Add-on Manager", "cam.css",
    "http://userstyles.org/styles/46642/xff4-cleanest-addon-manager-use-addon-instead",
    "chrome://mozapps/content/extensions/extensions.xul,about:addons", JSON.stringify(new Date()), ""]);
  let styleDirectory = getURIForFileInUserStyles("/").QueryInterface(Ci.nsIFileURL).file;
  if (!styleDirectory.exists())
    styleDirectory.create(1, parseInt('0777', 8));
  styleSheetList.forEach(function([enabled, name, path, url, appliesOn, added, modified], index) {
    let origFileURI = Services.io.newURI("chrome://userstylemanager-styles/content/" + path, null, null);
    NetUtil.asyncFetch(origFileURI, function(inputStream, status) {
      if (!Components.isSuccessCode(status))
        return;
      let data = "";
      try {
        data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
      } catch (ex) {
        data = "";
      }
      let styleFile = getURIForFileInUserStyles(path).QueryInterface(Ci.nsIFileURL).file;
      if (!styleFile.exists())
        styleFile.create(0, parseInt('0666', 8));
      let ostream = FileUtils.openSafeFileOutputStream(styleFile);
      let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
        .createInstance(Ci.nsIScriptableUnicodeConverter);
      converter.charset = "UTF-8";
      NetUtil.asyncCopy(converter.convertToInputStream(data), ostream, function() loadStyleSheet(index));
    });
  });
  // Update the pref
  writeJSONPref();
}

/* Function to load the style sheet
   If called with no arguments, will load all the style sheets
   If called with proper path, will load a single stylesheet
*/
function loadStyleSheet(index) {
  if (index == null) {
    styleSheetList.forEach(function([enabled, fileName, filePath,
      fileURL, appliesOn, fileAdded, fileModified], index) {
        if (enabled == 'disabled')
          return;
        let fileURI = getFileURI(filePath);
        try {
          sss.loadAndRegisterSheet(fileURI, sss.USER_SHEET);
          backUpLoaded[index] = false;
        } catch (ex) {
          // Seems like file does not exists
          // Use backup is pref'd on
          if (pref("fallBack")) {
            let bckpFileURI = getURIForFileInUserStyles("Backup/backupOfUserStyle" + index + ".css");
            try {
              sss.loadAndRegisterSheet(bckpFileURI, sss.USER_SHEET);
              backUpLoaded[index] = true;
            } catch (ex) {backUpLoaded[index] = false;}
          }
        }
    });
  }
  else if (index < styleSheetList.length) {
    if (styleSheetList[index][0] == 'disabled')
      return;
    let fileURI = getFileURI(styleSheetList[index][2]);
    try {
      sss.loadAndRegisterSheet(fileURI, sss.USER_SHEET);
    } catch (ex) {}
  }
}

function unloadStyleSheet(index) {
  if (index == null)
    styleSheetList.forEach(function([enabled, fileName, filePath,
      fileURL, appliesOn, fileAdded, fileModified], index) {
        if (enabled == 'disabled')
          return;
        let fileURI = getFileURI(filePath);
        let origFile = fileURI.QueryInterface(Ci.nsIFileURL).file;
        if (!origFile.exists() || backUpLoaded[index]) {
          let bckpFileURI = getURIForFileInUserStyles("Backup/backupOfUserStyle" + index + ".css");
          try {
            sss.unregisterSheet(bckpFileURI, sss.USER_SHEET);
          } catch (ex) {}
        }
        else {
          try {
            sss.unregisterSheet(fileURI, sss.USER_SHEET);
          } catch (ex) {}
        }
    });
  else if (index < styleSheetList.length) {
    if (styleSheetList[index][0] == 'disabled')
      return;
    let fileURI = getFileURI(styleSheetList[index][2]);
    let origFile = fileURI.QueryInterface(Ci.nsIFileURL).file;
    if (!origFile.exists()) {
      let bckpFileURI = getURIForFileInUserStyles("Backup/backupOfUserStyle" + index + ".css");
      try {
        sss.unregisterSheet(bckpFileURI, sss.USER_SHEET);
      } catch (ex) {}
    }
    else {
      try {
        sss.unregisterSheet(fileURI, sss.USER_SHEET);
      } catch (ex) {}
    }
  }
}

function toggleStyleSheet(index, oldVal, newVal) {
  if (index != null && index >= styleSheetList.length)
    return;
  if (newVal == 'disabled') {
    if (styleSheetList[index][0] == 'disabled')
      return;
    unloadStyleSheet(index);
    styleSheetList[index][0] = 'disabled';
  }
  else {
    if (styleSheetList[index][0] == 'enabled')
      return;
    styleSheetList[index][0] = 'enabled';
    loadStyleSheet(index);
  }
  writeJSONPref();
}

function getFileURI(path) {
  return path.indexOf("file") == 0? ios.newURI(path, null, null):
    getURIForFileInUserStyles(path.replace(/^(styles\/)/, ""));
}

function getURIForFileInUserStyles(filepath) {
  let file = FileUtils.getFile("ProfD", ["User Styles"]);
  return ios.newURI("file:///" + file.path.replace(/[\\]/g, "/") + "/" + filepath, null, null);
}
