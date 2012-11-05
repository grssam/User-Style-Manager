/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 * Creator:
 *   Girish Sharma <scrapmachines@gmail.com>
 */

"use strict";
let global = this;
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("chrome://userstylemanager-scripts/content/shared.jsm");

["helper", "pref", "main", "sync"].forEach(function(fileName) {
  let fileURL = "chrome://userstylemanager-scripts/content/" + fileName + ".js";
  Services.scriptloader.loadSubScript(fileURL, global);
});

let optionsWindow = {
  initialized: false,
  tree: null,
  treeView: null,
  editorOpened: false,
  shortcutChanged: false,
  shortcutKey: pref("shortcutKey"),
  shortcutModifiers: pref("shortcutModifiers"),
  strings: null,
  changedIndex: [],

  STR: function OW_STR(aString) {
    return optionsWindow.strings.GetStringFromName(aString);
  },

  openFile: function OW_openFile() {
    let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window, this.STR("openDialog.title"), Ci.nsIFilePicker.modeOpen);
    fp.defaultString = "";
    fp.appendFilter("Style Sheets","*.css;");
    if (fp.show() != Ci.nsIFilePicker.returnCancel) {
      let args = [true, styleSheetList.length, false, escape(fp.file.path), true];
      openUserStyleEditor("User Style Manager - Editor - Open File", args).focus();
      this.editorOpened = true;
      if (pref("hideOptionsWhileEditing")) {
        window.close();
      }
    }
  },

  resetVariables: function OW_resetVariables() {
    optionsWindow.initialized = false;
  },

  toDateString: function OW_toDateString(dateString) {
    let date = new Date(JSON.parse(dateString));
    return date.toLocaleString()
               .split(", ")
               .filter(function(part) part.indexOf("day") > 0? false: true)
               .join(", ");
  },

  sorter: function OW_sorter(a, b) {
    let sortColumn = pref("sortColumn");
    let sortOrder = pref("sortOrder");
    if (sortColumn < 0 || sortOrder == 0) {
      return a[20] - b[20];
    }
    else {
      let aa = a[sortColumn].toLowerCase();
      let bb = b[sortColumn].toLowerCase();
      if (aa < bb) {
        return -1*sortOrder
      }
      else if (aa > bb) {
        return sortOrder;
      }
      return 0;
    }
  },

  getSortedList: function OW_getSortedList() {
    let tempList = JSON.parse(JSON.stringify(styleSheetList));
    for (let i = 0; i < tempList.length; i++) {
      tempList[i][20] = i;
    }
    tempList.sort(optionsWindow.sorter);
    return tempList;
  },

  populateStyles: function OW_populateStyles() {
    optionsWindow.treeView = {
      treeBox: null,
      origList: styleSheetList,
      list: optionsWindow.getSortedList(),
      date: "",
      get rowCount() this.list.length,
      getCellText : function(row, column) {
        switch (column.id) {
          case "styleSheetNameCol" :
            return unescape(this.list[row][1]);
          case "styleSheetAppliesOnCol" :
            if (this.list[row][4].length == 0) {
              return optionsWindow.STR("unknown");
            }
            return this.list[row][4].split(",").map(function(val) {
              if (val.indexOf("chrome://") == 0) {
                if (val.match(/\/[^.\/]+\.[^.\/]+$/)) {
                  return optionsWindow.STR("fx") + ", " +
                         val.match(/\/([^.\/]+\.[^.\/]+)$/)[1];
                }
                return optionsWindow.STR("fx");
              }
              return val.replace(/^https?:\/\//, "");
            }).join(", ");
          case "styleSheetDateAdded" :
            return optionsWindow.toDateString(this.list[row][5]);
          case "styleSheetDateModified" :
            return this.list[row][6].length > 0
                     ? optionsWindow.toDateString(this.list[row][6])
                     : optionsWindow.toDateString(this.list[row][5]);
        }
      },
      getCellValue : function(row, column) {
        if (column.id == "styleSheetStateCol") {
          return this.list[row][0] == "enabled"? true: false;
        }
      },
      setCellText : function(row, column, value) {
        switch (column.id) {
          case "styleSheetNameCol" :
            this.origList[this.list[row][20]][1] = this.list[row][1] = escape(value);
            optionsWindow.hasChanges = true;
            optionsWindow.changedIndex.push(this.list[row][20]);
            optionsWindow.notifyChange();
            break;
          default:
            break;
        }
      },
      setCellValue : function(row, column, value) {
        if (column.id == "styleSheetStateCol") {
          let index = this.list[row][20];
          toggleStyleSheet(index, this.list[row][0],
                           value == "true"? 'enabled': 'disabled');
          Services.obs.notifyObservers(null, "USM:codeMappings:updated",
                                       JSON.stringify(index));
          this.origList[index][0] = this.list[row][0] =
            (value == "true"? 'enabled': 'disabled');
        }
      },
      setTree: function(treebox){ this.treebox = treebox;},
      isContainer: function(row){ return false;},
      isSeparator: function(row){ return false;},
      isSorted: function(){ return false;},
      isEditable: function(idx, column) {
        if (column.id == "styleSheetNameCol" ||
            column.id == "styleSheetStateCol") {
          return true;
        }
        return false;
      },
      cycleHeader: function(column) {
        let col = -1;
        switch (column.id) {
          case "styleSheetNameCol":
            col = 1;
            break;
          case "styleSheetAppliesOnCol":
            col = 4;
            break;
          case "styleSheetDateAdded":
            col = 5;
            break;
          case "styleSheetDateModified":
            col = 6;
            break;
          default:
            col = -1;
        }
        let cols = document.getElementsByTagName("treecol");
        for (let i = 0; i < cols.length; i++) {
          cols[i].removeAttribute("sortDirection");
        }
        if (col < 0) {
          pref("sortColumn", -1);
          return;
        }
        if (pref("sortColumn") == col) {
          pref("sortOrder", (pref("sortOrder") + 2)%3 - 1);
        }
        else {
          pref("sortColumn", col);
          pref("sortOrder", 1);
        }
        if (pref("sortOrder") != 0) {
          document.getElementById(column.id)
                  .setAttribute("sortDirection", pref("sortOrder") != 1
                                                 ? "ascending"
                                                 : "descending");
        }
        optionsWindow.populateStyles();
      },
      getLevel: function(row) {return 0;},
      getImageSrc: function(row,col) {return null;},
      getRowProperties: function(row, properties) {
        let atomService = Cc["@mozilla.org/atom-service;1"]
                            .getService(Ci.nsIAtomService);
        if (this.list[row][0] == 'disabled') {
          let atom = atomService.getAtom("disabled");
          properties.AppendElement(atom);
        }
      },
      getCellProperties: function(row,col,props) {
        let atomService = Cc["@mozilla.org/atom-service;1"]
                            .getService(Ci.nsIAtomService);
        if (this.list[row][0] == 'disabled' && col.id != "styleSheetStateCol") {
          let atom = atomService.getAtom("disabledText");
          props.AppendElement(atom);
        }
      },
      getColumnProperties: function(colid,col,props) {}
    };
    optionsWindow.tree.view = optionsWindow.treeView;
    if (pref("sortColumn") >= 0 && pref("sortOrder") != 0) {
      let id = "";
        switch (pref("sortColumn")) {
          case 1:
            id = "styleSheetNameCol";
            break;
          case 4:
            id = "styleSheetAppliesOnCol";
            break;
          case 5:
            id = "styleSheetDateAdded";
            break;
          case 6:
            id = "styleSheetDateModified";
            break;
          default:
            return;
        }
      document.getElementById(id)
              .setAttribute("sortDirection", pref("sortOrder") != 1
                                             ? "ascending"
                                             : "descending");
    }
  },

  onLoad: function OW_onLoad() {
    function $(id) document.getElementById(id);
    if (window.navigator.oscpu.search(/^mac/i) == 0) {
      $("createAppMenuMenuitem").disabled = $("createAppMenuMenuitem").hidden = true;
    }
    this.tree = document.getElementById("styleSheetTree");
    this.initialized = true;
    readJSONPref(function() {
      optionsWindow.populateStyles();
      $("updateStyleSheet").disabled = $("moreInfo").disabled =
        $("editStyleSheet").disabled = $("deleteStyleSheet").disabled =
        optionsWindow.tree.view.selection.getRangeCount() == 0;
    });
    listen(window, window, "focus", function() {
      if (!pref("hideOptionsWhileEditing") && optionsWindow.editorOpened) {
        optionsWindow.editorOpened = false;
        readJSONPref(function() {
          optionsWindow.populateStyles();
        });
      }
    });
    if (Weave.Status.service != Weave.STATUS_OK) {
      $("syncMenu").disabled = true;
      $("syncMenu").setAttribute("tooltiptext",
                                 optionsWindow.STR("firefoxSync.disabled"));
    }
    // Displaying the shortcut 
    this.shortcutTextBox = document.getElementById("shortcutTextBox");
    if (window.navigator.oscpu.toLowerCase().indexOf("window") >= 0) {
      optionsWindow.shortcutModifiers =
        optionsWindow.shortcutModifiers.replace("accel", "ctrl");
    }
    this.shortcutTextBox.value = this.shortcutModifiers.replace(",", " +") +
                                 " + " + this.shortcutKey;
    this.shortcutTextBox.onclick = function() {
      optionsWindow.shortcutTextBox.setSelectionRange(0, optionsWindow.shortcutTextBox.value.length);
    };
    listen(window, optionsWindow.shortcutTextBox, "keydown",
           optionsWindow.handleShortcutChange);
    let win = document.getElementById("USMOptionsWindow");
    let rects = document.getElementById("createStyleSheet").getBoundingClientRect();
    win.setAttribute("width", Math.max(rects.right + 50, win.width));
    win.setAttribute("height", Math.max(rects.bottom + 125, win.height));
  },

  onUnload: function OW_onUnload() {
    this.resetVariables();
  },

  saveChanges: function OW_saveChanges() {
    if (optionsWindow.shortcutChanged) {
      pref("shortcutKey", optionsWindow.shortcutKey);
      pref("shortcutModifiers", optionsWindow.shortcutModifiers);
    }
    writeJSONPref(function() {
      if (optionsWindow.hasChanges) {
        optionsWindow.changedIndex.forEach(function(i) {
          Services.obs.notifyObservers(null, "USM:codeMappings:updated",
                                       JSON.stringify(i));
        });
        optionsWindow.changedIndex = [];
      }
    });
  },

  handleShortcutChange: function OW_handleShortcutChange(event) {
    let value = "";
    if (event.ctrlKey) {
      value += "Ctrl + ";
    }
    if (event.shiftKey) {
      value += "Shift + ";
    }
    if (event.altKey) {
      value += "Alt + ";
    }
    if (event.metaKey) {
      value += "Command + ";
    }
    if (event.keyCode > 64 && event.keyCode < 91) {
      value += String.fromCharCode(event.keyCode);
    }
    else {
      value = optionsWindow.shortcutModifiers.replace(",", " +") + " + " +
              optionsWindow.shortcutKey;
    }
    optionsWindow.shortcutTextBox.value = value;
  },

  editStyleSheet: function OW_editStyleSheet() {
    let numRanges = this.tree.view.selection.getRangeCount();
    if (numRanges < 1) {
      return;
    }
    let start = new Object();
    let end = new Object();
    for (let t = 0; t < numRanges; t++){
      this.tree.view.selection.getRangeAt(t, start, end);
      for (let i = start.value; i <= end.value; i++) {
        let args = [false, this.treeView.list[i][20], false, "", true];
        openUserStyleEditor("User Style Manager - Editor " + i, args, true).focus();
      }
    }
    this.editorOpened = true;
    if (pref("hideOptionsWhileEditing")) {
      window.close();
    }
  },

  createStyleSheet: function OW_editStyleSheet() {
    let args = [false, styleSheetList.length, true, "", true];
    openUserStyleEditor("User Style Manager - Editor - New", args).focus();
    this.editorOpened = true;
    if (pref("hideOptionsWhileEditing")) {
      window.close();
    }
  },

  deleteStyleSheet: function OW_deleteStyleSheet() {
    let numRanges = this.tree.view.selection.getRangeCount();
    if (numRanges < 1) {
      return;
    }
    let start = new Object();
    let end = new Object();
    let count = 0;
    for (let t = 0; t < numRanges; t++) {
      this.tree.view.selection.getRangeAt(t, start, end);
      count += (end.value - start.value + 1);
    }
    if (count == 1) {
      let index = this.treeView.list[this.tree.currentIndex][20];
      let finalAnswer = promptService.confirm(null, this.STR("confirm.pls"),
                                              this.STR("remove.preText") + " " +
                                              unescape(styleSheetList[index][1]) +
                                              " " + this.STR("remove.postText"));
      if (finalAnswer) {
        // Unload the stylesheet if enabled
        deleteStylesFromUSM([index]);
        this.populateStyles();
      }
    }
    else {
      let finalAnswer = promptService.confirm(null, this.STR("confirm.pls"),
                                              this.STR("remove.preText") + " " +
                                              count + " " + this.STR("remove.postText"));
      if (!finalAnswer) {
        return;
      }
      let indexes = [];
      for (let t = 0; t < numRanges; t++) {
        this.tree.view.selection.getRangeAt(t, start, end);
        for (let i = start.value; i <= end.value; i++) {
          indexes.push(optionsWindow.treeView.list[i][20]);
        }
      }
      deleteStylesFromUSM(indexes);
      this.populateStyles();
    }
  },

  updateStyle: function OW_updateStyle() {
    let numRanges = this.tree.view.selection.getRangeCount();
    if (numRanges < 1) {
      return;
    }
    let start = new Object();
    let end = new Object();
    for (let t = 0; t < numRanges; t++) {
      this.tree.view.selection.getRangeAt(t, start, end);
      for (let i = start.value; i <= end.value; i++) {
        let index = this.treeView.list[i][20];
        updateStyle(index);
      }
    }
  },

  updateAllStyle: function OW_updateAllStyle(index) {
    if (index == null) {
      index = 0;
    }
    else if (index == styleSheetList.length) {
      return;
    }
    updateStyle(index, function() {
      this.updateAllStyle(index + 1);
    }.bind(this));
  },

  onTreeKeypress: function OW_onTreeKeypress(event) {
    if (this.tree && this.tree.editingRow > -1) {
      return;
    }
    switch(event.keyCode) {
      case event.DOM_VK_DELETE:
        optionsWindow.deleteStyleSheet();
        break;
      case event.DOM_VK_RETURN:
      case event.DOM_VK_ENTER:
        optionsWindow.editStyleSheet();
        break;
    }
  },

  onTreeClick: function OW_onTreeClick() {
    function $(id) document.getElementById(id);
    let disabled = true;
    try {
      disabled = optionsWindow.tree.view.selection.getRangeCount() == 0;
    } catch (ex) {}
    $("updateStyleSheet").disabled = $("moreInfo").disabled =
      $("editStyleSheet").disabled = $("deleteStyleSheet").disabled = disabled;
  },

  showMoreInfo: function OW_showMoreInfo() {
    let numRanges = this.tree.view.selection.getRangeCount();
    if (numRanges < 1) {
      return;
    }
    let start = new Object();
    let end = new Object();
    for (let t = 0; t < numRanges; t++){
      this.tree.view.selection.getRangeAt(t, start, end);
      for (let i = start.value; i <= end.value; i++) {
        window.openDialog("chrome://UserStyleManager/content/moreInfo.xul",
                          "More Information - User Style Manager " + i,
                          "centerscreen, chrome, resizable=yes",
                          styleSheetList[this.treeView.list[i][20]]).focus();
      }
    }
  },

  backupMenuPopupShowing: function OW_backupMenuPopupShowing() {
    function $(id) document.getElementById(id);
    if (pref("maintainBackup")) {
      $("maintainBackupMenuitem").setAttribute("checked", true);
    }
    if (pref("fallBack")) {
      $("fallBackMenuitem").setAttribute("checked", true);
    }
  },

  entryMenuPopupShowing: function OW_entryMenuPopupShowing() {
    function $(id) document.getElementById(id);
    if (pref("createToolsMenuButton")) {
      $("createToolsMenuMenuitem").setAttribute("checked", true);
    }
    if (pref("createAppMenuButton")) {
      $("createAppMenuMenuitem").setAttribute("checked", true);
    }
    if (pref("createToolbarButton")) {
      $("createToolbarButtonMenuitem").setAttribute("checked", true);
    }
    if (pref("createContextMenuEntry")) {
      $("createContextMenuMenuitem").setAttribute("checked", true);
    }
  },

  updateMenuPopupShowing: function OW_updateMenuPopupShowing() {
    function $(id) document.getElementById(id);
    if (pref("updateAutomatically")) {
      $("updateAutomatically").setAttribute("checked", true);
    }
    if (pref("updateOverwritesLocalChanges")) {
      $("updateOverwritesLocalChanges").setAttribute("checked", true);
    }
  },

  syncMenuPopupShowing: function OW_syncMenuPopupShowing() {
    function $(id) document.getElementById(id);
    if (pref("syncStyles")) {
      $("syncStyles").setAttribute("checked", true);
    }
    else {
      $("keepDeletedOnSync").setAttribute("disabled", true);
      $("syncImmediately").setAttribute("disabled", true);
    }
    if (pref("keepDeletedOnSync")) {
      $("keepDeletedOnSync").setAttribute("checked", true);
    }
    if (pref("syncImmediately")) {
      $("syncImmediately").setAttribute("checked", true);
    }
  },

  togglePref: function OW_togglePref(prefName) {
    pref(prefName, !pref(prefName));
  },

  notifyChange: function OW_notifyChange(val) {
    if (val) {
      val = val.toLowerCase().replace("ctrl", "accel").split(" + ");
      if (val.length == 1) {
        optionsWindow.shortcutModifiers = "";
        optionsWindow.shortcutKey = val[0];
        optionsWindow.shortcutChanged = true;
      }
      else if (val.length > 1 &&
               val[val.length - 1] >= 'a' &&
               val[val.length - 1] <= 'z') {
        optionsWindow.shortcutKey = (val.splice(val.length - 1, 1))[0].toUpperCase();
        optionsWindow.shortcutModifiers = val.join(", ").toLowerCase();
        optionsWindow.shortcutChanged = true;
      }
    }
    let nb = document.getElementById("changeNotificationBox");
    nb.removeAllNotifications(true);
    nb.appendNotification(optionsWindow.STR("notif.text"),
                          optionsWindow.STR("notif.title"),
                          null,
                          nb.PRIORITY_INFO_HIGH,
                          "",
                          null);
  }
};

XPCOMUtils.defineLazyGetter(optionsWindow, "strings", function () {
  return Services.strings.createBundle("chrome://userstylemanager/locale/optionwindow.properties");
});
