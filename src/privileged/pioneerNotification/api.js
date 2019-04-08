"use strict";

/* global ExtensionAPI */

ChromeUtils.import("resource://gre/modules/Console.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

/* eslint-disable no-undef */
const { EventManager } = ExtensionCommon;
const EventEmitter =
  ExtensionCommon.EventEmitter || ExtensionUtils.EventEmitter;

// eslint-disable-next-line no-undef
XPCOMUtils.defineLazyModuleGetter(
  this,
  "BrowserWindowTracker",
  "resource:///modules/BrowserWindowTracker.jsm",
);

/**
 * @returns {Object} The most recent NON-PRIVATE browser window, so that we can manipulate chrome elements on it.
 */
function getMostRecentBrowserWindow() {
  return BrowserWindowTracker.getTopWindow({
    private: false,
    allowPopups: false,
  });
}

/*
const { utils: Cu } = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Timer.jsm");
XPCOMUtils.defineLazyModuleGetter(
  this,
  "studyUtils",
  "resource://pioneer-participation-prompt/StudyUtils.jsm",
);
XPCOMUtils.defineLazyModuleGetter(
  this,
  "config",
  "resource://pioneer-participation-prompt/Config.jsm",
);
XPCOMUtils.defineLazyModuleGetter(
  this,
  "RecentWindow",
  "resource:///modules/RecentWindow.jsm",
);
XPCOMUtils.defineLazyModuleGetter(
  this,
  "AboutPages",
  "resource://pioneer-participation-prompt-content/AboutPages.jsm",
);
XPCOMUtils.defineLazyModuleGetter(
  this,
  "AddonManager",
  "resource://gre/modules/AddonManager.jsm",
);
XPCOMUtils.defineLazyServiceGetter(
  this,
  "timerManager",
  "@mozilla.org/updates/timer-manager;1",
  "nsIUpdateTimerManager",
);

const EXPIRATION_DATE_STRING_PREF =
  "extensions.pioneer-participation-prompt_shield_mozilla_org.expirationDateString";
const ENROLLMENT_STATE_STRING_PREF =
  "extensions.pioneer-participation-prompt_shield_mozilla_org.enrollmentState";
const TIMER_NAME = "pioneer-participation-prompt-prompt";

let notificationBox = null;
let notice = null;

function removeActiveNotification() {
  if (notice && notificationBox) {
    try {
      notificationBox.removeNotification(notice);
    } catch (err) {
      // The dom nodes are probably gone. That's fine.
    }
  }
}

function showNotification(doc, onClickButton) {
  removeActiveNotification();

  notificationBox = doc.querySelector("#high-priority-global-notificationbox");
  notice = notificationBox.appendNotification(
    config.notificationMessage,
    "pioneer-participation-prompt-1",
    "resource://pioneer-participation-prompt/skin/heartbeat-icon.svg",
    notificationBox.PRIORITY_INFO_HIGH,
    [
      {
        label: "Tell me more",
        callback: onClickButton,
      },
    ],
    eventType => {
      if (eventType === "removed") {
        // Send ping about removing the study?
      }
    },
  );

  // Minimal attempts to style the notification like Heartbeat
  notice.style.background =
    "linear-gradient(-179deg, #FBFBFB 0%, #EBEBEB 100%)";
  notice.style.borderBottom = "1px solid #C1C1C1";
  notice.style.height = "40px";
  const messageText = doc.getAnonymousElementByAttribute(
    notice,
    "anonid",
    "messageText",
  );
  messageText.style.color = "#333";

  // Position the button next to the text like in Heartbeat
  const rightSpacer = doc.createElement("spacer");
  rightSpacer.flex = 20;
  notice.appendChild(rightSpacer);
  messageText.flex = 0;
  messageText.nextSibling.flex = 0;
}

function getMostRecentBrowserWindow() {
  return RecentWindow.getMostRecentBrowserWindow({
    private: false,
    allowPopups: false,
  });
}

function getEnrollmentState() {
  try {
    return JSON.parse(
      Services.prefs.getCharPref(ENROLLMENT_STATE_STRING_PREF, ""),
    );
  } catch (err) {
    return null;
  }
}

function setEnrollmentState(state) {
  Services.prefs.setCharPref(
    ENROLLMENT_STATE_STRING_PREF,
    JSON.stringify(state),
  );
}

let firstPromptTimeout = null;
function showFirstPrompt(actionCallback) {
  if (!firstPromptTimeout) {
    firstPromptTimeout = setTimeout(() => {
      actionCallback("first-prompt");
      setEnrollmentState({
        stage: "first-prompt",
        time: Date.now(),
      });
    }, config.firstPromptDelay);
  }
}
function initializeTreatment(actionCallback) {
  const enrollmentState = getEnrollmentState();
  if (!enrollmentState) {
    showFirstPrompt(actionCallback);
  }

  timerManager.registerTimer(
    TIMER_NAME,
    () => {
      const state = getEnrollmentState();
      if (!state) {
        showFirstPrompt(actionCallback);
      } else if (state.stage === "first-prompt") {
        if (Date.now() - state.time >= config.secondPromptDelay) {
          actionCallback("second-prompt");
          setEnrollmentState({
            stage: "second-prompt",
            time: Date.now(),
          });
        }
      } else if (state.stage === "second-prompt") {
        if (Date.now() - state.time >= config.studyEndDelay) {
          studyUtils.endStudy({ reason: "no-enroll" });
        }
      } else if (state.stage === "enrolled") {
        if (Date.now() - state.time >= config.studyEnrolledEndDelay) {
          studyUtils.endStudy({ reason: "enrolled" });
        }
      } else {
        Cu.reportError(
          `Unknown stage for Pioneer Enrollment: ${
            state.stage
          }. Exiting study.`,
        );
        studyUtils.endStudy({ reason: "error" });
      }
    },
    config.updateTimerInterval,
  );
}

const TREATMENTS = {
  notificationAndPopunder() {
    initializeTreatment(promptType => {
      const recentWindow = getMostRecentBrowserWindow();
      if (recentWindow && recentWindow.gBrowser) {
        const tab = recentWindow.gBrowser.loadOneTab("about:pioneer", {
          inBackground: true,
        });
        tab.addEventListener("TabClose", () => {
          removeActiveNotification();
        });

        showNotification(recentWindow.document, () => {
          recentWindow.gBrowser.selectedTab = tab;
          studyUtils.telemetry({ event: "engagedPrompt" });
        });
        studyUtils.telemetry({ event: "prompted", promptType });
      }
    });
  },
};

const addonListener = {
  onInstalled(addon) {
    if (addon.id === "pioneer-opt-in@mozilla.org") {
      studyUtils.telemetry({ event: "enrolled" });
      setEnrollmentState({
        stage: "enrolled",
        time: Date.now(),
      });
    }
  },
};

this.startup = async function(data, reason) {
  studyUtils.setup({
    ...config,
    addon: { id: data.id, version: data.version },
  });

  // Register add-on listener
  AddonManager.addAddonListener(addonListener);

  // Run treatment
  TREATMENTS[variation.name]();
};

this.shutdown = async function(data, reason) {
  const isUninstall =
    reason === REASONS.ADDON_UNINSTALL || reason === REASONS.ADDON_DISABLE;
  if (isUninstall) {
    // Send this before the ShuttingDown event to ensure that message handlers
    // are still registered and receive it.
    Services.mm.broadcastAsyncMessage("Pioneer:Uninstalling");
  }

  // Unegister add-on listener
  AddonManager.removeAddonListener(addonListener);

  // Close up timers
  if (firstPromptTimeout) {
    clearTimeout(firstPromptTimeout);
  }
  timerManager.unregisterTimer(TIMER_NAME);

  // If a notification is up, close it
  removeActiveNotification();

  if (isUninstall) {
    if (!studyUtils._isEnding) {
      // we are the first requestors, must be user action.
      await studyUtils.endStudy({ reason: "user-disable" });
    }
  }

  Cu.unload("resource://pioneer-participation-prompt/StudyUtils.jsm");
  Cu.unload("resource://pioneer-participation-prompt/Config.jsm");
  Cu.unload("resource://pioneer-participation-prompt-content/AboutPages.jsm");
};
*/

/**
 * Display instrumented 'notification bar' explaining the feature to the user
 *
 *   Telemetry Probes:
 *   - {event: introduction-shown}
 *   - {event: introduction-accept}
 *   - {event: introduction-leave-study}
 */
class PioneerNotificationEventEmitter extends EventEmitter {
  emitShow(variationName) {
    const self = this;
    const recentWindow = getMostRecentBrowserWindow();
    const notificationBox = recentWindow.gHighPriorityNotificationBox;

    // api: https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Method/appendNotification
    const notice = notificationBox.appendNotification(
      "Welcome to the new feature! Look for changes!",
      "feature orientation",
      null, // icon
      notificationBox.PRIORITY_INFO_HIGH, // priority
      // buttons
      [
        {
          label: "Thanks!",
          isDefault: true,
          callback: function acceptButton() {
            // eslint-disable-next-line no-console
            console.log("clicked THANKS!");
            self.emit("introduction-accept");
          },
        },
        {
          label: "I do not want this.",
          callback: function leaveStudyButton() {
            // eslint-disable-next-line no-console
            console.log("clicked NO!");
            self.emit("introduction-leave-study");
          },
        },
      ],
      // callback for nb events
      null,
    );

    // used by testing to confirm the bar is set with the correct config
    notice.setAttribute("variation-name", variationName);

    self.emit("introduction-shown");
  }
}

this.pioneerNotification = class extends ExtensionAPI {
  getAPI(context) {
    const pioneerNotificationEventEmitter = new PioneerNotificationEventEmitter();
    return {
      pioneerNotification: {
        show() {
          pioneerNotificationEventEmitter.emitShow();
        },
        onShown: new EventManager(
          context,
          "pioneerNotification.onShown",
          fire => {
            const listener = value => {
              fire.async(value);
            };
            pioneerNotificationEventEmitter.on("introduction-shown", listener);
            return () => {
              pioneerNotificationEventEmitter.off(
                "introduction-shown",
                listener,
              );
            };
          },
        ).api(),
        onNotificationAccept: new EventManager(
          context,
          "notification.onNotificationAccept",
          fire => {
            const listener = value => {
              fire.async(value);
            };
            notificationEventEmitter.on("introduction-accept", listener);
            return () => {
              notificationEventEmitter.off("introduction-accept", listener);
            };
          },
        ).api(),
        onNotificationLeaveStudy: new EventManager(
          context,
          "notification.onNotificationLeaveStudy",
          fire => {
            const listener = value => {
              fire.async(value);
            };
            notificationEventEmitter.on("introduction-leave-study", listener);
            return () => {
              notificationEventEmitter.off(
                "introduction-leave-study",
                listener,
              );
            };
          },
        ).api(),
      },
    };
  }
};