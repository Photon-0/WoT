(function () {
    "use strict";

    var bookmarkKey = "wot-reader-bookmark-v1";
    var pendingKey = "wot-reader-bookmark-pending-v1";
    var cloudEndpointKey = "wot-reader-bookmark-endpoint-v1";
    var collapseTimer;
    var keyboardNavigation = false;
    var bookmark;
    var cloudRequestId = 0;

    function scheduleCollapse(delay) {
        window.clearTimeout(collapseTimer);
        collapseTimer = window.setTimeout(function () {
            if (keyboardNavigation && controls.contains(document.activeElement)) {
                return;
            }
            controls.classList.add("is-collapsed");
            toggleButton.setAttribute("aria-expanded", "false");
            toggleButton.textContent = "Bookmarks";
            toggleButton.setAttribute("aria-label", "Show bookmarks");
        }, delay);
    }

    function expandControls() {
        window.clearTimeout(collapseTimer);
        controls.classList.remove("is-collapsed");
        toggleButton.setAttribute("aria-expanded", "true");
        toggleButton.textContent = "Hide bookmarks";
        toggleButton.setAttribute("aria-label", "Hide bookmarks");
        scheduleCollapse(4500);
    }

    function getBookmark() {
        var value = localStorage.getItem(bookmarkKey);
        if (!value) {
            return null;
        }

        return validateBookmark(JSON.parse(value));
    }

    function validateBookmark(saved) {
        var hasPercentage = saved && typeof saved.scrollPercent === "number" &&
            Number.isFinite(saved.scrollPercent) && saved.scrollPercent >= 0 &&
            saved.scrollPercent <= 100;
        var hasLegacyOffset = saved && typeof saved.scrollY === "number" &&
            Number.isFinite(saved.scrollY) && saved.scrollY >= 0;
        if (!saved || typeof saved.url !== "string" ||
            (!hasPercentage && !hasLegacyOffset) || typeof saved.label !== "string") {
            throw new Error("The saved bookmark has invalid data.");
        }
        return saved;
    }

    function setStatus(message) {
        status.textContent = message;
    }

    function describeBookmark(saved) {
        if (typeof saved.scrollPercent === "number") {
            return saved.label + " at " + saved.scrollPercent.toFixed(1) + "%";
        }
        return saved.label + " at " + Math.round(saved.scrollY) + " px";
    }

    function getScrollPercent() {
        var documentHeight = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
        );
        var maxScroll = Math.max(0, documentHeight - window.innerHeight);
        return maxScroll === 0 ? 0 : window.scrollY / maxScroll * 100;
    }

    function getScrollPosition(saved) {
        if (typeof saved.scrollPercent === "number") {
            var documentHeight = Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight
            );
            var maxScroll = Math.max(0, documentHeight - window.innerHeight);
            return maxScroll * saved.scrollPercent / 100;
        }
        return saved.scrollY;
    }

    function setBookmark(saved) {
        bookmark = saved ? validateBookmark(saved) : null;
        resumeButton.disabled = !bookmark;
        if (bookmark) {
            localStorage.setItem(bookmarkKey, JSON.stringify(bookmark));
        }
    }

    function getCloudEndpoint() {
        var endpoint = localStorage.getItem(cloudEndpointKey);
        if (endpoint) {
            return endpoint;
        }

        endpoint = window.prompt(
            "Paste your Google Apps Script web app URL to connect this device to the shared bookmark."
        );
        if (endpoint === null || endpoint.trim() === "") {
            return null;
        }

        endpoint = endpoint.trim();
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)) {
            throw new Error("That URL does not look like a Google Apps Script web app URL.");
        }

        localStorage.setItem(cloudEndpointKey, endpoint);
        return endpoint;
    }

    function requestCloud(action, saved, callback) {
        var endpoint = getCloudEndpoint();
        if (!endpoint) {
            callback(null, null);
            return;
        }

        var callbackName = "wotBookmarkResponse" + (++cloudRequestId);
        var script = document.createElement("script");
        var finished = false;
        var timeout = window.setTimeout(function () {
            finish(new Error("Google Drive did not respond. Check the web app URL and deployment access."));
        }, 15000);

        function finish(error, result) {
            if (finished) {
                return;
            }
            finished = true;
            window.clearTimeout(timeout);
            delete window[callbackName];
            script.remove();
            if (error) {
                callback(error);
            } else {
                callback(null, result);
            }
        }

        window[callbackName] = function (result) {
            if (!result || result.ok !== true) {
                finish(new Error(result && result.error ? result.error : "Google Drive returned an invalid response."));
                return;
            }
            finish(null, result);
        };

        script.onerror = function () {
            finish(new Error("Unable to reach the Google Drive bookmark service."));
        };

        var query = new URLSearchParams({
            action: action,
            callback: callbackName,
            cacheBust: String(Date.now())
        });
        if (saved) {
            query.set("bookmark", JSON.stringify(saved));
        }
        script.src = endpoint + "?" + query.toString();
        document.head.appendChild(script);
    }

    function syncBookmarkFromDrive() {
        requestCloud("get", null, function (error, result) {
            if (error) {
                setStatus("Drive bookmark unavailable: " + error.message);
                return;
            }
            if (result.bookmark) {
                try {
                    setBookmark(result.bookmark);
                    setStatus("Drive bookmark: " + describeBookmark(bookmark));
                } catch (storageError) {
                    setStatus("Drive bookmark loaded, but could not be saved on this device: " + storageError.message);
                }
            }
        });
    }

    function restoreAfterLoad(saved) {
        var restore = function () {
            if (window.location.href === saved.url) {
                window.scrollTo(0, getScrollPosition(saved));
            }
        };

        if (document.readyState === "complete") {
            window.requestAnimationFrame(restore);
        } else {
            window.addEventListener("load", function () {
                window.requestAnimationFrame(restore);
            }, { once: true });
        }
    }

    var controls = document.createElement("div");
    controls.className = "bookmark-controls";
    controls.id = "reading-bookmark-controls";

    var toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "bookmark-toggle";
    toggleButton.textContent = "Bookmarks";
    toggleButton.setAttribute("aria-controls", controls.id);
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.setAttribute("aria-label", "Show bookmarks");

    var saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Save bookmark";

    var resumeButton = document.createElement("button");
    resumeButton.type = "button";
    resumeButton.className = "bookmark-resume";
    resumeButton.textContent = "Resume bookmark";
    resumeButton.disabled = true;

    var status = document.createElement("span");
    status.className = "bookmark-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    controls.appendChild(toggleButton);
    controls.appendChild(saveButton);
    controls.appendChild(resumeButton);
    controls.appendChild(status);
    document.body.appendChild(controls);

    toggleButton.addEventListener("click", function () {
        if (controls.classList.contains("is-collapsed")) {
            expandControls();
        } else {
            window.clearTimeout(collapseTimer);
            controls.classList.add("is-collapsed");
            toggleButton.setAttribute("aria-expanded", "false");
            toggleButton.textContent = "Bookmarks";
            toggleButton.setAttribute("aria-label", "Show bookmarks");
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Tab" || event.key.startsWith("Arrow")) {
            keyboardNavigation = true;
        }
    });
    document.addEventListener("pointerdown", function () {
        keyboardNavigation = false;
    });
    controls.addEventListener("focusin", function () {
        if (keyboardNavigation) {
            window.clearTimeout(collapseTimer);
        }
    });
    controls.addEventListener("focusout", function () {
        if (keyboardNavigation) {
            scheduleCollapse(4500);
        }
    });

    if (window.matchMedia("(hover: hover)").matches) {
        controls.addEventListener("pointerenter", function () {
            window.clearTimeout(collapseTimer);
        });
        controls.addEventListener("pointerleave", function () {
            scheduleCollapse(2500);
        });
    }

    window.addEventListener("scroll", function () {
        if (!controls.classList.contains("is-collapsed")) {
            scheduleCollapse(1800);
        }
    }, { passive: true });

    scheduleCollapse(5000);

    try {
        bookmark = getBookmark();
        if (bookmark) {
            resumeButton.disabled = false;
            setStatus("Saved: " + describeBookmark(bookmark));
        } else {
            setStatus("No bookmark saved yet.");
        }
    } catch (error) {
        setStatus("Unable to read bookmark: " + error.message);
    }

    saveButton.addEventListener("click", function () {
        var chapter = document.querySelector("h2");
        var subtitle = document.querySelector("h4");
        var chapterLabel = chapter ? chapter.textContent.trim() : document.title;
        if (subtitle && subtitle.textContent.trim()) {
            chapterLabel += " — " + subtitle.textContent.trim();
        }

        var savedBookmark = {
            url: window.location.href,
            scrollPercent: getScrollPercent(),
            label: document.title + " — " + chapterLabel
        };

        try {
            setBookmark(savedBookmark);
            setStatus("Saved: " + describeBookmark(bookmark));
            expandControls();
        } catch (error) {
            setStatus("Unable to save bookmark on this device: " + error.message);
            return;
        }

        if (window.location.protocol !== "https:") {
            setStatus("Saved on this device. Open the GitHub Pages site to sync with Drive.");
            return;
        }

        try {
            requestCloud("save", bookmark, function (error, result) {
                if (error) {
                    setStatus("Saved on this device; Drive sync failed: " + error.message);
                    return;
                }
                if (result) {
                    setStatus("Saved to Google Drive: " + describeBookmark(bookmark));
                } else {
                    setStatus("Saved on this device. Connect Google Drive to sync across devices.");
                }
            });
        } catch (error) {
            setStatus("Saved on this device; Drive sync failed: " + error.message);
        }
    });

    resumeButton.addEventListener("click", function () {
        function resume(saved) {
            if (!saved) {
                setStatus("No bookmark is saved in Google Drive or on this device.");
                return;
            }

            var savedUrl;
            try {
                savedUrl = new URL(saved.url);
            } catch (error) {
                setStatus("The saved bookmark has an invalid page address.");
                return;
            }
            if (savedUrl.origin !== window.location.origin) {
                setStatus("The saved bookmark belongs to a different website.");
                return;
            }

            if (window.location.href === saved.url) {
                window.scrollTo(0, getScrollPosition(saved));
                setStatus("Resumed: " + describeBookmark(saved));
                expandControls();
                return;
            }

            try {
                sessionStorage.setItem(pendingKey, JSON.stringify(saved));
                window.location.href = saved.url;
            } catch (error) {
                setStatus("Unable to resume bookmark: " + error.message);
            }
        }

        var endpoint;
        try {
            endpoint = window.location.protocol === "https:" ? getCloudEndpoint() : null;
        } catch (error) {
            setStatus("Unable to connect to Google Drive: " + error.message);
            return;
        }

        if (endpoint) {
            requestCloud("get", null, function (error, result) {
                if (error) {
                    setStatus("Drive bookmark unavailable: " + error.message);
                    resume(bookmark);
                    return;
                }
                if (result.bookmark) {
                    try {
                        setBookmark(result.bookmark);
                    } catch (storageError) {
                        setStatus("Drive bookmark loaded, but could not be saved on this device: " + storageError.message);
                    }
                }
                resume(result.bookmark || bookmark);
            });
            return;
        }

        resume(bookmark);
    });

    try {
        var pendingValue = sessionStorage.getItem(pendingKey);
        if (pendingValue) {
            sessionStorage.removeItem(pendingKey);
            var pendingBookmark = JSON.parse(pendingValue);
            if (pendingBookmark && pendingBookmark.url === window.location.href &&
                (typeof pendingBookmark.scrollPercent === "number" ||
                    (typeof pendingBookmark.scrollY === "number" &&
                        Number.isFinite(pendingBookmark.scrollY) && pendingBookmark.scrollY >= 0))) {
                validateBookmark(pendingBookmark);
                restoreAfterLoad(pendingBookmark);
                setStatus("Resumed: " + describeBookmark(pendingBookmark));
                expandControls();
            }
        }
    } catch (error) {
        setStatus("Unable to resume bookmark: " + error.message);
    }

    if (window.location.protocol === "https:" && localStorage.getItem(cloudEndpointKey)) {
        syncBookmarkFromDrive();
    }
}());
