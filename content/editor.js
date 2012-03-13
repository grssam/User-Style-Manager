/* ***** BEGIN LICENSE BLOCK *****
 * Version: MIT/X11 License
 * 
 * Copyright (c) 2011 Girish Sharma
 * 
 * Permission is hereby granted, free of charge, to any person obtaining copy
 * of this software and associated styleEditor.docation files (the "Software"), to deal
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

"use strict";
let global = this;
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/source-editor.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

function getFileURI(path) {
  return path.indexOf("file") == 0? ios.newURI(path, null, null):
    getURIForFileInUserStyles(path.replace(/^(styles\/)/, ""));
}

["helper", "pref", "main"].forEach(function(fileName) {
  let fileURL = "chrome://userstylemanager-scripts/content/" + fileName + ".js";
  Services.scriptloader.loadSubScript(fileURL, global);
});

let styleEditor = {
  initialized: false,
  saved: false,
  savedOnce: false,
  createNew: false,
  openNew: false,
  styleSheetFile: null,
  index: -1,
  previewShown: false,
  origPath: "",
  origEnabled: "",
  doc: null,
  win: null,
  stylePath: "",
  initialText: "",
  lastFind: "",
  regexpIndex: 0,
  replaceVisible: false,
  searchVisible: false,
  lastReplacedIndex: -1,
  strings: null,
  sourceEditorEnabled: (Services.vc.compare(Services.appinfo.platformVersion, "10.0") >= 0),
  editorFindEnabled: (Services.vc.compare(Services.appinfo.platformVersion, "12.0") >= 0),

  // Call back function to be called when closing the editor
  callback: null,

  selectedText: function SE_selectedText() {
    return this.editor.getSelectedText();
  },

  selectRange: function SE_selectRange(aStart, aEnd) {
    if (styleEditor.sourceEditorEnabled)
      styleEditor.editor.setSelection(aStart, aEnd);
    else
      styleEditor.editor.setSelectionRange(aStart, aEnd);
  },

  getSelectionRange: function SE_getSelection() {
    return this.editor.getSelection();
  },

  getSelectionPoints: function SE_getSelectionPoints() {
    return [this.getSelectionRange().start, this.getSelectionRange().end];
  },

  getText: function SE_getText(aStart, aEnd) {
    if (this.sourceEditorEnabled)
      return this.editor.getText(aStart, aEnd);
    else
      return this.editor.value;
  },

  // Function to read the localized strings
  STR: function SE_STR(aString) {
    return styleEditor.strings.GetStringFromName(aString);
  },

  setText: function SE_setText(aText, aStart, aEnd) {
    if (aStart == null)
      aStart = 0;
    if (aEnd == null)
      aEnd = this.getText().length;
    if (this.sourceEditorEnabled)
      this.editor.setText(aText, aStart, aEnd);
    else
      // separating out the text before and after astart and aend
      this.editor.value = this.editor.value.slice(0, aStart) + aText + this.editor.value.slice(aEnd);
  },

  setStyleName: function SE_setStyleName(aStyleName) {
    this.styleName = aStyleName;
  },

  setTitle: function SE_setTitle(aTitle) {
    styleEditor.doc.title = unescape(aTitle);
  },

  resetVariables: function SE_resetVariables() {
    styleEditor.styleSheetFile = null;
    styleEditor.initialized = false;
    styleEditor.doc = null;
    // Resetting the preferences used for manually adding search engine
    Services.prefs.getBranch("extensions.UserStyleManager.").clearUserPref("editorOpen");
  },

  fixupText: function SE_fixupText() {
    let text = styleEditor.getText();
    return text.replace(/![importan]{0,10}\s{0,};/gi,"!important;");
  },

  inputHelper: function SE_inputHelper(event) {
    switch (event.keyCode) {
      case event.DOM_VK_DELETE:
      case event.DOM_VK_BACK_SPACE:
      case event.DOM_VK_DOWN:
      case event.DOM_VK_UP:
      case event.DOM_VK_LEFT:
      case event.DOM_VK_RIGHT:
      case event.DOM_VK_HOME:
      case event.DOM_VK_END:
      case event.DOM_VK_ESCAPE:
      case event.DOM_VK_ENTER:
      case event.DOM_VK_RETURN:
        return;
      default:
        break;
    }
    let currentPos = styleEditor.getCaretOffset();
    let text = styleEditor.getText();
    // check if the types word is !
    if ("!" != text.slice(currentPos - 1, currentPos))
      return;
    // checking whether we are not inside a comment
    let textBefore = text.slice(0, currentPos - 1);
    if (textBefore.lastIndexOf("\/*") > textBefore.lastIndexOf("*\/"))
      return;
    let textAfter = text.slice(currentPos, currentPos + 9);
    if (textAfter.length == 0 || textAfter.toLowerCase() != "important".slice(0, textAfter.length)) {
      styleEditor.setText("important", currentPos, currentPos);
      if (textAfter[0] != ';')
        styleEditor.setText(";", currentPos + 9, currentPos + 9);
      styleEditor.setCaretOffset(currentPos + 10);
    }
  },

  getAffectedContent: function SE_getAffectedContent() {
    let text = styleEditor.getText();
    let matchedURL = text.match(/[@]-moz-document[ ]+(((url|url-prefix|domain)[ ]{0,}\([\'\"]{0,1}([^\'\"\)]+)[\'\"]{0,1}\)[ ,]{0,})+)/);
    if (!matchedURL)
      return "chrome://";
    let urlList = matchedURL[1].replace(/[ ]{0,}(url|url-prefix|domain)\(['"]?/g, "").replace(/['"]?\)[ ]{0,}/g, "").split(",");
    if (!urlList)
      return "";
    else
      return urlList.join(",");
  },

  saveButtonClick: function(aEvent, aCallback) {
    if (!styleEditor.validateCSS())
      return;
    if (styleEditor.saved && styleSheetList[styleEditor.index][1]
      == escape(styleEditor.doc.getElementById("USMFileNameBox").value))
        return;
    if (styleEditor.previewShown) {
      unloadStyleSheet(styleEditor.index);
      styleEditor.previewShown = false;
      styleSheetList[styleEditor.index][0] = styleEditor.origEnabled;
      styleSheetList[styleEditor.index][2] = styleEditor.origPath;
    }
    if (styleEditor.getText() == "")
      return;
    if (!styleEditor.createNew && !styleEditor.openNew)
      unloadStyleSheet(styleEditor.index);
    if (styleEditor.createNew) {
      styleSheetList[styleEditor.index][1] = escape(styleEditor.doc.getElementById("USMFileNameBox").value);
      styleSheetList[styleEditor.index][2] = styleEditor.doc.getElementById("USMFileNameBox")
        .value.replace(/[^0-9a-z\u0000-\u007F\u0400-\u04FF\u0500-\u052F\u0600-\u06FF\~!@#$\%\^&\(\)_\-=+\`\,\.;\'\[\]\{\} ]+/gi, "") + ".css";
      if (styleSheetList[styleEditor.index][2] == ".css")
        styleSheetList[styleEditor.index][2] = "User Created Style Sheet " + styleEditor.index + ".css";
      styleEditor.styleSheetFile = getFileURI(styleSheetList[styleEditor.index][2])
        .QueryInterface(Ci.nsIFileURL).file;
      if (!styleEditor.styleSheetFile.exists())
        try {
          styleEditor.styleSheetFile.create(0, parseInt('0666', 8));
        } catch (ex) { return; }
    }
    else {
      let fileName = styleEditor.doc.getElementById("USMFileNameBox")
        .value.replace(/[^0-9a-z\u0000-\u007F\u0400-\u04FF\u0500-\u052F\u0600-\u06FF\~!@#$\%\^&\(\)_\-=+\`\,\.;\'\[\]\{\} ]+/gi, "");
      if (styleSheetList[styleEditor.index][2].match(/[\\\/]?([^\\\/]{0,})\.css$/)[1] != fileName) {
        styleEditor.styleSheetFile = getFileURI(styleSheetList[styleEditor.index][2])
          .QueryInterface(Ci.nsIFileURL).file;
        if (styleEditor.styleSheetFile.exists())
          try {
            styleEditor.styleSheetFile.remove(false);
          } catch (ex) {}
        styleSheetList[styleEditor.index][2] = styleSheetList[styleEditor.index][2].replace(/[^\\\/]{0,}\.css$/, fileName + ".css");
        styleEditor.styleSheetFile = getFileURI(styleSheetList[styleEditor.index][2])
          .QueryInterface(Ci.nsIFileURL).file;
        if (!styleEditor.styleSheetFile.exists())
          try {
            styleEditor.styleSheetFile.create(0, parseInt('0666', 8));
          } catch (ex) { return; }
        // File with sam name exists, so renaming it to original name (1) format
        else {
          let i = 1;
          while (styleEditor.styleSheetFile.exists()) {
            styleSheetList[styleEditor.index][2] = styleSheetList[styleEditor.index][2]
              .replace(/[^\\\/]{0,}\.css$/, fileName + " (" + i++ + ").css");
            styleEditor.styleSheetFile = getFileURI(styleSheetList[styleEditor.index][2])
              .QueryInterface(Ci.nsIFileURL).file;
          }
          styleEditor.styleSheetFile.create(0, parseInt('0666', 8));
        }
      }
    }
    let ostream = FileUtils.openSafeFileOutputStream(styleEditor.styleSheetFile);
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
      .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    let istream = converter.convertToInputStream(styleEditor.fixupText());
    NetUtil.asyncCopy(istream, ostream, function(status) {
      if (!Components.isSuccessCode(status)) {
        styleEditor.win.alert(this.STR("error.fileSaving"));
        return;
      }
      // Getting the affected content of the stylesheet
      styleSheetList[styleEditor.index][4] = styleEditor.getAffectedContent();
      styleSheetList[styleEditor.index][6] = JSON.stringify(new Date());
      loadStyleSheet(styleEditor.index);
      writeJSONPref();
      styleEditor.onTextSaved();
      if (aCallback)
        aCallback();
      // Close the editor on save if add a new file
      else if (styleEditor.openNew)
        styleEditor.exitButtonClick(aEvent);
    });
  },

  exitButtonClick: function(aEvent) {
    let toClose = styleEditor.promptSave();
    // Cancel
    if (toClose == 1) {
      aEvent.preventDefault();
      return;
    }
    // Save and exit
    else if (toClose == 0) {
      styleEditor.saveButtonClick(null, function() {
        if (styleEditor.callback)
          styleEditor.callback();
        styleEditor.win.close();
      });
      return;
    }
    // Don't Save
    else {
      if (styleEditor.previewShown) {
        unloadStyleSheet(styleEditor.index);
        styleEditor.previewShown = false;
        styleSheetList[styleEditor.index][0] = styleEditor.origEnabled;
        styleSheetList[styleEditor.index][2] = styleEditor.origPath;
        if (!styleEditor.createNew && !styleEditor.openNew)
          loadStyleSheet(styleEditor.index);
      }
      if ((styleEditor.createNew || styleEditor.openNew) && !styleEditor.savedOnce)
        styleSheetList.splice(styleEditor.index, 1);
    }
    styleEditor.resetVariables();
    if (styleEditor.callback)
      styleEditor.callback();
    styleEditor.win.close();
  },

  previewButtonClick: function () {
    if (!styleEditor.validateCSS())
      return;
    let tmpFile = getURIForFileInUserStyles("tmpFile.css").QueryInterface(Ci.nsIFileURL).file;
    if (!tmpFile.exists())
      tmpFile.create(0, parseInt('0666', 8));
    let ostream = FileUtils.openSafeFileOutputStream(tmpFile);
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
      .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    let istream = converter.convertToInputStream(styleEditor.fixupText());
    NetUtil.asyncCopy(istream, ostream, function(status) {
      if (!Components.isSuccessCode(status))
        return;
      // Unload the previous preview if there
      if (styleEditor.previewShown || (!styleEditor.createNew && !styleEditor.openNew))
        unloadStyleSheet(styleEditor.index);
      styleEditor.previewShown = true;
      styleSheetList[styleEditor.index][0] = 'enabled';
      styleSheetList[styleEditor.index][2] = "tmpFile.css";
      loadStyleSheet(styleEditor.index);
    });
  },

  /** Pass various options in the following format 
   ** as the fourth argument while opening editor
   ** [
   **   openNew, // bool , true if opening a new file
   **   index, // in case of editing an existing file, use this
   **   createNew, // bool , true if creating a new file.CANNOT be true if above true
   **   path, // string containing the path of the new file to open when openNew true
   **   callback // bool to tell whther to callback to open options window or not
   ** ]
   **/
  onLoad: function SE_onLoad(aEvent) {
    function startEditor () {
      if (styleEditor.sourceEditorEnabled)
        styleEditor.editor.init(editorPlaceholder, config, styleEditor.onEditorLoad.bind(styleEditor));
      else {
        editorPlaceholder.appendChild(styleEditor.editor);
        styleEditor.setText(config.placeholderText);
        styleEditor.editor.setSelectionRange(styleEditor.editor.value.length, styleEditor.editor.value.length);
      }
      styleEditor.origPath = styleSheetList[styleEditor.index][2];
      styleEditor.origEnabled = styleSheetList[styleEditor.index][0];
      styleEditor.styleName = styleSheetList[styleEditor.index][1];
      if (!styleEditor.sourceEditorEnabled)
        styleEditor.onEditorLoad();
    }

    if (styleEditor.win == null)
      styleEditor.win = window;
    if (styleEditor.doc == null)
      styleEditor.doc = styleEditor.win.document;
    if (aEvent.target != styleEditor.doc)
      return;
    // Check if the window was opened with any arguments called
    if (styleEditor.win.arguments[0]) {
      let args = styleEditor.win.arguments[0];
      if (args[0]) {
        // open a new file
        this.openNew = true;
        this.styleName = escape(args[3].split(/[\/\\]/g).slice(-1)[0].replace(".css", ""));
        this.stylePath = "file:///" + args[3].replace(/[\\]/g, "/");
      }
      else if (args[2]) {
        this.createNew = true;
        if (args[3].length > 0)
          this.initialText = args[3];
      }
      else
        this.index = args[1];
      if (args[4])
        this.callback = function() {
          if (pref("hideOptionsWhileEditing"))
            Services.wm.getMostRecentWindow("navigator:browser")
              .openDialog("chrome://userstylemanager/content/options.xul",
              "User Style Manager Options", "chrome,resizable,centerscreen");
        };
    }

    if (this.sourceEditorEnabled)
      this.editor = new SourceEditor();
    else {
      this.editor = styleEditor.doc.createElementNS(XUL, "textbox");
      this.editor.setAttribute("multiline", true);
      this.editor.setAttribute("flex", "1");
    }
    // checking if gotoline is available or not
    if (!this.editorFindEnabled) {
      styleEditor.doc.getElementById("se-menu-gotoLine").disabled = true;
      let fna = styleEditor.STR("featureNotAvailable");
      styleEditor.doc.getElementById("se-menu-gotoLine").setAttribute("tooltiptext", fna);
    }
    let config = {
      mode: styleEditor.sourceEditorEnabled? SourceEditor.MODES.CSS: null,
      showLineNumbers: true,
      placeholderText: this.initialText.length > 0? this.initialText: this.STR("placeholder.text"),
      initialText: this.initialText.length > 0? this.initialText: this.STR("placeholder.text")
    };
    let editorPlaceholder = styleEditor.doc.getElementById("USMTextEditor");
    this.previewShown = false;
    this.saved = !this.createNew && !this.openNew;

    readJSONPref(function() {
      if (styleEditor.createNew) {
        styleEditor.index = styleSheetList.length;
        styleSheetList.push(['enabled', "User Created Style Sheet "
          + styleEditor.index, "userCreatedStyleSheet" + styleEditor.index + ".css", ""
          , "", JSON.stringify(new Date()), ""]);
      }
      else if (styleEditor.openNew) {
        styleEditor.index = styleSheetList.length;
        styleSheetList.push(['enabled', styleEditor.styleName, styleEditor.stylePath,
          "", "", JSON.stringify(new Date()), ""]);
      }

      if (styleEditor.createNew) {
        try {
          startEditor();
        }
        catch (ex) {
          styleEditor.styleSheetList.splice(styleEditor.index, 1);
          styleEditor.resetVariables();
          styleEditor.win.close();
        }
      }
      // Read the file and put the content in textBox
      else {
        let fileURI = getFileURI(styleSheetList[styleEditor.index][2]);
        styleEditor.styleSheetFile = fileURI.QueryInterface(Ci.nsIFileURL).file;
        NetUtil.asyncFetch(styleEditor.styleSheetFile, function(inputStream, status) {
          if (!Components.isSuccessCode(status)) {
            styleEditor.resetVariables();
            styleEditor.win.close();
            return;
          }
          let data = "";
          try {
            data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
          } catch (ex) {}
          try {
            config.placeholderText = data;
            config.initialText = data;
          } catch (ex) {}
          startEditor();
        });
      }
    });
  },

  onEditorLoad: function SE_onEditorLoad() {
    function $(id) styleEditor.doc.getElementById(id);
    styleEditor.editor.focus();
    styleEditor.initialized = true;
    if (styleEditor.sourceEditorEnabled)
      styleEditor.editor.addEventListener(SourceEditor.EVENTS.CONTEXT_MENU, styleEditor.onContextMenu);
    styleEditor.doc.getElementById("USMTextEditor").firstChild.addEventListener("keypress", styleEditor.inputHelper);

    if (!styleEditor.createNew) {
      styleEditor.setCaretOffset(0);
      if (styleEditor.styleName && !styleEditor.saved)
        styleEditor.onTextChanged();
      else if (styleEditor.styleName && styleEditor.saved)
        styleEditor.onTextSaved();
    }
    else {
      styleEditor.onTextChanged();
      styleEditor.setCaretOffset(styleEditor.getText().length);
    }
    if (styleEditor.createNew)
      styleEditor.setTitle(styleEditor.STR("newStyleSheet") + " - " + styleEditor.STR("USM.label"));
    else
      styleEditor.setTitle(unescape(styleEditor.styleName) + " - " + styleEditor.STR("USM.label"));
    if (!styleEditor.createNew) {
      $("USMFileNameLabel").setAttribute("collapsed", true);
      $("USMFileNameEditingLabel").setAttribute("collapsed", false);
    }
    $("USMFileNameBox").value = unescape(styleSheetList[styleEditor.index][2].match(/[\\\/]?([^\\\/]{0,})\.css$/)[1]);
    $("USMButtonSave").onclick = styleEditor.saveButtonClick;
    if (styleEditor.openNew)
      $("USMButtonSave").label = "Add";
    $("USMButtonPreview").onclick = styleEditor.previewButtonClick;
    $("USMButtonExit").onclick = styleEditor.exitButtonClick;
  },

  insertTextAtCaret: function SE_insertTextAtCaret(aText) {
    let caretOffset = this.getCaretOffset();
    this.setText(aText, caretOffset, caretOffset);
    this.setCaretOffset(caretOffset + aText.length);
  },

  getCaretOffset: function SE_getCaretOffset() {
    if (this.sourceEditorEnabled)
      return this.editor.getCaretOffset();
    else
      return this.editor.selectionStart;
  },

  setCaretOffset: function SE_setCaretOffset(aOffset) {
    if (this.sourceEditorEnabled)
      this.editor.setCaretOffset(aOffset);
    else
      this.editor.setSelectionRange(aOffset, aOffset);
  },

  onContextMenu: function SE_onContextMenu(aEvent) {
    if (!styleEditor.sourceEditorEnabled)
      return;
    let menu = styleEditor.doc.getElementById("USMStyleEditorContextMenu");
    if (menu.state == "closed")
      menu.openPopupAtScreen(aEvent.screenX, aEvent.screenY, true);
  },

  onContextMenuShowing: function SE_onContextMenuShowing() {
    goUpdateGlobalEditMenuItems();
    if (!this.sourceEditorEnabled)
      return;
    let undo = styleEditor.doc.getElementById("se-cmd-undo");
    undo.setAttribute("disabled", !this.editor.canUndo());

    let redo = styleEditor.doc.getElementById("se-cmd-redo");
    redo.setAttribute("disabled", !this.editor.canRedo());
  },

  onToolsMenuShowing: function SE_onToolsMenuShowing() {
    let addNamespace = styleEditor.doc.getElementById("se-cmd-addNamespace");
    addNamespace.setAttribute("disabled", this.getText()
      .search(/[@]namespace[ ]+url\(['"]?http:\/\/www.mozilla.org\/keymaster\/gatekeeper\/there\.is\.only\.xul['"]?\);/) >= 0);
    let addWebNamespace = styleEditor.doc.getElementById("se-cmd-addWebNamespace");
    addWebNamespace.setAttribute("disabled", this.getText()
      .search(/[@]namespace[ ]+url\(['"]?http:\/\/www\.w3\.org\/1999\/xhtml['"]?\);/) >= 0);
  },

  onToolsMenuHiding: function SE_onToolsMenuHiding() {
    styleEditor.doc.getElementById("se-cmd-addNamespace").setAttribute("disabled", false);
    styleEditor.doc.getElementById("se-cmd-addWebNamespace").setAttribute("disabled", false);
  },

  find: function SE_find(aString, aOptions) {
    function $(id) document.getElementById(id);
    aOptions = aOptions || {};
    let text = this.getText();
    if (!$("se-search-regexp").checked) {
      let str = aOptions.ignoreCase ? aString.toLowerCase() : aString;

      if (aOptions.ignoreCase)
        text = text.toLowerCase();

      return (aOptions.backwards ? text.lastIndexOf(str, aOptions.start) :
        text.indexOf(str, aOptions.start));
    }
    else {
      if (this.regexpIndex == -1)
        return [-1, null];
      let modifiers = "gm";
      if (aOptions.ignoreCase)
        modifiers += "i";
      let r;
      try {
        r = new RegExp(aString, modifiers);
      } catch (ex) {
        return [-1, null];
      }
      // Hack to set the regexpindex to last possible value
      if (this.regexpIndex == -2)
        this.regexpIndex = text.split(r).length - 1;
      this.regexpIndex += (aOptions.backwards? -1: 1);
      if (this.regexpIndex <= 0)
        return [-1, null];
      for (let i = 1; i < this.regexpIndex; i++)
        r.exec(text);
      let result = r.exec(text);
      result = result?result[0]:null;
      if (!result)
        return [-1, null];
      let index = r.lastIndex - result.length;
      return [index, result];
    }
  },

  handleRestOfFind: function SE_handleRestOfFind(searchText, searchOptions) {
    function $(id) document.getElementById(id);
    let index, resultText;
    let searchIndex = 0, count = 0;
    if ($("se-search-regexp").checked)
      [index, resultText] = this.find(searchText, searchOptions);
    else
      index = this.find(searchText, searchOptions);
    if ($("se-search-wrap").checked && index < 0) {
      searchOptions.start = searchOptions.backwards? this.getText().length: 0;
      this.regexpIndex = searchOptions.backwards? -2: 0;
      if ($("se-search-regexp").checked)
        [index, resultText] = this.find(searchText, searchOptions);
      else
        index = this.find(searchText, searchOptions);
    }
    if ($("se-search-regexp").checked) {
      try {
        count = this.getText().split(new RegExp(searchText,
          "gm" + (searchOptions.ignoreCase? "i": ""))).length - 1;
      } catch (ex) {
        count = 0;
      }
    }
    else {
      let txt = searchOptions.ignoreCase? this.getText().toLowerCase(): this.getText();
      searchText = searchOptions.ignoreCase? searchText.toLowerCase(): searchText
      count = txt.split(searchText).length - 1;
    }
    // don't update searchindex if we think that it is because
    // of trying to wrap on no wrap
    if (index < 0 && count <= 0)
      this.regexpIndex = -1;
    else if (index >= 0) {
      if ($("se-search-regexp").checked) {
        searchIndex = this.regexpIndex - 1;
        this.selectRange(index, index + resultText.length);
      }
      else {
        this.selectRange(index, index + searchText.length);
        let txt = searchOptions.ignoreCase? this.getText().toLowerCase(): this.getText();
        searchIndex = txt.slice(0, index).split(searchText).length - 1;
      }
    }
    else {
      searchIndex = searchOptions.backwards? 0: count - 1;
      this.regexpIndex = searchOptions.backwards? 1: count;
    }
    $("se-search-index").value = searchIndex + (count > 0? 1: 0);
    $("se-search-count").value = count;
    $("se-search-count").style.color = count? "green": "red";
    $("se-search-box").focus();
    if ($("se-search-regexp").checked)
      return [index, resultText];
    else
      return [index]
  },

  doNewFind: function SE_doNewFind() {
    function $(id) styleEditor.doc.getElementById(id);
    let selected = this.selectedText();
    if (selected && selected.length > 0)
      $("se-search-box").value = selected;
    this.doFind();
  },

  doFind: function SE_doFind() {
    function $(id) styleEditor.doc.getElementById(id);
    let searchText = $("se-search-box").value;
    if (!$("se-search-box").focused && searchText.length == 0) {
      $("se-search-box").focus();
      $("se-search-index").value = " 0";
      $("se-search-count").value = " 0";
      $("se-search-count").style.color = "rgb(50,50,50)";
    }
    else if (searchText.length > 0) {
      let searchOptions = [];
      if (searchText == this.lastFind)
        searchOptions = {
          backwards: $("se-search-backwards").checked,
          ignoreCase: $("se-search-case").checked,
          start: this.getCaretOffset(),
        };
      else {
        this.lastFind = searchText;
        searchOptions = {
          backwards: $("se-search-backwards").checked,
          ignoreCase: $("se-search-case").checked,
          start: this.getCaretOffset() - searchText.length - 1,
        };
      }
      return this.handleRestOfFind(searchText, searchOptions);
    }
    return [-1, null];
  },

  doFindPrevious: function SE_doFindPrevious() {
    function $(id) styleEditor.doc.getElementById(id);
    let searchText = $("se-search-box").value;
    if (!$("se-search-box").focused && searchText.length == 0) {
      $("se-search-box").focus();
      $("se-search-index").value = " 0";
      $("se-search-count").value = " 0";
      $("se-search-count").style.color = "rgb(50,50,50)";
    }
    else if (searchText.length > 0) {
      let searchOptions = {};
      if (searchText == this.lastFind) {
        searchOptions = {
          backwards: !$("se-search-backwards").checked,
          ignoreCase: $("se-search-case").checked,
          start: this.getCaretOffset() - searchText.length - 1,
        };
      }
      else {
        this.lastFind = searchText;
        searchOptions = {
          backwards: !$("se-search-backwards").checked,
          ignoreCase: $("se-search-case").checked,
          start: this.getCaretOffset(),
        };
      }
      this.handleRestOfFind(searchText, searchOptions);
    }
  },

  doReplace: function SE_doReplace(replaceAll) {
    function $(id) styleEditor.doc.getElementById(id);
    if (!this.replaceVisible) {
      if ($("se-search-options-panel").state == "open")
        $("se-search-options-panel").hidePopup();
      $("se-replace-container").style.opacity = 1;
      $("se-replace-container").style.maxHeight = "30px";
      $("se-replace-container").style.margin = "0px";
      this.replaceVisible = true;
    }
    let replaceText = $("se-replace-box").value;
    let searchText = $("se-search-box").value;
    if (replaceText.length > 0 && searchText.length > 0) {
      let count = $("se-search-count").value.replace(/[ ]+/g, "")*1;
      let searchIndex = $("se-search-index").value.replace(/[ ]+/g, "")*1;
      if (count > 0 && searchIndex < count) {
        let caretOffset = this.getCaretOffset();
        if (replaceAll) {
          let text = this.getText();
          let modifiers = "gm";
          if ($("se-search-case").checked)
            modifiers += "i";
          text = text.replace(new RegExp(searchText, modifiers), replaceText);
          this.setText(text);
          this.selectRange(caretOffset - searchText.length, caretOffset - searchText.length + replaceText.length);
        }
        else {
          if (this.lastReplacedIndex != caretOffset - this.selectedText().length)
            this.setCaretOffset(caretOffset - this.selectedText().length);
          let index;
          if ($("se-search-regexp").checked) {
            this.regexpIndex = searchIndex - 1;
            [index, searchText] = this.doFind();
          }
          else
            [index] = this.doFind();
          this.lastReplacedIndex = index;
          if (index >= 0) {
            this.setText(replaceText, index, index + searchText.length);
            this.setCaretOffset(index + replaceText.length);
            this.doFind();
          }
        }
      }
    }
    $("se-replace-box").focus();
  },

  onReplaceFocus: function SE_onReplaceFocus() {
    function $(id) styleEditor.doc.getElementById(id);
    let searchText = $("se-search-box").value;
    $("se-replace-toolbar").style.opacity = 1;
    $("se-replace-toolbar").style.maxWidth = "200px";
    this.onSearchFocus();
  },

  onReplaceBlur: function SE_onReplaceBlur() {
    function $(id) styleEditor.doc.getElementById(id);
    if ($("se-replace-box").value.length > 0 && $("se-search-box").value.length > 0)
      return;
    $("se-replace-toolbar").style.opacity = 0;
    $("se-replace-toolbar").style.maxWidth = "0px";
    this.onSearchBlur();
  },

  closeReplace: function SE_closeReplace() {
    function $(id) styleEditor.doc.getElementById(id);
    if (this.replaceVisible) {
      $("se-replace-container").style.opacity = 0;
      $("se-replace-container").style.maxHeight = "0px";
      $("se-replace-container").style.margin = "-70px 0px 44px 0px";
      this.replaceVisible = false;
    }
    this.onSearchBlur();
  },

  onSearchFocus: function SE_onSearchFocus() {
    function $(id) styleEditor.doc.getElementById(id);
    $("se-search-toolbar").style.opacity = 1;
    $("se-search-toolbar").style.maxWidth = "200px";
    this.searchVisible = true;
  },

  onSearchBlur: function SE_onSearchBlur() {
    function $(id) styleEditor.doc.getElementById(id);
    if ($("se-search-options-panel").state == "open" || $("se-search-options-panel").state == "showing")
      return;
    $("se-search-toolbar").style.opacity = 0;
    $("se-search-toolbar").style.maxWidth = "0px";
    this.searchVisible = false;
  },

  searchPanelHidden: function DE_searchPanelHidden() {
    function $(id) styleEditor.doc.getElementById(id);
    if ($("se-search-box").value.length > 0) {
      styleEditor.onSearchFocus();
      $("se-search-box").focus();
    }
    else {
      styleEditor.onSearchBlur();
      styleEditor.editor.focus();
    }
  },

  addNamespace: function SE_addNameSpace() {
    if (this.getText().search(/[@]namespace[ ]+url\(['"]?http:\/\/www.mozilla.org\/keymaster\/gatekeeper\/there\.is\.only\.xul['"]?\)/) >= 0)
      return;
    if (this.createNew && this.getText().match(/^(\/\*[^*\/]{0,}\*\/\n)$/))
      this.setText("@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n");
    else
      this.setText("@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n" + this.getText());
    this.setCaretOffset(79);
  },

  addWebNamespace: function SE_addWebNameSpace() {
    if (this.getText().search(/[@]namespace[ ]+url\(['"]?http:\/\/www.w3.org\/1999\/xhtml['"]?\)/) >= 0)
      return;
    if (this.createNew && this.getText().match(/^(\/\*[^*\/]{0,}\*\/\n)$/))
      this.setText("@namespace url(http://www.w3.org/1999/xhtml);\n");
    else
      this.setText("@namespace url(http://www.w3.org/1999/xhtml);\n" + this.getText());
    this.setCaretOffset(46);
  },

  addMozURL: function SE_addMozURL() {
    let pos = this.getCaretOffset();
    let [start, end] = this.getSelectionPoints();
    if (start == end)
      this.setText("@-moz-document url('') {\n}", pos, pos);
    else
      this.setText("@-moz-document url('') {\n" + this.getText(start, end) + "\n}", start, end);
    this.setCaretOffset(pos + 20);
  },

  addMozPreURL: function SE_addMozPreURL() {
    let pos = this.getCaretOffset();
    let [start, end] = this.getSelectionPoints();
    if (start == end)
      this.setText("@-moz-document url-prefix('') {\n}", pos, pos);
    else
      this.setText("@-moz-document url-prefix('') {\n" + this.getText(start, end) + "\n}", start, end);
    this.setCaretOffset(pos + 27);
  },

  addMozDomain: function SE_addMozDomain() {
    let pos = this.getCaretOffset();
    let [start, end] = this.getSelectionPoints();
    if (start == end)
      this.setText("@-moz-document domain('') {\n}", pos, pos);
    else
      this.setText("@-moz-document domain('') {\n" + this.getText(start, end) + "\n}", start, end);
    this.setCaretOffset(pos + 23);
  },

  validateCSS: function SE_validateCSS() {
    function getLine(i) {
      styleEditor.setCaretOffset(i);
      return styleEditor.editor.getCaretPosition().line;
    }

    // This is a syntax validator as of now.
    let text = this.getText();
    let caret = 0;
    let error = false;
    let errorList = [];
    let warningList = [];
    let bracketStack = [];
    let bracketStackLine = [];
    // comments in this bracketStack are represented by #
    bracketStack.__defineGetter__("last", function() {
      if (bracketStack.length == 0)
        return "";
      return bracketStack[bracketStack.length - 1];
    });

    function add(x, i) {
      bracketStackLine.push(i);
      bracketStack.push(x);
    };

    function del() {
      bracketStackLine.pop();
      bracketStack.pop();
    };


    for (let i = 0; i < text.length; i++) {
      switch (text[i]) {
        case '\n':
          while (bracketStack.last == '"' || bracketStack.last == "'")
            del();
          break;

        case '/':
          if (bracketStack.last == '"' || bracketStack.last == "'")
            break;
          // this can probably mean a comment start or end
          if (bracketStack.last == '*') {
            // comment end
            del();
            // checking if this comment was even started
            if (bracketStack.last != '#')
              errorList.push([getLine(i), "Comment ending without a start"]);
            else
              del();
          }
          else if (bracketStack.last != '/')
            add('/', getLine(i));
          break;

        case '*':
          if (bracketStack.last == '"' || bracketStack.last == "'")
            break;
          // this can probably mean a comment start or end
          if (bracketStack.last == '/') {
            // comment start
            del();
            // checking if any comment was started before also
            if (bracketStack.last != '#')
              add('#', getLine(i));
          }
          else if (bracketStack.last != '*')
            add('*', getLine(i));
          break;

        case "'":
          if (bracketStack.last == "'")
            del();
          else if (bracketStack.last == '"')
            break;
          else
            add("'", getLine(i));
          break;

        case '"':
          if (bracketStack.last == '"')
            del();
          else if (bracketStack.last == "'")
            break;
          else
            add('"', getLine(i));
          break;

        case '{':
          if (bracketStack.last == '"' || bracketStack.last == "'" || bracketStack.last == '#')
            break;
          else if (bracketStack.last == '/' || bracketStack.last == '*')
            del();
          if (bracketStack.last == ':') {
            errorList.push([getLine(i), "Missing ;"]);
            del();
          }
          add('{', getLine(i));
          break;

        case '}':
          if (bracketStack.last == '"' || bracketStack.last == "'" || bracketStack.last == '#')
            break;
          else if (bracketStack.last == '/' || bracketStack.last == '*')
            del();
          if (bracketStack.last == ':')
            del();
          if (bracketStack.last == '{')
            add('}', getLine(i));
          else if (bracketStack.last == '}') {
            while (bracketStack.last == '}' && bracketStack[bracketStack.length - 2] == '{') {
              del();
              del();
            }
            if (bracketStack.last == '{')
              del();
            else
              errorList.push([getLine(i), "Unmatched }"]);
          }
          else
            errorList.push([getLine(i), "Unmatched }"]);
          break;

        case '(':
          if (bracketStack.last == '"' || bracketStack.last == "'" || bracketStack.last == '#')
            break;
          else if (bracketStack.last == '/' || bracketStack.last == '*')
            del();
          add('(', getLine(i));
          break;

        case ')':
          if (bracketStack.last == '"' || bracketStack.last == "'" || bracketStack.last == '#')
            break;
          else if (bracketStack.last == '/' || bracketStack.last == '*')
            del();
          if (bracketStack.last == '(')
            del();
          else
            errorList.push([getLine(i), "Unmatched )"]);
          break;

        case '[':
          if (bracketStack.last == '"' || bracketStack.last == "'" || bracketStack.last == '#')
            break;
          else if (bracketStack.last == '/' || bracketStack.last == '*')
            del();
          if (bracketStack.last == ':') {
            errorList.push([getLine(i), "Missing ;"]);
            del();
          }
          add('[', getLine(i));
          break;

        case ']':
          if (bracketStack.last == '"' || bracketStack.last == "'" || bracketStack.last == '#')
            break;
          else if (bracketStack.last == '/' || bracketStack.last == '*')
            del();
          if (bracketStack.last == '[')
            del();
          else
            errorList.push([getLine(i), "Unmatched ]"]);
          break;

        case ':':
          if (bracketStack.last == '"' || bracketStack.last == "'" || bracketStack.last == '#')
            break;
          else if (bracketStack.last == '/' || bracketStack.last == '*')
            del();
          if (bracketStack.last == '{')
            add(':', getLine(i));
          else if (bracketStack.last == ':')
            errorList.push([getLine(i), "Missing ;"]);
          break;

        case ';':
          if (bracketStack.last == '"' || bracketStack.last == "'" || bracketStack.last == '#')
            break;
          else if (bracketStack.last == '/' || bracketStack.last == '*')
            del();
          if (bracketStack.last == ':')
            del();
          break;
      }
    }
    if (errorList.length || warningList.length || bracketStack.length%2)
      error = true;

    if (error)
      return promptService.confirm(null, styleEditor.STR("validate.error"), styleEditor.STR("validate.notCSS"));

    // No error found, now looking for url suffixes
    if (text.search(/[@]namespace[ ]+url\([^\)]{1,}\)/) == -1) {
      // checking if moz-url is there or not
      let mozDocURL = text.match(/[@]-moz-document[ ]+(url[\-prefix]{0,7}|domain|regexp)[ ]{0,}\(['"]?([^'"\)]+)['"]?\)[ ]/);
      if (mozDocURL != null) {
        if (mozDocURL[2].search("chrome://") > -1)
          text = "@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n" + text;
        else
          text = "@namespace url(http://www.w3.org/1999/xhtml);\n" + text;
      }
      else {
        let flags = promptService.BUTTON_POS_0 * promptService.BUTTON_TITLE_IS_STRING
          + promptService.BUTTON_POS_1 * promptService.BUTTON_TITLE_IS_STRING;
        let button = promptService.confirmEx(null, styleEditor.STR("validate.title"),
          styleEditor.STR("validate.text"), flags, styleEditor.STR("validate.chrome"),
          styleEditor.STR("validate.website"),"", null, {value: false});
        if (button == 0) {
          // Adding a xul namespace
          text = "@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n" + text;
        }
        else {
          // Adding an xhtml namespace
          text = "@namespace url(http://www.w3.org/1999/xhtml);\n" + text;
        }
      }
    }
    else if (text.match(/[@]-moz-document[ ]+(url[\-prefix]{0,7}|domain|regexp)[ ]{0,}\(['"]?([^'"\)]+)['"]?\)[ ]/) == null) {
      // namespace is there, adding moz url only when it is for web site
      if (text.search(/[@]namespace[ ]+url\(['"]?http:\/\/www.mozilla.org\/keymaster\/gatekeeper\/there\.is\.only\.xul['"]?\);/) < 0) {
        let match = text.match(/([@]namespace[ ]+url\(['"]?http:\/\/www.w3.org\/1999\/xhtml['"]?\);)(.+)/);
        text = match[1] + "@-moz-document domain('') {\n" + match[2] + "\n}";
        caret = match[1].length + 23;
      }
    }
    this.setText(text);
    this.setCaretOffset(caret);
    return true;
  },

  undo: function SE_undo() {
    this.editor.undo();
  },

  redo: function SE_redo() {
    this.editor.redo();
  },

  onTextSaved: function SE_onTextSaved(aStatus) {
    if (aStatus && !Components.isSuccessCode(aStatus))
      return;

    if (!styleEditor.doc || !this.initialized)
      return;  // file saved to disk after styleEditor.win has closed

    styleEditor.doc.title = styleEditor.doc.title.replace(/^\*/, "");
    this.saved = true;
    this.savedOnce = true;
    if (this.sourceEditorEnabled)
      this.editor.addEventListener(
        SourceEditor.EVENTS.TEXT_CHANGED, styleEditor.onTextChanged);
    else
      this.editor.addEventListener("input", styleEditor.onTextChanged);
  },

  onTextChanged: function SE_onTextChanged() {
    styleEditor.doc.title = "*" + styleEditor.doc.title;
    styleEditor.saved = false;
    if (styleEditor.sourceEditorEnabled)
      styleEditor.editor.removeEventListener
        (SourceEditor.EVENTS.TEXT_CHANGED, styleEditor.onTextChanged);
    else
      styleEditor.editor.removeEventListener("input" , styleEditor.onTextChanged);
  },

  onUnload: function SE_onUnload(aEvent) {
    if (aEvent.target != styleEditor.doc)
      return;

    this.resetVariables();
    if (this.sourceEditorEnabled)
      this.editor.removeEventListener(SourceEditor.EVENTS.CONTEXT_MENU, this.onContextMenu);
    styleEditor.doc.getElementById("USMTextEditor").firstChild.removeEventListener("keypress", this.inputHelper);
    this.editor.destroy();
    this.editor = null;
    this.initialized = false;
  },

  // return 0 : Save, 1 : Cancel , 2 : Don't Save
  promptSave: function SE_promptSave() {
    if (this.styleName && !this.saved) {
      let ps = Services.prompt;
      let flags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_SAVE +
                  ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL +
                  ps.BUTTON_POS_2 * ps.BUTTON_TITLE_DONT_SAVE;
      let button = ps.confirmEx(styleEditor.win, this.STR("saveDialogBox.title"),
        this.STR("saveDialogBox.text"), flags, null, null, null, null, {});
      return button;
    }
    return 2;
  },

  onClose: function SE_onClose(aEvent) {
    let toClose = this.promptSave();
    if (toClose == 1) {
      aEvent.preventDefault();
      return;
    }
    else {
      if ((styleEditor.createNew || styleEditor.openNew) && !styleEditor.savedOnce)
        styleSheetList.splice(styleEditor.index, 1);
      this.resetVariables();
    }
    if (this.callback)
      this.callback();
  },

  close: function SE_close() {
    let toClose = this.promptSave();
    if (toClose == 2) {
      if ((styleEditor.createNew || styleEditor.openNew) && !styleEditor.savedOnce)
        styleSheetList.splice(styleEditor.index, 1);
      this.resetVariables();
      styleEditor.win.close();
    }
  }
};

XPCOMUtils.defineLazyGetter(styleEditor, "strings", function () {
  return Services.strings.createBundle("chrome://userstylemanager/locale/styleeditor.properties");
});

addEventListener("load", styleEditor.onLoad.bind(styleEditor), false);
addEventListener("unload", styleEditor.onUnload.bind(styleEditor), false);
addEventListener("close", styleEditor.onClose.bind(styleEditor), false);