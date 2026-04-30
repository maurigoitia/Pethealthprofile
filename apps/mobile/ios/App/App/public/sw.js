/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-b6866b34'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-512x512.png",
    "revision": "911e0d0a7a4c95a9ae9168b894c30c60"
  }, {
    "url": "pwa-192x192.png",
    "revision": "5ab1063bc6d10659aeeac7fb81b998d7"
  }, {
    "url": "pessy-logo.svg",
    "revision": "858bd4d3390e3da4b29f13afb2522b3c"
  }, {
    "url": "pessy-logo.png",
    "revision": "82e7b86adda25196b4ac7e5797a14b46"
  }, {
    "url": "pessy-favicon.svg",
    "revision": "ca64de978b36a772b523e6d746efa4bb"
  }, {
    "url": "pessy-favicon-dark.svg",
    "revision": "8491bf58ffe9a6b03788a2e826d692a5"
  }, {
    "url": "og-cover.png",
    "revision": "b386bcaa99353c5d5de5d19ba768187c"
  }, {
    "url": "offline.html",
    "revision": "b5aa1776098e5a952fba33ad0664d153"
  }, {
    "url": "index.html",
    "revision": "f97a4eb475b74c06f9deb67663a86c9f"
  }, {
    "url": "google95347e30e9162e5f.html",
    "revision": "a4f0ac9417e7ba43ea8d22d498f0bc6a"
  }, {
    "url": "firebase-messaging-sw.js",
    "revision": "761005f34a8ffe8ae9417abe37865075"
  }, {
    "url": "data-deletion.html",
    "revision": "9c59931d31131cd9dc8d3dfd3b9c3ab5"
  }, {
    "url": "blog.html",
    "revision": "62626141930a5f1d362d5807fd30337a"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "df5f227d9f644fe467d42d0fe2494e62"
  }, {
    "url": "app.html",
    "revision": "a8e947a7b022280d32c4715b6cd95b30"
  }, {
    "url": "404.html",
    "revision": "22b54cfa1c69f4470a5b60d6c0dc1ed9"
  }, {
    "url": "illustrations/dark_top_surprised_cork_head.svg",
    "revision": "e989a8e2ba76d5f5294f867cd2c516fa"
  }, {
    "url": "blog/vacunas-perros-argentina.html",
    "revision": "1a7f1241af4cf5b461bad9b3665e5411"
  }, {
    "url": "blog/tu-mascota-todo-en-orden.html",
    "revision": "f8b11d7f42adb2de0fff9fc8e8b55f5a"
  }, {
    "url": "blog/svg/pessy-logo-icon.svg",
    "revision": "d5e83c19928eeccd11eba79a85ffa831"
  }, {
    "url": "blog/svg/oval_wellness.svg",
    "revision": "0cef7118614691ff7e1d3b4d2ccca97c"
  }, {
    "url": "blog/svg/oval_vet_visit.svg",
    "revision": "da26101d253bc6eea329c42bfc797f79"
  }, {
    "url": "blog/svg/oval_prescription_meds.svg",
    "revision": "550cfc3524cedfb49484fb1ec3d654a0"
  }, {
    "url": "blog/svg/oval_physical_therapy.svg",
    "revision": "60071f8cfa3f1c590701915fae652196"
  }, {
    "url": "blog/svg/oval_pet_first.svg",
    "revision": "bbb0067d838a0b6f7a897716d716a931"
  }, {
    "url": "blog/svg/oval_customer_success.svg",
    "revision": "4f7f06ba2d524c3763cfc78650c2f670"
  }, {
    "url": "blog/svg/oval_cork_vet_vaccinations.svg",
    "revision": "cc85a2551c1461ec1cc1c0bb6f3a0a4a"
  }, {
    "url": "blog/svg/oval_cork_pet_training.svg",
    "revision": "04fa3b9b24016a5fc785356b28d7de1d"
  }, {
    "url": "blog/svg/oval_cork_pet_food.svg",
    "revision": "ebee65494390295d8cb06b23a44fceb6"
  }, {
    "url": "blog/svg/oval_cork_pet_food (1).svg",
    "revision": "ebee65494390295d8cb06b23a44fceb6"
  }, {
    "url": "blog/svg/oval_cork_boarding.svg",
    "revision": "321333461dff7261a8f6c617fb32e81a"
  }, {
    "url": "blog/svg/lower_coinsurance.svg",
    "revision": "f7dcad58f5d1e575df66b234245058d9"
  }, {
    "url": "blog/svg/fishbowl.svg",
    "revision": "a8dfe089ca1865ae4406c188f128b881"
  }, {
    "url": "blog/svg/deductible.svg",
    "revision": "c407b72d4323ca7514267ccd24810401"
  }, {
    "url": "blog/svg/dark_top_surprised_fizz_head.svg",
    "revision": "252385072ded22f0bec9aefd6cd71b02"
  }, {
    "url": "blog/svg/dark_top_surprised_cork_head.svg",
    "revision": "c53e1363ea3cfdb7f4a825e582bf8ac1"
  }, {
    "url": "blog/svg/cork_treats_bubble_full.svg",
    "revision": "e8ede0f584e1f491db06e9d1af5aa92d"
  }, {
    "url": "blog/svg/cork_paw_card.svg",
    "revision": "e68ebf382d534b085bd7bb400d8d9563"
  }, {
    "url": "blog/svg/cork_fizz_card.svg",
    "revision": "2f8e1b810a8fb4a0eaa7894d0b4b06c9"
  }, {
    "url": "blog/svg/cork_fizz_card (1).svg",
    "revision": "aadb4ff4749c568cf6c5199651b5deee"
  }, {
    "url": "blog/svg/category-tips.svg",
    "revision": "50eab35045cd361e9401df3e99160a6b"
  }, {
    "url": "blog/svg/category-salud.svg",
    "revision": "ac8020c194a2997341fa3c361f5e544c"
  }, {
    "url": "blog/svg/category-rutinas.svg",
    "revision": "86699d92eb5a958eaf135b453b41dfe6"
  }, {
    "url": "blog/svg/category-legal.svg",
    "revision": "50b7cb4f3822d0aff7f63ca755d6a517"
  }, {
    "url": "blog/svg/category-comunidad.svg",
    "revision": "a6c3827e27faee59aa0d08484de42c0c"
  }, {
    "url": "blog/svg/category-compras.svg",
    "revision": "d4da6a3b9f918c03e3f08bcdaa92239d"
  }, {
    "url": "blog/svg/case_and_vet_bill.svg",
    "revision": "de970ae18bdcc2fd0983a3fd1fcc6b77"
  }, {
    "url": "blog/svg/blog-hero-scene.svg",
    "revision": "b6aeb4a5d33884a20b8051030c073b5c"
  }, {
    "url": "blog/svg/article-hero.svg",
    "revision": "b6aeb4a5d33884a20b8051030c073b5c"
  }, {
    "url": "blog/svg/annual_limit.svg",
    "revision": "8bbfa1447c7e7cc85d73fd14b1a08013"
  }, {
    "url": "blog/cada-cuanto-banar-perro/index.html",
    "revision": "1a706819eb04f4e426ddb0adb9138386"
  }, {
    "url": "assets/vendor-lucide-9FvkVrR4.js",
    "revision": null
  }, {
    "url": "assets/vendor-jspdf-CdTTCk8O.js",
    "revision": null
  }, {
    "url": "assets/useStorageQuota-g_iNB9PL.js",
    "revision": null
  }, {
    "url": "assets/purify.es-BgtpMKW3.js",
    "revision": null
  }, {
    "url": "assets/pdfExport-DGO3yL5M.js",
    "revision": null
  }, {
    "url": "assets/lostPet.contract-CPsqpB9X.js",
    "revision": null
  }, {
    "url": "assets/index.esm-CNLwcknP.js",
    "revision": null
  }, {
    "url": "assets/index.es-ZlEV0S3H.js",
    "revision": null
  }, {
    "url": "assets/html2canvas.esm-QH1iLAAe.js",
    "revision": null
  }, {
    "url": "assets/heic2any-TzM_HrcX.js",
    "revision": null
  }, {
    "url": "assets/firebase-storage-CCVpfTXZ.js",
    "revision": null
  }, {
    "url": "assets/firebase-messaging-BIb1L1Qi.js",
    "revision": null
  }, {
    "url": "assets/firebase-firestore-D1EYPDRe.js",
    "revision": null
  }, {
    "url": "assets/firebase-auth-DmH7RCvA.js",
    "revision": null
  }, {
    "url": "assets/firebase-app-DFmpqrB4.js",
    "revision": null
  }, {
    "url": "assets/cleanText-BgTcrUaf.js",
    "revision": null
  }, {
    "url": "assets/calendarExport-C8FXZ0Lz.js",
    "revision": null
  }, {
    "url": "assets/app-utils-DTmwjczO.js",
    "revision": null
  }, {
    "url": "assets/app-CH_-Ki6V.css",
    "revision": null
  }, {
    "url": "assets/app-Buhefutt.js",
    "revision": null
  }, {
    "url": "assets/WellbeingProductPreviewPage-DLqjGn6J.js",
    "revision": null
  }, {
    "url": "assets/WellbeingMasterBookPreviewPage-D1Iy_6m7.js",
    "revision": null
  }, {
    "url": "assets/VaccinationCardPreviewPage-CFjqsrUj.js",
    "revision": null
  }, {
    "url": "assets/VaccinationCardModal-BOMoUzRs.js",
    "revision": null
  }, {
    "url": "assets/UserProfileScreen-BlSVYC4q.js",
    "revision": null
  }, {
    "url": "assets/Timeline-CrnuMacL.js",
    "revision": null
  }, {
    "url": "assets/ReportLostPet-DlOO0P4b.js",
    "revision": null
  }, {
    "url": "assets/RecommendationFeed-DSFlgifN.js",
    "revision": null
  }, {
    "url": "assets/RandomQuestionCard--t6E9xfe.js",
    "revision": null
  }, {
    "url": "assets/PetSelectorModal-BqvUgOxx.js",
    "revision": null
  }, {
    "url": "assets/PetProfileModal-ax-xSQb2.js",
    "revision": null
  }, {
    "url": "assets/PetPreferencesEditor-BlTfW_aQ.js",
    "revision": null
  }, {
    "url": "assets/NearbyVetsScreen-B3W2_OI3.js",
    "revision": null
  }, {
    "url": "assets/MonthSummary-BFFK8fGA.js",
    "revision": null
  }, {
    "url": "assets/MedicationsScreen-CFA2IJIY.js",
    "revision": null
  }, {
    "url": "assets/LostPetFeed-ChHPdqLA.js",
    "revision": null
  }, {
    "url": "assets/InviteFriendsModal-BXXk4Coa.js",
    "revision": null
  }, {
    "url": "assets/Header-Dgo0pE8M.js",
    "revision": null
  }, {
    "url": "assets/FocusedHomeExperience-rUKVABTx.js",
    "revision": null
  }, {
    "url": "assets/ExportReportModal-Cpjfr6l7.js",
    "revision": null
  }, {
    "url": "assets/DocumentScannerModal-BJVAFwI8.js",
    "revision": null
  }, {
    "url": "assets/AppointmentsScreen-XfpZDRHg.js",
    "revision": null
  }, {
    "url": "assets/AdminAccessRequests-DWtciBbB.js",
    "revision": null
  }, {
    "url": "assets/ActionTray-C_TFOeZB.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "df5f227d9f644fe467d42d0fe2494e62"
  }, {
    "url": "pwa-192x192.png",
    "revision": "5ab1063bc6d10659aeeac7fb81b998d7"
  }, {
    "url": "pwa-512x512.png",
    "revision": "911e0d0a7a4c95a9ae9168b894c30c60"
  }, {
    "url": "manifest.webmanifest",
    "revision": "3751b9618cf5cb2fad55385786493044"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/offline\.html$/]
  }));
  workbox.registerRoute(/vendor-heic.*\.js$/i, new workbox.CacheFirst({
    "cacheName": "heic-lib-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 1,
      maxAgeSeconds: 7776000
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols/i, new workbox.CacheFirst({
    "cacheName": "material-symbols-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 5,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/api\.open-meteo\.com\/.*/i, new workbox.NetworkFirst({
    "cacheName": "open-meteo-cache",
    "networkTimeoutSeconds": 5,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 1800
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/images\.unsplash\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "unsplash-images-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 604800
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
