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
 
"use strict";
let global = this;

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

let gAddon;
let reload = function() {};
let toolbarButton = null;
// variable to store localized strings
let strings = {str:null};
XPCOMUtils.defineLazyGetter(strings, "str", function () {
  return Services.strings.createBundle("chrome://userstylemanager/locale/main.properties");
});
function l10n(aString) {
  return strings.str.GetStringFromName(aString);
}
const keysetID = "USMKeyset";
const keyID = "USMKeyID";
const toolsMenuitemID = "USMToolsMenuItem";
const appMenuitemID = "USMAppMenuItem";
const toolbarButtonID = "USMToolbarButton";
const contextMenuEntryID = "USMContextMenuItem";

// Function to run on every window which detects customizations
function handleCustomization(window) {
  // Disable the add-on when customizing
  listen(window, window, "beforecustomization", function() {
    if (gAddon.userDisabled)
      return;
    unloadStyleSheet();

    // Listen for one customization finish to re-enable the addon
    listen(window, window, "aftercustomization", reload, false);
  });
}

function addContextMenuEntry(window) {
  function $(id) window.document.getElementById(id);
  function browserContextShowing() {}
  function removeContextEntry() {
    browserContextShowing = null;
    $(contextMenuEntryID) && $(contextMenuEntryID).parentNode.removeChild($(contextMenuEntryID));
    $(contextMenuEntryID + "Seperator")
      && $(contextMenuEntryID + "Seperator").parentNode.removeChild($(contextMenuEntryID + "Seperator"));
  }
  removeContextEntry();
  function openEditor() {
    let args = [false, styleSheetList.length, true, window.content.document.getSelection().toString(), false];
    window.openDialog("chrome://userstylemanager/content/editor.xul",
      "User Style Manager - Editor","chrome,resizable,height=600,width=800,top="
      + (window.screen.height/2 - 300) + ",left="
      + (window.screen.width/2 - 400), args).focus();
  }
  if (!$(contextMenuEntryID) && pref("createContextMenuEntry")) {
    browserContextShowing = function () {
      try {
        if (window.content.document.getSelection().toString().length > 0) {
          $(contextMenuEntryID + "Seperator").hidden = $(contextMenuEntryID).hidden = false;
          return;
        }
      } catch (ex) {}
      if (pref("createContextMenuEntry"))
        $(contextMenuEntryID + "Seperator").hidden = $(contextMenuEntryID).hidden = true;
    };
    let (contextEntry = window.document.createElementNS(XUL, "menuitem")) {
      contextEntry.setAttribute("id", contextMenuEntryID);
      contextEntry.setAttribute("class", "menuitem-iconic");
      contextEntry.setAttribute("image", LOGO);
      contextEntry.setAttribute("label", l10n("contextEntry.label"));
      contextEntry.setAttribute("accesskey", l10n("contextEntry.accesskey"));
      contextEntry.setAttribute("tooltiptext", l10n("contextEntry.tooltip"));
      let menuSep = window.document.createElementNS(XUL, "menuseparator");
      menuSep.setAttribute("id", contextMenuEntryID + "Seperator");
      $("contentAreaContextMenu").insertBefore(menuSep, $("context-searchselect"));
      $("contentAreaContextMenu").insertBefore(contextEntry, menuSep);
      listen(window, contextEntry, "command", openEditor);
      unload(removeContextEntry, window);
    }
    listen(window, $("contentAreaContextMenu"), "popupshowing", browserContextShowing);
  }
}

function getDomain(win) {
  let url = getURL(win);
  return url.replace(/^(https?:\/\/)?(www\.)?/, '').match(/^([^\/]+)\/?/)[1];
}

function getURL(window) {
  // Get the current browser's URI even if loading
  let channel = window.gBrowser.selectedBrowser.webNavigation.documentChannel;
  if (channel != null)
    return decodeURI(channel.originalURI.spec);

  // Just return the finished loading uri
  return decodeURI(window.gBrowser.selectedBrowser.currentURI.spec);
}

function createNew(window, type) {
  let args = [false, null, true, "", false];
  switch (type) {
    case 'blank':
      args[3] = "";
      break;
    case 'domain':
      args[3] = "@namespace url(http://www.w3.org/1999/xhtml);\n"
                + "@-moz-document domain('" + getDomain(window) + "') {\n"
                + l10n("writeStyleHere") + "\n}";
      break;
    case 'url':
      args[3] = "@namespace url(http://www.w3.org/1999/xhtml);\n"
                + "@-moz-document url('" + getURL(window) + "') {\n"
                + l10n("writeStyleHere") + "\n}";
      break;
    case 'fx':
      args[3] = "@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n"
                + "@-moz-document url-prefix('chrome://') {\n"
                + l10n("writeStyleHere") + "\n}";
      break;
  }
  Services.wm.getMostRecentWindow("navigator:browser")
    .openDialog("chrome://userstylemanager/content/editor.xul",
    "User Style Manager - Editor - Create New","chrome,resizable,height=600,width=800,top="
    + (window.screen.height/2 - 300) + ",left="
    + (window.screen.width/2 - 400), args).focus();
}

function populateMenuPopupList(window, id, event) {
  if (event.target.id != id)
    return;
  let menupop = window.document.getElementById(id);
  styleSheetList = JSON.parse(pref("userStyleList"));
  if (menupop) {
    let child = menupop.firstChild;
    while (child) {
      let item = child;
      child = child.nextSibling;
      menupop.removeChild(item);
    }
    let (itemManage = window.document.createElementNS(XUL, "menuitem")) {
      itemManage.setAttribute("label", l10n("manage.label"));
      itemManage.setAttribute("accesskey", l10n("manage.accesskey"));
      itemManage.setAttribute("tooltiptext", l10n("manage.tooltip"));
      listen(window, itemManage, "command", function() openOptions(window));
      menupop.appendChild(itemManage);
    }
    // Adding menu to create new styles based on current domain/url/blank/Fx Chrome
    let (createMenu = window.document.createElementNS(XUL, "menu")) {
      createMenu.setAttribute("label", l10n("create.label"));
      createMenu.setAttribute("accesskey", l10n("create.accesskey"));
      createMenu.setAttribute("tooltiptext", l10n("create.tooltip"));
      let (createMenupop = window.document.createElementNS(XUL, "menupopup")) {
        createMenupop.setAttribute("class", "popup-internal-box");
        let (createItem = window.document.createElementNS(XUL, "menuitem")) {
          createItem.setAttribute("label", l10n("create.blank.label"));
          createItem.setAttribute("accesskey", l10n("create.blank.accesskey"));
          createItem.setAttribute("tooltiptext", l10n("create.blank.tooltip"));
          listen(window, createItem, "command", function() createNew(window, 'blank'));
          createMenupop.appendChild(createItem);
        }
        let (createItem = window.document.createElementNS(XUL, "menuitem")) {
          createItem.setAttribute("label", l10n("create.domain.label"));
          createItem.setAttribute("accesskey", l10n("create.domain.accesskey"));
          createItem.setAttribute("tooltiptext", l10n("create.domain.tooltip") + " " + getDomain(window));
          listen(window, createItem, "command", function() createNew(window, 'domain'));
          createMenupop.appendChild(createItem);
        }
        let (createItem = window.document.createElementNS(XUL, "menuitem")) {
          createItem.setAttribute("label", l10n("create.url.label"));
          createItem.setAttribute("accesskey", l10n("create.url.accesskey"));
          createItem.setAttribute("tooltiptext", l10n("create.url.tooltip") + " " + getURL(window));
          listen(window, createItem, "command", function() createNew(window, 'url'));
          createMenupop.appendChild(createItem);
        }
        let (createItem = window.document.createElementNS(XUL, "menuitem")) {
          createItem.setAttribute("label", l10n("create.fx.label"));
          createItem.setAttribute("accesskey", l10n("create.fx.accesskey"));
          createItem.setAttribute("tooltiptext", l10n("create.fx.tooltip"));
          listen(window, createItem, "command", function() createNew(window, 'fx'));
          createMenupop.appendChild(createItem);
        }
        createMenu.appendChild(createMenupop);
      }
      menupop.appendChild(createMenu);
    }
    // Adding the menu containing sorted stylesheets
    let (sortedMenu = window.document.createElementNS(XUL, "menu")) {
      sortedMenu.setAttribute("label", l10n("sortedMenu.label"));
      sortedMenu.setAttribute("accesskey", l10n("sortedMenu.accesskey"));
      let (sortedMenupop = window.document.createElementNS(XUL, "menupopup")) {
        sortedMenupop.setAttribute("class", "popup-internal-box");
        sortedStyleSheet.forEach(function(data) {
          let sortedItem = window.document.createElementNS(XUL, "menu");
          sortedItem.setAttribute("label", data[0]);
          sortedItem.setAttribute("class", "menu-iconic");
          let sortedItemMenupop = window.document.createElementNS(XUL, "menupopup");
          sortedItemMenupop.setAttribute("class", "popup-internal-box");
          let (enableAll = window.document.createElementNS(XUL, "menuitem")) {
            enableAll.setAttribute("label", l10n("enableAll.label"));
            enableAll.setAttribute("accesskey", l10n("enableAll.accesskey"));
            enableAll.setAttribute("tooltiptext", l10n("enableAll.tooltip"));
            listen(window, enableAll, "command", function() {
              for (let i = 1; i < data.length; i++) {
                if (styleSheetList[data[i]][0] == 'enabled')
                  continue;
                styleSheetList[data[i]][0] = 'enabled';
                loadStyleSheet(data[i]);
              }
              writeJSONPref();
            });
            sortedItemMenupop.appendChild(enableAll);
          }
          let (disableAll = window.document.createElementNS(XUL, "menuitem")) {
            disableAll.setAttribute("label", l10n("disableAll.label"));
            disableAll.setAttribute("accesskey", l10n("disableAll.accesskey"));
            disableAll.setAttribute("tooltiptext", l10n("disableAll.tooltip"));
            listen(window, disableAll, "command", function() {
              for (let i = 1; i < data.length; i++) {
                if (styleSheetList[data[i]][0] == 'disabled')
                  continue;
                unloadStyleSheet(data[i]);
                styleSheetList[data[i]][0] = 'disabled';
              }
              writeJSONPref();
            });
            sortedItemMenupop.appendChild(disableAll);
          }
          let (sep = window.document.createElementNS(XUL, "menuseparator")) {
            sortedItemMenupop.appendChild(sep);
          }
          for (let i = 1; i < data.length; i++) {
            let index = data[i];
            let style = styleSheetList[index];
            let item = window.document.createElementNS(XUL, "menuitem");
            item.setAttribute("label", unescape(style[1]));
            item.setAttribute("type", "checkbox");
            if (style[0] == 'enabled')
              item.setAttribute("checked", true);
            if (item.hasAttribute("checked"))
              item.setAttribute("tooltiptext", l10n("styleSheet.disable.text"))
            else
              item.setAttribute("tooltiptext", l10n("styleSheet.enable.text"))
            listen(window, item, "mousedown", function(event) {
              event.preventDefault();
              event.stopPropagation();
              toggleStyleSheet(index, !item.hasAttribute("checked")?'disabled':'enabled',
                !item.hasAttribute("checked")?'enabled':'disabled');
              if (item.hasAttribute("checked") && item.getAttribute("checked")) {
                item.setAttribute("tooltiptext", l10n("styleSheet.disable.text"))
              }
              else {
                item.setAttribute("tooltiptext", l10n("styleSheet.enable.text"))
              }
            });
            sortedItemMenupop.appendChild(item);
          }
          sortedItem.appendChild(sortedItemMenupop);
          sortedMenupop.appendChild(sortedItem);
        });
        sortedMenu.appendChild(sortedMenupop);
      }
      menupop.appendChild(sortedMenu);
    }
    let (sep = window.document.createElementNS(XUL, "menuseparator")) {
      menupop.appendChild(sep);
    }
    let (enableAll = window.document.createElementNS(XUL, "menuitem")) {
      enableAll.setAttribute("label", l10n("enableAll.label"));
      enableAll.setAttribute("accesskey", l10n("enableAll.accesskey"));
      enableAll.setAttribute("tooltiptext", l10n("enableAll.tooltip"));
      listen(window, enableAll, "command", function() {
        for (let i = 0; i < styleSheetList.length; i++) {
          if (styleSheetList[i][0] == 'enabled')
            continue;
          styleSheetList[i][0] = 'enabled';
          loadStyleSheet(i);
        }
        writeJSONPref();
      });
      menupop.appendChild(enableAll);
    }
    let (disableAll = window.document.createElementNS(XUL, "menuitem")) {
      disableAll.setAttribute("label", l10n("disableAll.label"));
      disableAll.setAttribute("accesskey", l10n("disableAll.accesskey"));
      disableAll.setAttribute("tooltiptext", l10n("disableAll.tooltip"));
      listen(window, disableAll, "command", function() {
        for (let i = 0; i < styleSheetList.length; i++) {
          if (styleSheetList[i][0] == 'disabled')
            continue;
          unloadStyleSheet(i);
          styleSheetList[i][0] = 'disabled';
        }
        writeJSONPref();
      });
      menupop.appendChild(disableAll);
    }
    let (sep = window.document.createElementNS(XUL, "menuseparator")) {
      menupop.appendChild(sep);
    }
    styleSheetList.forEach(function(style, index) {
      let item = window.document.createElementNS(XUL, "menuitem");
      item.setAttribute("label", unescape(style[1]));
      item.setAttribute("type", "checkbox");
      if (style[0] == 'enabled')
        item.setAttribute("checked", true);
      if (item.hasAttribute("checked"))
        item.setAttribute("tooltiptext", l10n("styleSheet.disable.text"))
      else
        item.setAttribute("tooltiptext", l10n("styleSheet.enable.text"))
      listen(window, item, "mousedown", function(event) {
        event.preventDefault();
        event.stopPropagation();
        toggleStyleSheet(index, !item.hasAttribute("checked")?'disabled':'enabled',
          !item.hasAttribute("checked")?'enabled':'disabled');
        if (item.hasAttribute("checked") && item.getAttribute("checked")) {
          item.setAttribute("tooltiptext", l10n("styleSheet.disable.text"))
        }
        else {
          item.setAttribute("tooltiptext", l10n("styleSheet.enable.text"))
        }
      });
      menupop.appendChild(item);
    });
  }
}

function addMenuItem(window) {
  function $(id) window.document.getElementById(id);
 
  function removeMenuItem() {
    let menuitem = $(toolsMenuitemID);
    menuitem && menuitem.parentNode.removeChild(menuitem);
    let appitem = $(appMenuitemID);
    appitem && appitem.parentNode.removeChild(appitem);
  }
  removeMenuItem();
  if (pref("createToolsMenuButton")) {
    // add the new menuitem to File menu
    let (menu = window.document.createElementNS(XUL, "menu")) {
      menu.setAttribute("id", toolsMenuitemID);
      menu.setAttribute("class", "menu-iconic");
      if (pref("createHotKey"))
        menu.setAttribute("key", keyID);
      menu.setAttribute("label", l10n("userStyles.label"));
      menu.setAttribute("accesskey", l10n("userStyles.accesskey"));
      menu.setAttribute("image", LOGO);
      let menupop = window.document.createElementNS(XUL, "menupopup");
      menupop.setAttribute("id", toolsMenuitemID + "Popup");
      menupop.setAttribute("class", "popup-internal-box");
      menu.appendChild(menupop);
      $("menu_ToolsPopup").insertBefore(menu, $("menu_pageInfo"));
      listen(window, menupop, "popupshowing", function(event) {
        populateMenuPopupList(window, toolsMenuitemID + "Popup", event);
      });
    }
  }
  if (pref("createAppMenuButton")) {
    if (window.navigator.oscpu.search(/^mac/i) == 0)
      return;
    let appMenu = $("appmenuPrimaryPane");
    if (appMenu) {
      let (appMenuItem = window.document.createElementNS(XUL, "menu")) {
        appMenuItem.setAttribute("id", appMenuitemID);
        appMenuItem.setAttribute("class", "menu-iconic");
        appMenuItem.setAttribute("image", LOGO);
        appMenuItem.setAttribute("label", l10n("userStyles.label"))
        if (pref("createHotKey"))
          appMenuItem.setAttribute("key", keyID);
        appMenuItem.setAttribute("accesskey", l10n("userStyles.accesskey"));
        let menupop = window.document.createElementNS(XUL, "menupopup");
        menupop.setAttribute("id", appMenuitemID + "Popup");
        appMenuItem.appendChild(menupop);
        appMenu.insertBefore(appMenuItem, $("appmenu_webDeveloper").nextSibling);
        listen(window, menupop, "popupshowing", function(event) {
          populateMenuPopupList(window, appMenuitemID + "Popup", event);
        });
      }
    }
  }
  if (pref("createAppMenuButton") || pref("createToolsMenuButton"))
    unload(removeMenuItem, window);
}

function addToolbarButton(window) {
  function $(id) window.document.getElementById(id);
  function removeButton() {
    try {
      toolbarButton.parentNode.removeChild(toolbarButton);
    } catch (ex) {}
  }

  if (!pref("createToolbarButton")) {
    try {
      toolbarButton.parentNode.removeChild(toolbarButton);
    } catch (ex) {}
    return;
  }
  function saveToolbarButtonInfo(event) {
    if ($(toolbarButtonID) && toolbarButton.parentNode) {
      pref("buttonParentID", toolbarButton.parentNode.getAttribute("id") || "");
      pref("buttonNextSiblingID", (toolbarButton.nextSibling || "")
        && toolbarButton.nextSibling.getAttribute("id").replace(/^wrapper-/i, ""));
    }
    else
      pref("buttonParentID", "");
  }

  // add toolbar button
  toolbarButton = window.document.createElementNS(XUL, "toolbarbutton");
  toolbarButton.setAttribute("id", toolbarButtonID);
  toolbarButton.setAttribute("type", "button");
  toolbarButton.setAttribute("image", LOGO);
  toolbarButton.setAttribute("label", l10n("USM.label"));
  toolbarButton.setAttribute("tooltiptext", l10n("USM.tooltip"));
  toolbarButton.setAttribute("type", "menu");
  listen(window, toolbarButton, "click", function(event) {
    if (event.target.id == toolbarButtonID && event.button == 1)
      openOptions(window);
  });
  let toolbarButtonMenupop = window.document.createElementNS(XUL, "menupopup");
  toolbarButtonMenupop.setAttribute("id", toolbarButtonID + "Popup");
  toolbarButton.appendChild(toolbarButtonMenupop);
  $("navigator-toolbox").palette.appendChild(toolbarButton);
  let buttonParentID = pref("buttonParentID");
  if (buttonParentID.length > 0) {
    let parent = $(buttonParentID);
    if (parent) {
      let nextSiblingID = pref("buttonNextSiblingID");
      let nextSibling = $(nextSiblingID);
      if (!nextSibling) {
        let currentset = parent.getAttribute("currentset").split(",");
        let i = currentset.indexOf(toolbarButtonID) + 1;
        if (i > 0) {
          let len = currentset.length;
          for (; i < len; i++) {
            nextSibling = $(currentset[i]);
            if (nextSibling)
              break;
          }
        }
      }
      parent.insertItem(toolbarButtonID, nextSibling, null, false);
    }
  }
  listen(window, window, "aftercustomization", saveToolbarButtonInfo);
  listen(window, toolbarButtonMenupop, "popupshowing", function(event) {
    populateMenuPopupList(window, toolbarButtonID + "Popup", event);
  });
  unload(removeButton, window);
}

function createHotKey(window) {
  function $(id) window.document.getElementById(id);
  function removeKey() {
    let keyset = $(keysetID);
    keyset && keyset.parentNode.removeChild(keyset);
    if (pref("createAppMenuButton"))
      $(appMenuitemID) && $(appMenuitemID).removeAttribute("key");
    if (pref("createToolsMenuButton"))
      $(toolsMenuitemID) && $(toolsMenuitemID).removeAttribute("key");
  }

  removeKey();
  if (pref("createHotKey")) {
    let USMKeyset = window.document.createElementNS(XUL, "keyset");
    USMKeyset.setAttribute("id", keysetID);
    // add hotkey
    let (optionsKey = window.document.createElementNS(XUL, "key")) {
      optionsKey.setAttribute("id", keyID);
      optionsKey.setAttribute("key", pref("shortcutKey"));
      optionsKey.setAttribute("modifiers", pref("shortcutModifiers"));
      optionsKey.setAttribute("oncommand", "void(0);");
      listen(window, optionsKey, "command", function() openOptions(window));
      $("mainKeyset").parentNode.appendChild(USMKeyset).appendChild(optionsKey);
      if (pref("createAppMenuButton"))
        $(appMenuitemID).setAttribute("key", keyID);
      if (pref("createToolsMenuButton"))
        $(toolsMenuitemID).setAttribute("key", keyID);
      unload(removeKey, window);
    }
  }
  else {
    if (pref("createAppMenuButton"))
      $(appMenuitemID).removeAttribute("key");
    if (pref("createToolsMenuButton"))
      $(toolsMenuitemID).removeAttribute("key");
  }
}

function openOptions(window) {
  window.open("chrome://userstylemanager/content/options.xul",
    "User Style Manager Options","chrome,resizable,centerscreen");
}

function disable(id) {
  AddonManager.getAddonByID(id, function(addon) {
    addon.userDisabled = true;
  });
}

function startup(data, reason) AddonManager.getAddonByID(data.id, function(addon) {
  gAddon = addon;
  // Load various javascript includes for helper functions
  ["helper", "pref", "main"].forEach(function(fileName) {
    let fileURI = addon.getResourceURI("scripts/" + fileName + ".js");
    Services.scriptloader.loadSubScript(fileURI.spec, global);
  });
  if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
    Components.manager.addBootstrappedManifestLocation(data.installPath);
  function initiate() {
    styleSheetList = [];
    // Reading the JSON variable containing paths to style sheets
    readJSONPref(function() {
      updateSortedList();
      if (updateStyleSheetList())
        // Load the style sheets as they have not been loaded by addDefaultStyles
        loadStyleSheet();
      unload(unloadStyleSheet);
      watchWindows(createHotKey);
      watchWindows(addMenuItem);
      watchWindows(addToolbarButton);
      pref("firstRun", false);
    });

    watchWindows(handleCustomization);
    watchWindows(addContextMenuEntry);
    pref.observe(["createAppMenuButton", "createToolsMenuButton"], function() {
      watchWindows(addMenuItem);
    });
    pref.observe(["createHotKey", "shortcutKey", "shortcutModifiers"], function() {
      watchWindows(createHotKey);
    });
    pref.observe(["createToolbarButton"], function() {
      watchWindows(addToolbarButton);
    });
    pref.observe(["createContextMenuEntry"], function() {
      watchWindows(addContextMenuEntry);
    });
    // observer to track and keep in sync any changes in styleSheetList
    pref.observe(["userStyleList"], function() {
      styleSheetList = JSON.parse(pref("userStyleList"));
      updateSortedList();
    });
    // Adding an unload funtion to close any opened options window
    unload(function() {
      let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
      let enumerator = wm.getEnumerator(null);
      while (enumerator.hasMoreElements()) {
        let win = enumerator.getNext();
        if (win.name.search("User Style Manager Options") == 0 || win.name.search("User Style Manager - Editor") == 0
          || win.name.search("More Information - User Style Manager") == 0)
            win.close();
      }
    });
  }

  reload = function() {
    unloadStyleSheet();
    loadStyleSheet();
  };
  if (data.version*1 == 0.7 && (reason == 7 || reason == 5))
    updateAffectedInfo = true;
  initiate();
});

function shutdown(data, reason) {
  if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
    Components.manager.removeBootstrappedManifestLocation(data.installPath);
  if (reason != APP_SHUTDOWN)
    unload();
}

function install() {}

function uninstall() {}
