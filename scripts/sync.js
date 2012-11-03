Cu.import("resource://services-sync/engines.js");
Cu.import("resource://services-sync/record.js");
Cu.import("resource://services-sync/util.js");
Cu.import("resource://services-sync/main.js");
Cu.import("resource://services-sync/constants.js");
Cu.import("chrome://userstylemanager-scripts/content/shared.jsm");

let trackerInstance = null;

function UserStyleRecord(collection, id) {
  CryptoWrapper.call(this, collection, id);
}

UserStyleRecord.prototype = {
  __proto__: CryptoWrapper.prototype,
};

Utils.deferGetSet(UserStyleRecord, "cleartext", ["id", "json", "code"]);

function UserStylesStore(name, engine) {
  Store.call(this, name, engine);
}

UserStylesStore.prototype = {
  __proto__: Store.prototype,

  get reconciler() {
    return this.engine._reconciler;
  },

  itemExists: function (id) {
    try {
      return mappedIndexForGUIDs[id] != null && mappedIndexForGUIDs[id] > -1;
    } catch(ex) {
      return false;
    }
  },

  createRecord: function(id, collection) {
    let record = new UserStyleRecord(collection, id);
    let index;
    try {
      index = mappedIndexForGUIDs[id];
    }
    catch (ex) {
      record.deleted = true;
      return record;
    }
    if (index == null || index == undefined || index < 0) {
      record.deleted = true;
      return record;
    }
    record.json = JSON.stringify(styleSheetList[index]);
    record.id = id;
    record.code = JSON.stringify(mappedCodeForIndex[index]);
    return record;
  },

  changeItemID: function(oldId, newId) {
    let index = mappedIndexForGUIDs[oldId];
    if (index != null && index > -1) {
      delete mappedIndexForGUIDs[oldId];
      mappedIndexForGUIDs[newId] = index;
      styleSheetList[index][9] = newId;
      writeJSONPref();
    }
  },

  getAllIDs: function() {
    let guids = {};
    mappedIndexForGUIDs = {};
    for (let index = 0; index < styleSheetList.length; index++) {
      if (styleSheetList[index][9] == null) {
        styleSheetList[index][9] = Utils.makeGUID();
        writeJSONPref();
      }
      guids[styleSheetList[index][9]] = true;
      mappedIndexForGUIDs[styleSheetList[index][9]] = index;
    }
    return guids;
  },

  wipe: function() {
    for (let guid in mappedIndexForGUIDs) {
      this.remove({id: guid});
    }
  },

  create: function(record) {
    this.update(record, true);
  },

  update: function(record, createNew) {
    let index = mappedIndexForGUIDs[record.id];
    if (createNew) {
      index = styleSheetList.length;
      if (JSON.parse(record.json)[9] == null) {
        let guid = Utils.makeGUID();
        let tempArray = JSON.parse(record.json);
        tempArray[9] = guid;
        record.json = JSON.stringify(tempArray);
        mappedIndexForGUIDs[guid] = index;
      }
      else {
        let guid = JSON.parse(record.json)[9];
        mappedIndexForGUIDs[guid] = index;
      }
    }
    if (index != null && index > -1) {
      updateStyleFromSync(index, record.json, JSON.parse(record.code));
    }
  },

  remove: function(record) {
    let index = mappedIndexForGUIDs[record.id];
    if (index != null && index > -1) {
      if (pref("keepDeletedOnSync")) {
        delete mappedIndexForGUIDs[record.id];
        styleSheetList[index][9] = Utils.makeGUID();
        mappedIndexForGUIDs[styleSheetList[index][9]] = index;
        writeJSONPref();
        return;
      }
      deleteStylesFromUSM([index]);
    }
  }
};

function UserStylesTracker(name, engine) {
  Tracker.call(this, name, engine);
  Services.obs.addObserver(this, "USM:codeMappings:deleted", false);
  Services.obs.addObserver(this, "USM:codeMappings:updated", false);
  trackerInstance = this;
}

UserStylesTracker.prototype = {
  __proto__: Tracker.prototype,

  _enabled: true,
  observe: function observe(subject, topic, data) {
    data = JSON.parse(data);
    switch (topic) {

      case "USM:codeMappings:deleted":
        for each (let guid in data) {
          this._add(guid);
        }
        mappedIndexForGUIDs = {};
        for (let index = 0; index < styleSheetList.length; index++) {
          if (styleSheetList[index][9] == null) {
            styleSheetList[index][9] = Utils.makeGUID();
            writeJSONPref();
          }
          mappedIndexForGUIDs[styleSheetList[index][9]] = index;
        }
        break;

      case "USM:codeMappings:updated":
        data = data*1;
        let guid = styleSheetList[data][9];
        if (guid == null || guid == undefined) {
          guid = Utils.makeGUID();
          styleSheetList[data][9] = guid;
          mappedIndexForGUIDs[guid] = data;
          writeJSONPref(function() {
            this._add(guid);
          }.bind(this));
        }
        else {
          this._add(guid);
        }
        break;
    }
  },

  _add: function(guid) {
    if (this.addChangedID(guid) && pref("syncImmediately")) {
      this.score += SCORE_INCREMENT_XLARGE;
    }
  },

  destroy: function() {
    Services.obs.removeObserver(this, "USM:codeMappings:deleted", false);
    Services.obs.removeObserver(this, "USM:codeMappings:updated", false);
    trackerInstance = null;
  }
};

function UserStylesSyncEngine(service) {
  SyncEngine.call(this, "UserStyles", service);
  this.enabled = true;
  this.Name = l10n("userStyles.label");
  if (this.lastSync == null ||
      this.lastSync == undefined ||
      this.lastSync <= 0) {
    // First Time sync
    let buttons = [{
      label: l10n("mergeSyncServer.label"),
      accessKey: l10n("mergeSyncServer.accesskey")
    }, {
      label: l10n("wipeServerData.label"),
      accessKey: l10n("wipeServerData.accesskey")
    }, {
      label: l10n("wipeLocalDate.label"),
      accessKey: l10n("wipeLocalDate.accesskey")
    }, {
      label: l10n("disableSync.label"),
      accessKey: l10n("disableSync.accessKey")
    }];
    showNotification(l10n("firstSync.label"), l10n("firstSync.title"),
                     buttons, this.onFirstTimeChoiceSelect.bind(this));
  }
}

UserStylesSyncEngine.prototype = {
  __proto__: SyncEngine.prototype,
  _recordObj: UserStyleRecord,
  _storeObj: UserStylesStore,
  _trackerObj: UserStylesTracker,

  prefName: "userStyles",

  get trackerInstance() trackerInstance,

  onFirstTimeChoiceSelect: function(aChoice) {
    let wasLocked = this.service.locked;
    let eng = this;
    let syncAction = null;
    try {
      if (!wasLocked) {
        this.service.lock();
      }
      switch(aChoice) {
        case 1:
          syncAction = function() {
            eng.service.resetClient([eng.name]);
            eng.service.wipeServer([eng.name]);
            eng.service.Clients.sendCommand("wipeEngine", [eng.name]);
          };
          break;

        case 2:
          syncAction = function() {
            eng.service.wipeClient([eng.name]);
          };
          break;

        case 3:
          syncAction = function() {
            eng.enabled = false;
            removeSyncEngine();
            pref("syncStyles", false);
          };
          break;

        default:
          syncAction = function() {
            eng.service.resetClient([eng.name])
          };
          break;
      }
    } catch(ex) {
    } finally {
      if (!wasLocked) {
        this.service.unlock();
      }
    }
    if (syncAction) {
      try { 
        if (eng.trackerInstance) {
          eng.trackerInstance.score += Weave.SCORE_INCREMENT_XLARGE;
        }
        syncAction();
 
      } catch (exc) {
      }
    }
  },

  destroy: function () {
    if (this.trackerInstance) {
      this.trackerInstance.destroy();
    }
  },
};
