/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 * Creator:
 *   Girish Sharma <scrapmachines@gmail.com>
 */

"use strict";
// Global Variable to store the style sheet data
// Format : [status, name, path, url, applies on, date added, date modified, style options, local changes ?]
let styleSheetList = [],
    backUpLoaded = [],
    sortedStyleSheet = [];
// variable to be enabled only once to ensure that stylesheets data is properly set
let updateAffectedInfo = false;
// Global stylesheet service
let sss = Cc["@mozilla.org/content/style-sheet-service;1"]
            .getService(Ci.nsIStyleSheetService);
// Global I/O service
let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
// Global prompt service
let promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                      .getService(Ci.nsIPromptService);
let syncUpdateTimer = null;
let shouldUpdateInstall = false;
const XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const HTML = "http://www.w3.org/1999/xhtml";
const EDITOR_WINDOW_FEATURES = "chrome,resizable,dialog=no,centerscreen,titlebar",
      EDITOR_WINDOW_URL = "chrome://userstylemanager/content/editor.xul";

// Contains a list of currently open USM Editors.
let openEditors = {};

// Function to read the preferences
function readJSONPref(callback) {
  let JSONFile = getURIForFileInUserStyles("Preferences/usm.pref")
                   .QueryInterface(Ci.nsIFileURL).file;
  if (JSONFile.exists()) {
    let channel = NetUtil.newChannel(JSONFile);
    channel.contentType = "application/json";
    NetUtil.asyncFetch(channel, function(inputStream, status) {
      if (!Components.isSuccessCode(status)) {
        styleSheetList = JSON.parse(pref("userStyleList"));
        return;
      }
      let data = NetUtil.readInputStreamToString(inputStream,
                                                 inputStream.available());
      styleSheetList = JSON.parse(data);
      callback && callback();
    });
  }
  else {
    let prefDirectory = getURIForFileInUserStyles("Preferences/")
                          .QueryInterface(Ci.nsIFileURL).file;
    if (!prefDirectory.exists()) {
      prefDirectory.create(1, parseInt('0777', 8));
    }
    JSONFile.create(0, parseInt('0666', 8));
    let ostream = FileUtils.openSafeFileOutputStream(JSONFile);
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                      .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    let istream = converter.convertToInputStream(JSON.stringify(styleSheetList));
    NetUtil.asyncCopy(istream, ostream, function(status) {
      callback && callback();
    });
  }
}

// Function to write the preferences
function writeJSONPref(callback) {
  pref("userStyleList", JSON.stringify(styleSheetList));
  prepareToUpdateSync();
  let JSONFile = getURIForFileInUserStyles("Preferences/usm.pref")
                   .QueryInterface(Ci.nsIFileURL).file;
  let ostream = FileUtils.openSafeFileOutputStream(JSONFile);
  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                    .createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  let istream = converter.convertToInputStream(JSON.stringify(styleSheetList));
  NetUtil.asyncCopy(istream, ostream, function(status) {
    callback && callback();
  });
}

// Function to read each stylsheet and get the affected content
function updateAffectedContents(index) {
  if (index == null) {
    if (styleSheetList.length == 0) {
      return;
    }
    updateAffectedContents(0);
  }
  else {
    let fileURI = getFileURI(unescape(styleSheetList[index][2]));
    NetUtil.asyncFetch(fileURI, function(inputStream, status) {
      if (!Components.isSuccessCode(status)) {
        return;
      }
      let data = "";
      try {
        data = NetUtil.readInputStreamToString(inputStream,
                                               inputStream.available());
      } catch (ex) {
        data = "";
      }
      let matchedURL =
        data.match(/[@]-moz-document[ ]+(((url|url-prefix|domain)[ ]{0,}\([\'\"]{0,1}([^\'\"\)]+)[\'\"]{0,1}\)[ ,]{0,})+)/);
      if (!matchedURL) {
        styleSheetList[index][4] = "chrome://";
      }
      else {
        let urlList = matchedURL[1].replace(/[ ]{0,}(url|url-prefix|domain)\(['"]?/g, "")
                                   .replace(/['"]?\)[ ]{0,}/g, "").split(",");
        if (!urlList) {
           styleSheetList[index][4] = "";
        }
        else {
          styleSheetList[index][4] = urlList.join(",");
        }
      }
      if (index < styleSheetList.length - 1) {
        updateAffectedContents(++index);
      }
      else {
        writeJSONPref();
      }
    });
  }
}

// Funtion to update the sorted list based on the target of each stylesheet
function updateSortedList() {
  let targetList = [];
  sortedStyleSheet = [];
  for (let index = 0; index < styleSheetList.length; index++) {
    // getting the targets for each style
    let targets =
      styleSheetList[index][4]
        .toLowerCase()
        .split(",")
        .map(function(val) {
        if (val.length == 0) {
          return l10n("unknown");
        }
        else if (val.indexOf("chrome://") == 0) {
          if (val.match(/\/[^.\/]+\.[^.\/]+$/)) {
            return l10n("fx") + "," + val.match(/\/([^.\/]+\.[^.\/]+)$/)[1];
          }
          return l10n("fx");
        }
        return val.replace(/^https?:\/\//, "");
      }).join(",").split(",");

    for (let i = 0; i < targets.length; i++) {
      let matchedIndex = targetList.indexOf(targets[i]);
      if (matchedIndex >= 0) {
        sortedStyleSheet[matchedIndex].push(index);
      }
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
function updateStyleSheetList() {
  // Case for a upgrade or a new install
  if (styleSheetList.length == 0) {
    // If an upgrade, json pref overrides the values.
    styleSheetList = JSON.parse(pref("userStyleList"));
    if (styleSheetList.length == 0) {
      return false;
    }
    else {
      // Compatibility bump for 0.3
      if (styleSheetList[0].length < 5) {
        for (let i = 0; i < styleSheetList.length; i++) {
          styleSheetList[i][4] = "";
          styleSheetList[i][5] = styleSheetList[i][6] = JSON.stringify(new Date());
        }
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
  // Compatibility bump for 0.8
  if (updateAffectedInfo) {
    for (let i = 0; i < styleSheetList.length; i++) {
      styleSheetList[i][2] = escape(styleSheetList[i][2]);
    }
    writeJSONPref();
  }
  // If user has chosen to maintain backup, do it
  if (pref("maintainBackup")) {
    doBackup();
  }
  // compatibility bump for 0.8
  if (updateAffectedInfo) {
    updateAffectedContents();
  }
  return true;
}

function doBackup(index) {
  let bckpDirectory = getURIForFileInUserStyles("Backup/")
                        .QueryInterface(Ci.nsIFileURL).file;
  if (!bckpDirectory.exists()) {
    bckpDirectory.create(1, parseInt('0777', 8));
  }
  if (index == null) {
    styleSheetList.forEach(function([enabled, name, path, url, appOn, added,
                                     modified], index) {
      let origFile = getFileURI(unescape(path)).QueryInterface(Ci.nsIFileURL).file;
      if (!origFile.exists()) {
        return;
      }
      let bckpFile = getURIForFileInUserStyles("Backup/backupOfUserStyle" +
                                                index + ".css")
                       .QueryInterface(Ci.nsIFileURL).file;
      if (bckpFile.exists()) {
        bckpFile.remove(false);
      }
      origFile.copyTo(bckpDirectory, "backupOfUserStyle" + index + ".css");
    });
  }
  else {
    let origFile = getFileURI(unescape(styleSheetList[index][2]))
                     .QueryInterface(Ci.nsIFileURL).file;
    if (!origFile.exists()) {
      return;
    }
    let bckpFile = getURIForFileInUserStyles("Backup/backupOfUserStyle" +
                                              index + ".css")
                     .QueryInterface(Ci.nsIFileURL).file;
    if (bckpFile.exists()) {
      bckpFile.remove(false);
    }
    origFile.copyTo(bckpDirectory, "backupOfUserStyle" + index + ".css");
  }
}

function doRestore(index, callback) {
  let bckpDirectory = getURIForFileInUserStyles("Backup/")
                        .QueryInterface(Ci.nsIFileURL).file;
  if (!bckpDirectory.exists()) {
    return;
  }
  if (index == null) {
    styleSheetList.forEach(function([enabled, name, path, url, appOn, added,
                                     modified], index) {
      let bckpFile = getURIForFileInUserStyles("Backup/backupOfUserStyle" +
                                                index + ".css")
                       .QueryInterface(Ci.nsIFileURL).file;
      if (!bckpFile.exists()) {
        return;
      }
      unloadStyleSheet(index);
      let origDirectory = getFileURI(unescape(path).replace(/[^\/\\]+$/, ""))
                            .QueryInterface(Ci.nsIFileURL).file;
      if (!origDirectory.exists()) {
        origDirectory.create(1, parseInt('0777', 8));
      }
      let origFile = getFileURI(unescape(path)).QueryInterface(Ci.nsIFileURL).file;
      if (!origFile.exists()) {
        bckpFile.copyTo(origDirectory, unescape(path).match(/[^\\\/]+$/)[0]);
        if (enabled == "enabled") {
          loadStyleSheet(index);
        }
      }
    });
  }
  else {
    let bckpFile = getURIForFileInUserStyles("Backup/backupOfUserStyle" +
                                              index + ".css")
                     .QueryInterface(Ci.nsIFileURL).file;
    if (!bckpFile.exists()) {
      return;
    }
    unloadStyleSheet(index);
    let origDirectory = getFileURI(unescape(styleSheetList[index][2])
                          .replace(/[^\\\/]+$/, ""))
                          .QueryInterface(Ci.nsIFileURL).file;
    if (!origDirectory.exists()) {
      origDirectory.create(1, parseInt('0777', 8));
    }
    let origFile = getFileURI(unescape(styleSheetList[index][2]))
                     .QueryInterface(Ci.nsIFileURL).file;
    if (!origFile.exists()) {
      bckpFile.copyTo(origDirectory,
                      unescape(styleSheetList[index][2]).match(/[^\\\/]+$/)[0]);
      if (styleSheetList[index][0] == "enabled") {
        loadStyleSheet(index);
      }
    }
  }
  callback && callback();
}

/* Function to load the style sheet
   If called with no arguments, will load all the style sheets
   If called with proper path, will load a single stylesheet
*/
function loadStyleSheet(index) {
  if (!pref("stylesEnabled")) {
    return;
  }
  if (index == null) {
    styleSheetList.forEach(function([enabled, fileName, filePath, fileURL,
                                     appliesOn, fileAdded, fileModified],
                                    index) {
      if (enabled == 'disabled') {
        return;
      }
      let fileURI = getFileURI(unescape(filePath));
      try {
        sss.loadAndRegisterSheet(fileURI, sss.AGENT_SHEET);
        backUpLoaded[index] = false;
      } catch (ex) {
        // Seems like file does not exists
        // Use backup is pref'd on
        if (pref("fallBack")) {
          let bckpFileURI = getURIForFileInUserStyles("Backup/backupOfUserStyle" + index + ".css");
          try {
            sss.loadAndRegisterSheet(bckpFileURI, sss.AGENT_SHEET);
            backUpLoaded[index] = true;
          } catch (ex) {
            backUpLoaded[index] = false;
          }
        }
      }
    });
  }
  else if (index < styleSheetList.length) {
    if (styleSheetList[index][0] == 'disabled') {
      return;
    }
    let fileURI = getFileURI(unescape(styleSheetList[index][2]));
    try {
      sss.loadAndRegisterSheet(fileURI, sss.AGENT_SHEET);
      backUpLoaded[index] = false;
    } catch (ex) {
      // Seems like file does not exists
      // Use backup is pref'd on
      if (pref("fallBack")) {
        let bckpFileURI = getURIForFileInUserStyles("Backup/backupOfUserStyle" + index + ".css");
        try {
          sss.loadAndRegisterSheet(bckpFileURI, sss.AGENT_SHEET);
          backUpLoaded[index] = true;
        } catch (ex) {
          backUpLoaded[index] = false;
        }
      }
    }
  }
}

function unloadStyleSheet(index) {
  if (index == null) {
    styleSheetList.forEach(function([enabled, fileName, filePath, fileURL,
                                     appliesOn, fileAdded, fileModified],
                                    index) {
      if (enabled == 'disabled') {
        return;
      }
      let fileURI = getFileURI(unescape(filePath));
      let origFile = fileURI.QueryInterface(Ci.nsIFileURL).file;
      if (!origFile.exists() || backUpLoaded[index]) {
        let bckpFileURI = getURIForFileInUserStyles("Backup/backupOfUserStyle" +
                                                     index + ".css");
        try {
          sss.unregisterSheet(bckpFileURI, sss.AGENT_SHEET);
        } catch (ex) {}
      }
      else {
        try {
          sss.unregisterSheet(fileURI, sss.AGENT_SHEET);
        } catch (ex) {}
      }
    });
  }
  else if (index < styleSheetList.length) {
    if (styleSheetList[index][0] == 'disabled') {
      return;
    }
    let fileURI = getFileURI(unescape(styleSheetList[index][2]));
    let origFile = fileURI.QueryInterface(Ci.nsIFileURL).file;
    if (!origFile.exists()) {
      let bckpFileURI = getURIForFileInUserStyles("Backup/backupOfUserStyle" +
                                                   index + ".css");
      try {
        sss.unregisterSheet(bckpFileURI, sss.AGENT_SHEET);
      } catch (ex) {}
    }
    else {
      try {
        sss.unregisterSheet(fileURI, sss.AGENT_SHEET);
      } catch (ex) {}
    }
  }
}

function toggleStyleSheet(index, oldVal, newVal) {
  if (index != null && index >= styleSheetList.length) {
    return;
  }
  if (newVal == 'disabled') {
    if (styleSheetList[index][0] == 'disabled') {
      return;
    }
    unloadStyleSheet(index);
    styleSheetList[index][0] = 'disabled';
  }
  else {
    if (styleSheetList[index][0] == 'enabled') {
      return;
    }
    styleSheetList[index][0] = 'enabled';
    loadStyleSheet(index);
  }
  writeJSONPref();
}

function openUserStyleEditor(name, params, focusExisting) {
  if (focusExisting && Services.ww.getWindowByName(name)) {
    return Services.ww.getWindowByName(name);
  }

  let args = Cc["@mozilla.org/embedcomp/dialogparam;1"]
               .createInstance(Ci.nsIDialogParamBlock);
  args.SetNumberStrings(1);
  args.SetString(0, JSON.stringify(params));

  if (openEditors[name]) {
    name += " - " + Date.now();
  }
  openEditors[name] = true;

  let win = Services.ww.openWindow(null, EDITOR_WINDOW_URL, name,
                                   EDITOR_WINDOW_FEATURES, args);

  win.addEventListener("load", function oneTimeLoad() {
    win.removeEventListener("load", oneTimeLoad, false);
    win.addEventListener("unload", function onUnload(event) {
      win.removeEventListener("unload", onUnload, false);
      if (openEditors[win.name]) {
        delete openEditors[win.name];
      }
    }, false);
  }, false);

  return win;
}

function getCodeForStyle(styleId, options, callback) {
  if (styleId == null) {
    callback && callback();
    return;
  }
  let xmlQuery = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                   .createInstance(Ci.nsIXMLHttpRequest);
  xmlQuery.open('GET', 'http://userstyles.org/styles/' + styleId + '.css' +
                (options == "" ? "" : "?" + options), true);
  xmlQuery.onreadystatechange = function(event) {
    if (xmlQuery.readyState == 4) {
      if (xmlQuery.status == 200) {
        callback(xmlQuery.responseText);
        callback = null;
      }
    }
  };
  xmlQuery.send(null);
}

function getOptions(contentWindow, promptOnIncomplete) {
  let styleOptions = contentWindow.document.getElementById("style-options");
  if (!styleOptions) {
    return "";
  }
  let selects = styleOptions.getElementsByTagName("select");
  let params = [];
  for (let i = 0; i < selects.length; i++) {
    params.push(selects[i].name + "=" + selects[i].value);
  }
  let missingSettings = [];
  let inputs = styleOptions.getElementsByTagName("input");

  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i].value == "") {
      missingSettings.push(inputs[i]);
    }
    else {
      params.push(inputs[i].name + "=" + encodeURIComponent(inputs[i].value));
    }
  }
  if (missingSettings.length > 0) {
    if (promptOnIncomplete) {
      contentWindow.alert("Choose a value for every setting first.");
    }
    contentWindow = null;
    return null;
  }
  contentWindow = null;
  return params.join("&");
}

function compareStyleVersion(installedIndex, styleId, code, callback) {
  function updateNow(code) {
    let fileURI = getFileURI(unescape(styleSheetList[installedIndex][2]));
    let styleSheetFile = fileURI.QueryInterface(Ci.nsIFileURL).file;
    NetUtil.asyncFetch(styleSheetFile, function(inputStream, status) {
      if (!Components.isSuccessCode(status)) {
        return;
      }
      let data = "";
      try {
        data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
      } catch (ex) {
        return;
      }
      if (callback) {
        callback(data != code);
      }
    });
  }
  if (code == null) {
    getCodeForStyle(styleId, (styleSheetList[installedIndex].length > 7
                              ? styleSheetList[installedIndex][7]
                              : ""),
                    updateNow);
  }
  else {
    updateNow(code);
  }
}

function updateInUSM(aStyleId, CSSText, name, url, options, aCallback) {
  for (let i = 0; i < styleSheetList.length; i++) {
    let styleId;
    if (styleSheetList[i][3].match(/org\/styles\/([0-9]*)\//i)) {
      styleId = parseInt(styleSheetList[i][3].match(/org\/styles\/([0-9]*)\//i)[1]);
      if (styleId == aStyleId) {
        try {
          unloadStyleSheet(i);
        }
        catch(ex) {}
        let ostream =
          FileUtils.openSafeFileOutputStream(getFileURI(unescape(styleSheetList[i][2]))
                   .QueryInterface(Ci.nsIFileURL).file);
        let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                          .createInstance(Ci.nsIScriptableUnicodeConverter);
        converter.charset = "UTF-8";
        let istream = converter.convertToInputStream(CSSText);
        NetUtil.asyncCopy(istream, ostream, function(status) {
          loadStyleSheet(i);
          if (!Components.isSuccessCode(status)) {
            return;
          }
          styleSheetList[i][3] = url;
          styleSheetList[i][6] = JSON.stringify(new Date());
          styleSheetList[i][7] = options;
          styleSheetList[i][8] = false;
          writeJSONPref();
          aCallback && aCallback();
        });
        return
      }
    }
  }
}

function updateStyle(index, callback) {
  if (styleSheetList[index][3].match(/^https?:\/\/(www.)?userstyles.org\/styles\/[0-9]*/i)) {
    let styleId = styleSheetList[index][3].match(/styles\/([0-9]*)\//i)[1];
    getCodeForStyle(styleId, styleSheetList[index][7], function(code) {
      compareStyleVersion(index, styleId, code, function(needsUpdate) {
        if (needsUpdate && (!pref("updateOverwritesLocalChanges") || !styleSheetList[index][8])) {
          updateInUSM(styleId, code, styleSheetList[index][1],
                      styleSheetList[index][3], styleSheetList[index][7],
                      callback);
        }
        else if (callback) {
          callback();
        }
      });
    });
  }
  else if (callback) {
    callback();
  }
}

function checkAndDisplayProperOption(contentWindow, url) {
  function $(id) contentWindow.document.getElementById(id);
  function hideAllButtons() {
    $("stylish-installed-style-installed").style.display = "none";
    $("stylish-installed-style-not-installed").style.display = "none";
    $("style-install-mozilla-no-stylish").style.display = "none";
    $("stylish-installed-style-needs-update").style.display = "none";
  }

  let currentStyleId = url.match(/org\/styles\/([0-9]*)\//i);
  if (currentStyleId) {
    currentStyleId = currentStyleId[1];
    currentStyleId = parseInt(currentStyleId);
  }
  let installedID = -1;
  for (let i = 0; i < styleSheetList.length; i++) {
    let styleId;
    if (styleSheetList[i][3].match(/org\/styles\/([0-9]*)\//i)) {
      styleId = parseInt(styleSheetList[i][3].match(/org\/styles\/([0-9]*)\//i)[1]);
      if (styleId == currentStyleId) {
        if ($("stylish-installed-style-needs-update")
              .innerHTML.search(/user styles manager/i) < 0) {
          hideAllButtons();
          $("stylish-installed-style-installed").style.display = "";
        }
        installedID = i;
        break;
      }
    }
  }

  if (installedID == -1) {
    hideAllButtons();
    let installStyleButton = $("stylish-installed-style-not-installed");
    installStyleButton.innerHTML =
      installStyleButton.innerHTML.replace("Stylish", "User Styles Manager");
    installStyleButton.style.display = "";
  }
  else {
    compareStyleVersion(installedID, currentStyleId, null, function(needsUpdate) {
      if (needsUpdate &&
          $("stylish-installed-style-needs-update").style.display != "none" &&
          $("stylish-installed-style-needs-update")
            .innerHTML
            .search(/user style manager/i) > 0) {
        $("stylish-installed-style-installed").style.display = "none";
        return;
      }
      else if (needsUpdate) {
        hideAllButtons();
        let updateInstallButton = $("stylish-installed-style-needs-update");
        updateInstallButton.style.display = "";
        updateInstallButton.innerHTML =
          updateInstallButton.innerHTML.replace("Stylish", "User Styles Manager");
      }
      else {
        hideAllButtons();
        $("stylish-installed-style-installed").style.display = "";
      }
    });
  }
}

function updateFromSync() {
  let doUpdate = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  let doSyncUpdate = {
    notify: function() {
      doUpdate.cancel();
      doUpdate = null;
      if (pref("newInstall")) {
        // Sync is form a new install of this addon on a synced machine
        prepareToUpdateSync();
        shouldUpdateInstall = true;
        return;
      }
      let remoteStyleSheetList = JSON.parse(pref("syncedStyleList"));
      let tempStyleSheetList = JSON.parse(JSON.stringify(styleSheetList));
      let newStyles = [], deletedStyle = [], found = false, i = 0, haveChanges = false;
      remoteStyleSheetList.forEach(function([enabled, name, styleId, options]) {
        enabled = (enabled?"enabled":"disabled");
        found = false;
        for each (let style in tempStyleSheetList) {
          if (style[3].match(/styles\/([0-9]*)\//i) &&
              style[3].match(/styles\/([0-9]*)\//i)[1] == styleId) {
            found = true;
            break;
          }
          i++;
        }
        if (found) {
          if (tempStyleSheetList[i][0] != enabled) {
            enabled? loadStyleSheet(i): unloadStyleSheet(i);
          }
          if (tempStyleSheetList[i][0] != enabled ||
              tempStyleSheetList[i][1] != name ||
              tempStyleSheetList[i][7] != options) {
            tempStyleSheetList[i][6] = JSON.stringify(new Date());
            haveChanges = true;
          }
          tempStyleSheetList[i][0] = enabled;
          tempStyleSheetList[i][1] = name;
          if (tempStyleSheetList[i][7] != options) {
            newStyles.push(i*1);
          }
          tempStyleSheetList[i][7] = options;
        }
        else {
          haveChanges = true;
          i = tempStyleSheetList.length;
          newStyles.push(i*1);
          let path = escape(name.replace(/[\\\/:*?\"<>|]+/gi, "") + ".css");
          if (path == ".css") {
            path = "User Synced Style Sheet " + i + ".css";
          }
          tempStyleSheetList.push([enabled, name, path,
                                   "http://userstyles.org/styles/" + styleId + "/",
                                   "", JSON.stringify(new Date()),
                                   JSON.stringify(new Date()), options, false]);
        }
      });
      if (haveChanges) {
        styleSheetList = tempStyleSheetList;
      }
      tempStyleSheetList.forEach(function([enabled, name, path, url], index) {
        if (!url.match(/^https?:\/\/(www.)?userstyles.org\/styles\/[0-9]*/i)) {
          return;
        }
        found = false;
        for each (let style in remoteStyleSheetList) {
          if (style[3] == url) {
            found = true;
            break;
          }
        }
        if (!found) {
          deletedStyle.push(index);
          haveChanges = true;
        }
      });
      if (haveChanges) {
        addNewStylesFromSync(newStyles, 0, function() {
          if (!pref("keepDeletedOnSync")) {
            deleteStylesFromUSM(deletedStyle);
          }
          else {
            prepareToUpdateSync();
          }
          updateAffectedContents();
        });
      }
    }
  };
  doUpdate.initWithCallback(doSyncUpdate, 5000, Ci.nsITimer.TYPE_ONE_SHOT);
}

function addNewStylesFromSync(aStyles, aIndex, aCallback) {
  if (aStyles.length == 0) {
    aCallback && aCallback();
    return;
  }

  if (aIndex == null) {
    aIndex = 0;
  }
  else if (aIndex >= aStyles.length) {
    aCallback && aCallback();
    return;
  }

  let index = aStyles[aIndex++];
  try {
    if (styleSheetList[index][3].match(/^https?:\/\/(www.)?userstyles.org\/styles\/[0-9]*/i)) {
      let styleId = styleSheetList[index][3].match(/styles\/([0-9]*)\//i)[1];
      getCodeForStyle(styleId, styleSheetList[index][7], function(code) {
        updateInUSM(styleId, code, styleSheetList[index][1], styleSheetList[index][3],
                    styleSheetList[index][7], function() {
          addNewStylesFromSync(aStyles, aIndex, aCallback);
        });
      });
    }
    else {
      addNewStylesFromSync(aStyles, aIndex, aCallback);
    }
  }
  catch (ex) {
    addNewStylesFromSync(aStyles, aIndex, aCallback);
  }
}

function deleteStylesFromUSM(aStyleSheetList) {
  aStyleSheetList = aStyleSheetList.sort().reverse();
  for each (let index in aStyleSheetList) {
    // Unload the stylesheet if enabled
    if (styleSheetList[index][0] == 'enabled') {
      unloadStyleSheet(index);
    }
    let deletedStyle = styleSheetList.splice(index, 1);
    if (pref("deleteFromDisk")) {
      let deletedFile = getFileURI(unescape(deletedStyle[0][2]))
                          .QueryInterface(Ci.nsIFileURL).file;
      if (deletedFile.exists()) {
        deletedFile.remove(false);
      }
    }
  }
  writeJSONPref();
}

function prepareToUpdateSync() {
  if (!syncUpdateTimer) {
    syncUpdateTimer = Cc["@mozilla.org/timer;1"]
                        .createInstance(Ci.nsITimer);
    syncUpdateTimer.initWithCallback(updateSyncedList, 10000,
                                     Ci.nsITimer.TYPE_ONE_SHOT);
  }
  else {
    syncUpdateTimer.initWithCallback(updateSyncedList, 10000,
                                     Ci.nsITimer.TYPE_ONE_SHOT);
  }
}

let updateSyncedList = {
  notify: function() {
    syncUpdateTimer.cancel();
    syncUpdateTimer = null;
    let syncedStyleList = styleSheetList.filter(function ([e,n,p,u]) {
      return u && u.match(/styles\/([0-9]*)\//i);
    });
    // trimming down the synced pref
    syncedStyleList = syncedStyleList.map(function ([e,n,p,u,a,da,dm,o,l]) {
      return [e? 1: 0, n, u.match(/styles\/([0-9]*)\//i)[1], o];
    });
    if (shouldUpdateInstall) {
      shouldUpdateInstall = false;
      pref("newInstall", false);
    }
    pref("syncedStyleList", JSON.stringify(syncedStyleList));
  }
};

function getFileURI(path) {
  return path.indexOf("file") == 0
          ? ios.newURI(path, null, null)
          : getURIForFileInUserStyles(path.replace(/^(styles\/)/, ""));
}

function getURIForFileInUserStyles(filepath) {
  let file = FileUtils.getFile("ProfD", ["User Styles"]);
  return ios.newURI("file:///" + file.path.replace(/[\\]/g, "/") + "/" + filepath,
                    null, null);
}

unload(function() {
  if (syncUpdateTimer) {
    syncUpdateTimer.cancel();
    syncUpdateTimer = null;
  }
  openEditors = null;
});