var BOOKMARK_FILE_ID_PROPERTY = "wotBookmarkFileId";
var BOOKMARK_FILE_NAME = "WoT-Reading-Bookmark.json";

function doGet(e) {
  var callback = e && e.parameter ? e.parameter.callback : "";
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput("Invalid callback")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    var action = e.parameter.action || "get";
    var bookmark;
    if (action === "save") {
      bookmark = validateBookmark(JSON.parse(e.parameter.bookmark || ""));
      saveBookmark(bookmark);
    } else if (action === "get") {
      bookmark = loadBookmark();
    } else {
      throw new Error("Unknown bookmark action.");
    }

    return jsonp(callback, { ok: true, bookmark: bookmark });
  } catch (error) {
    return jsonp(callback, { ok: false, error: error.message });
  }
}

function validateBookmark(bookmark) {
  if (!bookmark || typeof bookmark.url !== "string" ||
      typeof bookmark.scrollY !== "number" ||
      !Number.isFinite(bookmark.scrollY) ||
      bookmark.scrollY < 0 || bookmark.scrollY > 100000000 ||
      typeof bookmark.label !== "string" || bookmark.label.length > 300) {
    throw new Error("Bookmark data is invalid.");
  }

  if (!/^https:\/\/[^\/?#\s]+(?:[\/?#][^\s]*)?$/.test(bookmark.url)) {
    throw new Error("Only HTTPS bookmark URLs are accepted.");
  }

  return {
    url: bookmark.url,
    scrollY: bookmark.scrollY,
    label: bookmark.label
  };
}

function loadBookmark() {
  var file = getBookmarkFile();
  if (!file) {
    return null;
  }
  return validateBookmark(JSON.parse(file.getBlob().getDataAsString()));
}

function saveBookmark(bookmark) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var file = getBookmarkFile();
    var contents = JSON.stringify(bookmark);
    if (file) {
      file.setContent(contents);
    } else {
      file = DriveApp.createFile(
        BOOKMARK_FILE_NAME,
        contents,
        MimeType.PLAIN_TEXT
      );
      PropertiesService.getScriptProperties()
        .setProperty(BOOKMARK_FILE_ID_PROPERTY, file.getId());
    }
  } finally {
    lock.releaseLock();
  }
}

function getBookmarkFile() {
  var fileId = PropertiesService.getScriptProperties()
    .getProperty(BOOKMARK_FILE_ID_PROPERTY);
  return fileId ? DriveApp.getFileById(fileId) : null;
}

function jsonp(callback, value) {
  return ContentService.createTextOutput(
    callback + "(" + JSON.stringify(value) + ");"
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
