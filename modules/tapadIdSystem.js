import { uspDataHandler } from '../src/adapterManager.js';
import { submodule } from '../src/hook.js';
import { getStorageManager } from '../src/storageManager.js';
import * as ajax from '../src/ajax.js'
import * as utils from '../src/utils.js';

export const storage = getStorageManager();
const cookiesMaxAge = 7 * 24 * 60 * 60 * 1000; // 60 days
export const defaultExpirationString = new Date(utils.timestamp() + cookiesMaxAge).toString();
export const pastDateString = new Date(0).toString();
export const tapadCookieKey = 'tapad_id';
export const graphUrl = 'https://realtime-graph-access-zxvhwknfeq-uc.a.run.app/v1/graph';

function saveOnAllStorages(key, value, expiration = defaultExpirationString) {
  storage.setCookie(key, typeof value === 'object' ? JSON.stringify(value) : value, expiration);
  storage.setDataInLocalStorage(key, JSON.stringify(value));
}

function deleteFromAllStorages(key) {
  storage.setCookie(key, undefined, pastDateString);
  storage.removeDataFromLocalStorage(key);
}

export const tapadIdSubmodule = {
  name: 'tapadId',
  /**
   * decode the stored id value for passing to bid requests
   * @function
   * @returns {{tapadId: string} | undefined}
   */
  decode(id) {
    return { tapadId: id };
  },
  /*
   * @function
   * @summary initiate Real Time Graph
   * @param {SubmoduleParams} [configParams]
   * @param {ConsentData} [consentData]
   * @returns {IdResponse }}
   */
  getId(config) {
    const uspData = uspDataHandler.getConsentData();
    if (uspData && uspData !== '1---') {
      return { id: undefined };
    }
    const configParams = config.params || {};
    const expiration = config.storage && config.storage.expires
      ? new Date(utils.timestamp() + config.storage.expires * 24 * 60 * 60 * 1000).toString()
      : undefined;

    return {
      callback: (complete) => {
        ajax.ajaxBuilder(10000)(
          `${graphUrl}?company_id=${configParams.companyId}&tapad_id_type=TAPAD_ID`,
          {
            success: (response) => {
              const responseJson = JSON.parse(response);
              if (responseJson.hasOwnProperty('tapadId')) {
                saveOnAllStorages(tapadCookieKey, responseJson.tapadId, expiration)
                complete(responseJson.tapadId)
              }
            },
            error: (_, e) => {
              if (e.status === 404) {
                deleteFromAllStorages(tapadCookieKey);
                complete(undefined);
              }
              if (e.status === 403) {
                utils.logMessage('Invalid Company Id. Contact prebid@tapad.com for assistance.')
              }
            }
          }
        )
      }
    }
  }
}
submodule('userId', tapadIdSubmodule);
