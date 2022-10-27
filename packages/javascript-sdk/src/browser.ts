import { getLogger } from './log';
import { HyperengageClient, HyperengageFunction, HyperengageOptions } from './interface';
import { hyperengageClient } from './hyperengage';

const jsFileName = "lib.js"
//Make sure that all properties form HyperengageOptions are listed here
const hyperengageProps = [
  'use_beacon_api', 'cookie_domain', 'tracking_host', 'cookie_name',
  'key', 'workspace_key', 'ga_hook', 'segment_hook', 'randomize_url', 'capture_3rd_party_cookies',
  'id_method', 'log_level', 'compat_mode','privacy_policy', 'cookie_policy', 'ip_policy', 'custom_headers',
  'force_use_fetch', 'min_send_timeout', 'max_send_timeout', 'max_send_attempts', 'disable_event_persistence',
];


function getTrackingHost(scriptSrc: string): string {
  return scriptSrc.replace("/s/" + jsFileName, "").replace("/" + jsFileName, "");
}

const supressInterceptionWarnings = "data-suppress-interception-warning";

function hookWarnMsg(hookType: string) {
  return `
      ATTENTION! ${hookType}-hook set to true along with defer/async attribute! If ${hookType} code is inserted right after Hyperengage tag,
      first tracking call might not be intercepted! Consider one of the following:
       - Inject hyperengage tracking code without defer/async attribute
       - If you're sure that events won't be sent to ${hookType} before Hyperengage is fully initialized, set ${supressInterceptionWarnings}="true"
       script attribute
    `;
}

function getTracker(window): HyperengageClient {

  let script = document.currentScript
    || document.querySelector('script[src*=jsFileName][data-key][data-workspace-key]');

  if (!script) {
    getLogger().warn("Hyperengage script is not properly initialized. The definition must contain data-hyperengage-api-key and data-hyperengage-workspace-key as a parameter")
    return undefined;
  }
  let opts: HyperengageOptions = {
    tracking_host: getTrackingHost(script.getAttribute('src')),
    workspace_key: null,
    key: null
  };

  hyperengageProps.forEach(prop => {
    let attr = "data-" + prop.replace(new RegExp("_", "g"), "-");
    if (script.getAttribute(attr) !== undefined && script.getAttribute(attr) !== null) {
      let val: any = script.getAttribute(attr);
      if ("true" === val) {
        val = true;
      } else if ("false" === val) {
        val = false;
      }
      opts[prop] = val;
    }
  })
  window.hyperengageClient = hyperengageClient(opts)
  if (opts.segment_hook && (script.getAttribute('defer') !== null || script.getAttribute('async') !== null) && script.getAttribute(supressInterceptionWarnings) === null) {
    getLogger().warn(hookWarnMsg("segment"))
  }
  if (opts.ga_hook && (script.getAttribute('defer') !== null || script.getAttribute('async') !== null) && script.getAttribute(supressInterceptionWarnings) === null) {
    getLogger().warn(hookWarnMsg("ga"))
  }

  const hyperengage: HyperengageFunction = function() {
    let queue = window.hyperengageQ = window.hyperengageQ || [];
    queue.push(arguments)
    processQueue(queue, window.hyperengageClient);
  }
  window.hyperengage = hyperengage;

  if ("true" !== script.getAttribute("data-init-only") && "yes" !== script.getAttribute("data-init-only")) {
    hyperengage('track', 'pageview');
  }
  return window.hyperengageClient;
}

function processQueue(queue: any[], hyperengageInstance: HyperengageClient) {
  getLogger().debug("Processing queue", queue);
  for (let i = 0; i < queue.length; i += 1) {
    const [methodName, ...args] = ([...queue[i]] || []);
    const method = (hyperengageInstance as any)[methodName];
    if (typeof method === 'function') {
      method.apply(hyperengageInstance, args);
    }
  }
  queue.length = 0;
}

if (window) {
  let win = window as any;
  let tracker = getTracker(win);
  if (tracker) {
    getLogger().debug("Hyperengage in-browser tracker has been initialized")
    win.hyperengage = function() {
      let queue = win.hyperengageQ = win.hyperengageQ || [];
      queue.push(arguments)
      processQueue(queue, tracker);
    }
    if (win.hyperengageQ) {
      getLogger().debug(`Initial queue size of ${win.hyperengageQ.length} will be processed`);
      processQueue(win.hyperengageQ, tracker);
    }
  } else {
    getLogger().error("Hyperengage tracker has not been initialized (reason unknown)")
  }
} else {
  getLogger().warn("Hyperengage tracker called outside browser context. It will be ignored")
}


