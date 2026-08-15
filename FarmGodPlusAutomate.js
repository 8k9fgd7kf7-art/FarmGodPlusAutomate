// FarmGod+ v2.7.7 – Report-Fetch-Debug / Simulations-Autopilot
(function (__FGW) {
  'use strict';
  if (!__FGW || !__FGW.game_data || !__FGW.jQuery) {
    console.error('FarmGod+: Die Stämme-Seitenkontext wurde nicht gefunden.');
    return;
  }
  const window = __FGW;
  const $ = __FGW.jQuery;
  const jQuery = __FGW.jQuery;
  const game_data = __FGW.game_data;
  const ScriptAPI = __FGW.ScriptAPI;
  const UI = __FGW.UI;
  const Dialog = __FGW.Dialog;
  const TribalWars = __FGW.TribalWars;
  const Timing = __FGW.Timing;
  const Accountmanager = __FGW.Accountmanager;

  // Schnellleisten-Version: Auf falschen Seiten automatisch
  // in den Farm-Assistenten wechseln.
  if (game_data.screen !== 'am_farm') {
    const farmUrl = game_data.link_base_pure + 'am_farm';
    window.location.href = farmUrl;
    return;
  }

  if (!UI || !Dialog || !TribalWars) {
    console.error('FarmGod+: Benötigte Spielobjekte fehlen.', {UI: !!UI, Dialog: !!Dialog, TribalWars: !!TribalWars});
    return;
  }

// Hungarian translation provided by =Krumpli=

if (ScriptAPI && typeof ScriptAPI.register === 'function') {
  try { ScriptAPI.register('FarmGodPlus', true, 'FarmGod+'); } catch (e) { console.warn('FarmGod+: ScriptAPI.register übersprungen', e); }
}

window.FarmGod = {};
window.FarmGod.Library = (function () {
  /**** TribalWarsLibrary.js ****/
  if (typeof window.twLib === 'undefined') {
    window.twLib = {
      queues: null,
      init: function () {
        if (this.queues === null) {
          this.queues = this.queueLib.createQueues(5);
        }
      },
      queueLib: {
        maxAttempts: 3,
        Item: function (action, arg, promise = null) {
          this.action = action;
          this.arguments = arg;
          this.promise = promise;
          this.attempts = 0;
        },
        Queue: function () {
          this.list = [];
          this.working = false;
          this.length = 0;

          this.doNext = function () {
            let item = this.dequeue();
            let self = this;

            if (item.action == 'openWindow') {
              window
                .open(...item.arguments)
                .addEventListener(
                  'DOMContentLoaded',
                  function () {
                    self.start();
                  }
                );
            } else {
              $[item.action](...item.arguments)
                .done(function () {
                  item.promise.resolve.apply(null, arguments);
                  self.start();
                })
                .fail(function () {
                  item.attempts += 1;
                  if (
                    item.attempts <
                    twLib.queueLib.maxAttempts
                  ) {
                    self.enqueue(item, true);
                  } else {
                    item.promise.reject.apply(
                      null,
                      arguments
                    );
                  }

                  self.start();
                });
            }
          };

          this.start = function () {
            if (this.length) {
              this.working = true;
              this.doNext();
            } else {
              this.working = false;
            }
          };

          this.dequeue = function () {
            this.length -= 1;
            return this.list.shift();
          };

          this.enqueue = function (item, front = false) {
            front ? this.list.unshift(item) : this.list.push(item);
            this.length += 1;

            if (!this.working) {
              this.start();
            }
          };
        },
        createQueues: function (amount) {
          let arr = [];

          for (let i = 0; i < amount; i++) {
            arr[i] = new twLib.queueLib.Queue();
          }

          return arr;
        },
        addItem: function (item) {
          let leastBusyQueue = twLib.queues
            .map((q) => q.length)
            .reduce((next, curr) => (curr < next ? curr : next), 0);
          twLib.queues[leastBusyQueue].enqueue(item);
        },
        orchestrator: function (type, arg) {
          let promise = $.Deferred();
          let item = new twLib.queueLib.Item(type, arg, promise);

          twLib.queueLib.addItem(item);

          return promise;
        },
      },
      ajax: function () {
        return twLib.queueLib.orchestrator('ajax', arguments);
      },
      get: function () {
        return twLib.queueLib.orchestrator('get', arguments);
      },
      post: function () {
        return twLib.queueLib.orchestrator('post', arguments);
      },
      openWindow: function () {
        let item = new twLib.queueLib.Item('openWindow', arguments);

        twLib.queueLib.addItem(item);
      },
    };

    twLib.init();
  }

  /**** Script Library ****/
  const setUnitSpeeds = function () {
    let unitSpeeds = {};

    $.when($.get('/interface.php?func=get_unit_info')).then((xml) => {
      $(xml)
        .find('config')
        .children()
        .map((i, el) => {
          unitSpeeds[$(el).prop('nodeName')] = $(el)
            .find('speed')
            .text()
            .toNumber();
        });

      localStorage.setItem(
        'FarmGod_unitSpeeds',
        JSON.stringify(unitSpeeds)
      );
    });
  };

  const getUnitSpeeds = function () {
    return JSON.parse(localStorage.getItem('FarmGod_unitSpeeds')) || false;
  };

  if (!getUnitSpeeds()) setUnitSpeeds();

  const determineNextPage = function (page, $html) {
    let villageLength =
      $html.find('#scavenge_mass_screen').length > 0
        ? $html.find('tr[id*="scavenge_village"]').length
        : $html.find('tr.row_a, tr.row_ax, tr.row_b, tr.row_bx').length;
    let navSelect = $html
      .find('.paged-nav-item')
      .first()
      .closest('td')
      .find('select')
      .first();
    // Commented out the old version of the code, updated in April 2024
    // The old version did not count the number of pages in the loot assistant properly when there were more than 15 or so due to the way the UI changes to not show all pages
    // let navLength = ($html.find('#am_widget_Farm').length > 0) ? $html.find('#plunder_list_nav').first().find('a.paged-nav-item').length : ((navSelect.length > 0) ? navSelect.find('option').length - 1 : $html.find('.paged-nav-item').not('[href*="page=-1"]').length);
    let navLength =
      $html.find('#am_widget_Farm').length > 0
        ? parseInt(
          $('#plunder_list_nav')
            .first()
            .find('a.paged-nav-item, strong.paged-nav-item')
          [
            $('#plunder_list_nav')
              .first()
              .find(
                'a.paged-nav-item, strong.paged-nav-item'
              ).length - 1
          ].textContent.replace(/\D/g, '')
        ) - 1
        : navSelect.length > 0
          ? navSelect.find('option').length - 1
          : $html.find('.paged-nav-item').not('[href*="page=-1"]').length;
    let pageSize =
      $('#mobileHeader').length > 0
        ? 10
        : parseInt($html.find('input[name="page_size"]').val());

    if (page == -1 && villageLength == 1000) {
      return Math.floor(1000 / pageSize);
    } else if (page < navLength) {
      return page + 1;
    }

    return false;
  };

  const processPage = function (url, page, wrapFn) {
    let pageText = url.match('am_farm')
      ? `&Farm_page=${page}`
      : `&page=${page}`;

    return twLib
      .ajax({
        url: url + pageText,
      })
      .then((html) => {
        return wrapFn(page, $(html));
      });
  };

  const processAllPages = function (url, processorFn) {
    let page = url.match('am_farm') || url.match('scavenge_mass') ? 0 : -1;
    let wrapFn = function (page, $html) {
      let dnp = determineNextPage(page, $html);

      if (dnp) {
        processorFn($html);
        return processPage(url, dnp, wrapFn);
      } else {
        return processorFn($html);
      }
    };

    return processPage(url, page, wrapFn);
  };

  const getDistance = function (origin, target) {
    let a = origin.toCoord(true).x - target.toCoord(true).x;
    let b = origin.toCoord(true).y - target.toCoord(true).y;

    return Math.hypot(a, b);
  };

  const subtractArrays = function (array1, array2) {
    let result = array1.map((val, i) => {
      return val - array2[i];
    });

    return result.some((v) => v < 0) ? false : result;
  };

  const getCurrentServerTime = function () {
    let [hour, min, sec, day, month, year] = $('#serverTime')
      .closest('p')
      .text()
      .match(/\d+/g);
    return new Date(year, month - 1, day, hour, min, sec).getTime();
  };

  const timestampFromString = function (timestr) {
    let d = $('#serverDate')
      .text()
      .split('/')
      .map((x) => +x);
    let todayPattern = new RegExp(
      window.lang['aea2b0aa9ae1534226518faaefffdaad'].replace(
        '%s',
        '([\\d+|:]+)'
      )
    ).exec(timestr);
    let tomorrowPattern = new RegExp(
      window.lang['57d28d1b211fddbb7a499ead5bf23079'].replace(
        '%s',
        '([\\d+|:]+)'
      )
    ).exec(timestr);
    let laterDatePattern = new RegExp(
      window.lang['0cb274c906d622fa8ce524bcfbb7552d']
        .replace('%1', '([\\d+|\\.]+)')
        .replace('%2', '([\\d+|:]+)')
    ).exec(timestr);
    let t, date;

    if (todayPattern !== null) {
      t = todayPattern[1].split(':');
      date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0);
    } else if (tomorrowPattern !== null) {
      t = tomorrowPattern[1].split(':');
      date = new Date(
        d[2],
        d[1] - 1,
        d[0] + 1,
        t[0],
        t[1],
        t[2],
        t[3] || 0
      );
    } else {
      d = (laterDatePattern[1] + d[2]).split('.').map((x) => +x);
      t = laterDatePattern[2].split(':');
      date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0);
    }

    return date.getTime();
  };

  String.prototype.toCoord = function (objectified) {
    let c = (this.match(/\d{1,3}\|\d{1,3}/g) || [false]).pop();
    return c && objectified
      ? { x: c.split('|')[0], y: c.split('|')[1] }
      : c;
  };

  String.prototype.toNumber = function () {
    return parseFloat(this);
  };

  Number.prototype.toNumber = function () {
    return parseFloat(this);
  };

  return {
    getUnitSpeeds,
    processPage,
    processAllPages,
    getDistance,
    subtractArrays,
    getCurrentServerTime,
    timestampFromString,
  };
})();

window.FarmGod.Translation = (function () {
  const msg = {
    nl_NL: {
      missingFeatures:
        'Script vereist een premium account en farm assistent!',
      options: {
        title: 'FarmGod Opties',
        warning:
          '<b>Waarschuwingen:</b><br>- Zorg dat A is ingesteld als je standaard microfarm en B als een grotere microfarm<br>- Zorg dat de farm filters correct zijn ingesteld voor je het script gebruikt',
        filterImage:
          'https://higamy.github.io/TW/Scripts/Assets/farmGodFilters.png',
        group: 'Uit welke groep moet er gefarmd worden:',
        distance: 'Maximaal aantal velden dat farms mogen lopen:',
        time: 'Hoe veel tijd in minuten moet er tussen farms zitten:',
        losses: 'Verstuur farm naar dorpen met gedeeltelijke verliezen:',
        maxloot: 'Verstuur een B farm als de buit vorige keer vol was:',
        newbarbs: 'Voeg nieuwe barbarendorpen toe om te farmen:',
        button: 'Plan farms',
      },
      table: {
        noFarmsPlanned:
          'Er kunnen met de opgegeven instellingen geen farms verstuurd worden.',
        origin: 'Oorsprong',
        target: 'Doel',
        fields: 'Velden',
        farm: 'Farm',
        goTo: 'Ga naar',
      },
      messages: {
        villageChanged: 'Succesvol van dorp veranderd!',
        villageError:
          'Alle farms voor het huidige dorp zijn reeds verstuurd!',
        sendError: 'Error: farm niet verstuurd!',
      },
    },
    hu_HU: {
      missingFeatures:
        'A scriptnek szÃ¼ksÃ©ge van PrÃ©mium fiÃ³kra Ã©s FarmkezelÅ‘re!',
      options: {
        title: 'FarmGod opciÃ³k',
        warning:
          '<b>Figyelem:</b><br>- Bizonyosodj meg rÃ³la, hogy az "A" sablon az alapÃ©rtelmezett Ã©s a "B" egy nagyobb mennyisÃ©gÅ± mikrÃ³-farm<br>- Bizonyosodj meg rÃ³la, hogy a farm-filterek megfelelÅ‘en vannak beÃ¡llÃ­tva mielÅ‘tt hasznÃ¡lod a sctiptet',
        filterImage:
          'https://higamy.github.io/TW/Scripts/Assets/farmGodFilters_HU.png',
        group: 'EbbÅ‘l a csoportbÃ³l kÃ¼ldje:',
        distance: 'MaximÃ¡lis mezÅ‘ tÃ¡volsÃ¡g:',
        time: 'Mekkora idÅ‘intervallumban kÃ¼ldje a tÃ¡madÃ¡sokat percben:',
        losses: 'KÃ¼ldjÃ¶n tÃ¡madÃ¡st olyan falvakba ahol rÃ©szleges vesztesÃ©ggel jÃ¡rhat a tÃ¡madÃ¡s:',
        maxloot:
          'A "B" sablont kÃ¼ldje abban az esetben, ha az elÅ‘zÅ‘ tÃ¡madÃ¡s maximÃ¡lis fosztogatÃ¡ssal jÃ¡rt:',
        newbarbs: 'Adj hozzÃ¡ Ãºj barbÃ¡r falukat:',
        button: 'Farm megtervezÃ©se',
      },
      table: {
        noFarmsPlanned:
          'A jelenlegi beÃ¡llÃ­tÃ¡sokkal nem lehet Ãºj tÃ¡madÃ¡st kikÃ¼ldeni.',
        origin: 'Origin',
        target: 'CÃ©lpont',
        fields: 'TÃ¡volsÃ¡g',
        farm: 'Farm',
        goTo: 'Go to',
      },
      messages: {
        villageChanged: 'Falu sikeresen megvÃ¡ltoztatva!',
        villageError: 'Minden farm kiment a jelenlegi falubÃ³l!',
        sendError: 'Hiba: Farm nemvolt elkÃ¼ldve!',
      },
    },
    int: {
      missingFeatures:
        'Script requires a premium account and loot assistent!',
      options: {
        title: 'FarmGod Options',
        warning:
          '<b>Warning:</b><br>- Make sure A is set as your default microfarm and B as a larger microfarm<br>- Make sure the farm filters are set correctly before using the script',
        filterImage:
          'https://higamy.github.io/TW/Scripts/Assets/farmGodFilters.png',
        group: 'Send farms from group:',
        distance: 'Maximum fields for farms:',
        time: 'How much time in minutes should there be between farms:',
        losses: 'Send farm to villages with partial losses:',
        maxloot: 'Send a B farm if the last loot was full:',
        newbarbs: 'Add new barbs te farm:',
        button: 'Plan farms',
      },
      table: {
        noFarmsPlanned:
          'No farms can be sent with the specified settings.',
        origin: 'Origin',
        target: 'Target',
        fields: 'fields',
        farm: 'Farm',
        goTo: 'Go to',
      },
      messages: {
        villageChanged: 'Successfully changed village!',
        villageError:
          'All farms for the current village have been sent!',
        sendError: 'Error: farm not send!',
      },
    },
  };

  const get = function () {
    let lang = msg.hasOwnProperty(game_data.locale)
      ? game_data.locale
      : 'int';
    return msg[lang];
  };

  return {
    get,
  };
})();

window.FarmGod.Main = (function (Library, Translation) {
  const lib = Library;
  const t = Translation.get();
  let curVillage = null;
  let farmBusy = false;
  let fgSimulationTimer = null;
  let fgSimulationBusy = false;
  let fgSimulationSession = { cycles: 0, wouldSend: 0, lastCount: 0, startedAt: null, lastRun: null, nextRun: null, log: [] };

  const init = function () {
    if (
      game_data.features.Premium.active &&
      game_data.features.FarmAssistent.active
    ) {
      $.when(buildOptions()).then((html) => {
        Dialog.show('FarmGod', html);
        bindOptionEvents();
        if (fgReadSimulationState().active) {
          Dialog.close();
          fgSimulationSession.startedAt = Date.now();
          fgSimulationAddLog('Aktive Simulation wieder aufgenommen.');
          fgRenderSimulationPanel();
          fgRunSimulationCycle();
          return;
        }
        const startButton = document.querySelector('.optionButton');
        if (startButton) startButton.focus();
      });
    } else {
      UI.ErrorMessage(t.missingFeatures);
    }
  };

  const getStoredOptions = function () {
    const defaults = {
      optionGroup: 0,
      optionDistance: 25,
      optionTime: 10,
      optionLosses: false,
      optionMaxloot: true,
      optionNewbarbs: true,
      optionTemplateNormal: 'a',
      optionTemplateFull: 'b',
      optionReturnEnabled: false,
      optionReturnBy: '',
      optionArrivalEnabled: false,
      optionArrivalBy: '',
      optionFAPages: 20,
      reserveEnabled: false,
      reserveSpear: 0,
      reserveSword: 0,
      reserveAxe: 0,
      reserveSpy: 0,
      reserveLight: 0,
      reserveRam: 0,
      activeProfile: 'Standard',
      simulationRefreshSeconds: 30,
    };

    try {
      return Object.assign(
        {},
        defaults,
        JSON.parse(localStorage.getItem('farmGod_options')) || {}
      );
    } catch (e) {
      return defaults;
    }
  };

  const getProfiles = function () {
    const defaults = {
      Standard: { distance: 25, time: 10, losses: false, maxloot: true },
      Nah: { distance: 12, time: 8, losses: false, maxloot: true },
      Weit: { distance: 35, time: 12, losses: false, maxloot: true },
      Nacht: { distance: 30, time: 20, losses: false, maxloot: true },
    };

    try {
      return Object.assign(
        {},
        defaults,
        JSON.parse(localStorage.getItem('farmGod_profiles')) || {}
      );
    } catch (e) {
      return defaults;
    }
  };

  const saveProfiles = function (profiles) {
    localStorage.setItem('farmGod_profiles', JSON.stringify(profiles));
  };

  const readOptionsFromDialog = function () {
    return {
      optionGroup: parseInt($('.optionGroup').val()) || 0,
      optionDistance: Math.max(0, parseFloat($('.optionDistance').val()) || 0),
      optionTime: Math.max(0, parseFloat($('.optionTime').val()) || 0),
      optionLosses: $('.optionLosses').prop('checked'),
      optionMaxloot: $('.optionMaxloot').prop('checked'),
      optionNewbarbs: $('.optionNewbarbs').prop('checked') || false,
      optionTemplateNormal: $('.optionTemplateNormal').val() || 'a',
      optionTemplateFull: $('.optionTemplateFull').val() || $('.optionTemplateNormal').val() || 'b',
      optionReturnEnabled: $('.optionReturnEnabled').prop('checked'),
      optionReturnBy: ($('.optionReturnBy').val() || '').trim(),
      optionArrivalEnabled: $('.optionArrivalEnabled').prop('checked'),
      optionArrivalBy: ($('.optionArrivalBy').val() || '').trim(),
      optionFAPages: Math.max(1, Math.min(50, parseInt($('.optionFAPages').val(), 10) || 20)),
      reserveEnabled: $('.fgReserveEnabled').prop('checked'),
      reserveSpear: Math.max(0, parseInt($('.fgReserveSpear').val(), 10) || 0),
      reserveSword: Math.max(0, parseInt($('.fgReserveSword').val(), 10) || 0),
      reserveAxe: Math.max(0, parseInt($('.fgReserveAxe').val(), 10) || 0),
      reserveSpy: Math.max(0, parseInt($('.fgReserveSpy').val(), 10) || 0),
      reserveLight: Math.max(0, parseInt($('.fgReserveLight').val(), 10) || 0),
      reserveRam: Math.max(0, parseInt($('.fgReserveRam').val(), 10) || 0),
      activeProfile: $('.optionProfile').val() || 'Standard',
      simulationRefreshSeconds: Math.max(10, Math.min(300, parseInt($('.fgSimulationRefresh').val(), 10) || 30)),
    };
  };

  const applyProfileToDialog = function (profileName) {
    const profile = getProfiles()[profileName];
    if (!profile) return;
    $('.optionDistance').val(profile.distance);
    $('.optionTime').val(profile.time);
    $('.optionLosses').prop('checked', !!profile.losses);
    $('.optionMaxloot').prop('checked', profile.maxloot !== false);
  };

  const formatClock = function (timestamp) {
    const d = new Date(timestamp);
    return String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');
  };

  const normalizeClockInput = function (value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) return false;
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return false;
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  };

  const getClockDeadlineTimestamp = function (clockValue) {
    const normalized = normalizeClockInput(clockValue);
    if (!normalized) return false;

    const nowTs = lib.getCurrentServerTime();
    const now = new Date(nowTs);
    const parts = normalized.split(':');
    let deadline = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      parseInt(parts[0], 10),
      parseInt(parts[1], 10),
      0,
      0
    ).getTime();

    // If the selected clock time has already passed today, it means tomorrow.
    if (deadline <= nowTs) deadline += 24 * 60 * 60 * 1000;
    return deadline;
  };

  const getReturnDeadlineTimestamp = function (clockValue) {
    return getClockDeadlineTimestamp(clockValue);
  };

  const getArrivalDeadlineTimestamp = function (clockValue) {
    return getClockDeadlineTimestamp(clockValue);
  };

  const parseVillageTxt = function (raw) {
    return String(raw || '')
      .split(/\r?\n/)
      .filter(Boolean)
      .map(function (line) {
        const parts = line.split(',');
        return {
          id: parseInt(parts[0], 10),
          name: decodeURIComponent((parts[1] || '').replace(/\+/g, ' ')),
          x: parseInt(parts[2], 10),
          y: parseInt(parts[3], 10),
          playerId: parseInt(parts[4], 10),
          points: parseInt(parts[5], 10) || 0,
          coord: parts[2] + '|' + parts[3],
        };
      })
      .filter(function (v) {
        return Number.isFinite(v.x) && Number.isFinite(v.y);
      });
  };

  const calculateBarbAnalysis = function (villages) {
    const own = villages.filter(function (v) {
      return v.playerId === parseInt(game_data.player.id, 10);
    });
    const barbs = villages.filter(function (v) {
      return v.playerId === 0;
    });
    const radii = [5, 10, 15, 20];

    const rows = own.map(function (origin) {
      const distances = barbs.map(function (barb) {
        const dx = origin.x - barb.x;
        const dy = origin.y - barb.y;
        return {
          distance: Math.hypot(dx, dy),
          barb: barb,
        };
      }).sort(function (a, b) {
        return a.distance - b.distance;
      });

      const counts = {};
      radii.forEach(function (radius) {
        counts[radius] = distances.filter(function (item) {
          return item.distance <= radius;
        }).length;
      });

      return {
        id: origin.id,
        name: origin.name,
        coord: origin.coord,
        counts: counts,
        nearest: distances.length ? distances[0].distance : null,
        within20: distances.filter(function (item) {
          return item.distance <= 20;
        }).length,
      };
    });

    rows.sort(function (a, b) {
      if (b.within20 !== a.within20) return b.within20 - a.within20;
      return (a.nearest || 9999) - (b.nearest || 9999);
    });

    return {
      rows: rows,
      ownCount: own.length,
      barbCount: barbs.length,
      radii: radii,
    };
  };

  const buildBarbAnalysisHtml = function (analysis) {
    const esc = function (value) {
      return $('<div>').text(String(value)).html();
    };

    const totals = {};
    analysis.radii.forEach(function (radius) {
      totals[radius] = analysis.rows.reduce(function (sum, row) {
        return sum + row.counts[radius];
      }, 0);
    });

    let html = '<div class="fgBarbSummary">' +
      '<div><strong>' + analysis.ownCount + '</strong><span>eigene Dörfer</span></div>' +
      '<div><strong>' + analysis.barbCount + '</strong><span>Barbarendörfer auf der Welt</span></div>' +
      '<div><strong>' + (analysis.rows[0] ? analysis.rows[0].within20 : 0) + '</strong><span>bestes Dorf ≤20 Felder</span></div>' +
      '</div>';

    html += '<div class="fgBarbTableWrap"><table class="vis fgBarbTable" width="100%">' +
      '<tr><th>Dorf</th><th>5 Felder</th><th>10 Felder</th><th>15 Felder</th><th>20 Felder</th><th>Nächste Barbare</th></tr>';

    analysis.rows.forEach(function (row, index) {
      html += '<tr' + (index === 0 ? ' class="fgBarbBest"' : '') + '>' +
        '<td><b>' + esc(row.name) + '</b><br><span>' + esc(row.coord) + '</span>' +
        (index === 0 ? '<span class="fgBestBadge">BESTES FARMDORF</span>' : '') + '</td>' +
        '<td>' + row.counts[5] + '</td>' +
        '<td>' + row.counts[10] + '</td>' +
        '<td>' + row.counts[15] + '</td>' +
        '<td><b>' + row.counts[20] + '</b></td>' +
        '<td>' + (row.nearest === null ? '–' : row.nearest.toFixed(2) + ' Felder') + '</td>' +
        '</tr>';
    });

    html += '</table></div>';
    html += '<div class="fgBarbNote">Die Werte zählen Barbarendörfer innerhalb der jeweiligen Entfernung von jedem eigenen Dorf. Ein Barbarendorf kann deshalb bei mehreren eigenen Dörfern mitgezählt werden.</div>';

    return html;
  };

  const runBarbAnalysis = function () {
    const $result = $('.fgBarbAnalysisResult');
    $('.fgBarbAnalyze').prop('disabled', true).val('Analysiere …');
    $result.html('<div class="fgBarbLoading">' + UI.Throbber[0].outerHTML + '<span>Weltdaten werden ausgewertet …</span></div>').show();

    return $.get('/map/village.txt')
      .then(function (raw) {
        const villages = parseVillageTxt(raw);
        const analysis = calculateBarbAnalysis(villages);
        $result.html(buildBarbAnalysisHtml(analysis));
      })
      .catch(function (error) {
        console.error('FarmGod+ barbarian analysis error:', error);
        $result.html('<div class="fgBarbError">Die Barbarendörfer konnten nicht ausgewertet werden.</div>');
        UI.ErrorMessage('FarmGod+ konnte die Barbaren-Analyse nicht laden.');
      })
      .always(function () {
        $('.fgBarbAnalyze').prop('disabled', false).val('Barbarendörfer analysieren');
      });
  };

  const FG_WALLBREAKER_UNITS = {
    1: { axe: 60, ram: 4, spy: 1 },
    2: { axe: 60, ram: 7, spy: 1 },
    3: { axe: 60, ram: 10, spy: 1 },
    4: { axe: 150, ram: 15, spy: 1 },
    5: { axe: 150, ram: 20, spy: 1 },
    6: { axe: 150, ram: 25, spy: 1 },
    7: { axe: 250, ram: 30, spy: 1 },
    8: { axe: 250, ram: 38, spy: 1 },
    9: { axe: 500, ram: 46, spy: 1 },
  };

  const fgGetWallbreakerUnits = function (wall) {
    const level = parseInt(wall, 10);
    if (FG_WALLBREAKER_UNITS[level]) return FG_WALLBREAKER_UNITS[level];
    return { axe: 500, ram: 100, spy: 1 };
  };

  const fgGetUrlParam = function (name, url) {
    try {
      return new URL(url, window.location.origin).searchParams.get(name);
    } catch (e) {
      return null;
    }
  };

  const fgFetchSequential = function (urls, onProgress) {
    const results = [];
    let index = 0;

    return new Promise(function (resolve, reject) {
      const next = function () {
        if (index >= urls.length) {
          resolve(results);
          return;
        }

        $.get(urls[index])
          .done(function (data) {
            results.push(data);
            index++;
            if (onProgress) onProgress(index, urls.length);
            setTimeout(next, 250);
          })
          .fail(reject);
      };
      next();
    });
  };

  const fgFetchFarmAssistantPages = function (maxPages) {
    return $.get(game_data.link_base_pure + 'am_farm').then(function (response) {
      const htmlDoc = $.parseHTML(response);
      const $nav = $(htmlDoc).find('#plunder_list_nav:eq(0) a');
      const urls = [
        game_data.link_base_pure +
          'am_farm&ajax=page_entries&Farm_page=0&class=&extended=1&order=distance&dir=asc'
      ];

      $nav.each(function () {
        if (urls.length >= maxPages) return false;
        const page = parseInt(
          fgGetUrlParam(
            'Farm_page',
            window.location.origin + $(this).attr('href')
          ),
          10
        );
        if (Number.isFinite(page)) {
          const url =
            game_data.link_base_pure +
            'am_farm&ajax=page_entries&Farm_page=' +
            page +
            '&class=&extended=1&order=distance&dir=asc';
          if (!urls.includes(url)) urls.push(url);
        }
      });

      return urls;
    });
  };

  const fgParseWallbreakerRows = function (pages) {
    let rowsHtml = '';
    pages.forEach(function (page) {
      if (page && page.plunder_list !== undefined) {
        rowsHtml += page.plunder_list;
      } else if (typeof page === 'string') {
        rowsHtml += page;
      }
    });

    const parsed = $.parseHTML(rowsHtml) || [];
    const result = [];
    const coordRegex = /[0-9]{1,3}\|[0-9]{1,3}/;

    $(parsed).each(function () {
      const $row = $(this);
      if (!$row.is('tr')) return;

      const $cells = $row.find('td');
      if ($cells.length < 8) return;

      const $villageLink = $cells.eq(3).find('a').first();
      const coordMatch = ($villageLink.text() || '').match(coordRegex);
      if (!coordMatch) return;

      const $actionLink = $cells.last().find('a').last();
      const targetId = parseInt(
        fgGetUrlParam('target', $actionLink.attr('href') || ''),
        10
      );
      const reportId = parseInt(
        fgGetUrlParam('view', $villageLink.attr('href') || ''),
        10
      );

      const wallText = $cells.eq(6).text().trim();
      const typeSrc = $cells.eq(1).find('img').attr('src') || '';
      const unknownGreen = wallText === '?' && typeSrc.includes('green');

      if (!(parseInt(wallText, 10) > 0 || wallText === '?')) return;
      if (unknownGreen) return;
      if (!Number.isFinite(targetId)) return;

      result.push({
        villageId: targetId,
        coord: coordMatch[0],
        wall: wallText,
        distance: $cells.eq(7).text().trim(),
        reportId: Number.isFinite(reportId) ? reportId : null,
        reportTime: $cells.eq(4).text().trim(),
        type: typeSrc,
      });
    });

    // Keep only the first/current entry per target.
    const seen = {};
    return result.filter(function (item) {
      if (seen[item.villageId]) return false;
      seen[item.villageId] = true;
      return true;
    });
  };

  const fgFetchOwnVillageTroops = function () {
    const unitConfig = ['axe', 'ram', 'spy'];
    const unitUrl = game_data.link_base_pure +
      'overview_villages&mode=units&type=complete&group=0&page=-1';

    return $.get(unitUrl).then(function (html) {
      const doc = $.parseHTML(html, document, true);
      const villages = [];

      $(doc).find('#units_table tbody tr').each(function () {
        const $row = $(this);
        const coordMatch = ($row.text() || '').match(/[0-9]{1,3}\|[0-9]{1,3}/);
        if (!coordMatch) return;

        const $villageLink = $row.find('a[href*="village="]').first();
        let villageId = parseInt(
          fgGetUrlParam('village', $villageLink.attr('href') || ''),
          10
        );

        if (!Number.isFinite(villageId)) {
          villageId = parseInt($row.attr('data-id'), 10);
        }
        if (!Number.isFinite(villageId)) return;

        const $table = $row.closest('table');
        const unitColumns = {};

        $table.find('thead th').each(function (index) {
          const src = $(this).find('img').attr('src') || '';
          unitConfig.forEach(function (unit) {
            if (
              src.indexOf('unit_' + unit) !== -1 ||
              src.indexOf('/' + unit + '.') !== -1
            ) {
              unitColumns[unit] = index;
            }
          });
        });

        const readCellNumber = function (index) {
          if (index === undefined) return 0;
          const raw = $row.children('td').eq(index).text()
            .replace(/\./g, '')
            .replace(/\s/g, '');
          const match = raw.match(/-?\d+/);
          return match ? Math.max(0, parseInt(match[0], 10) || 0) : 0;
        };

        const name =
          ($row.find('.quickedit-label').first().text() ||
           $villageLink.text() ||
           coordMatch[0]).trim();

        villages.push({
          id: villageId,
          name: name,
          coord: coordMatch[0],
          x: parseInt(coordMatch[0].split('|')[0], 10),
          y: parseInt(coordMatch[0].split('|')[1], 10),
          units: {
            axe: readCellNumber(unitColumns.axe),
            ram: readCellNumber(unitColumns.ram),
            spy: readCellNumber(unitColumns.spy)
          }
        });
      });

      // Fallback: some worlds render the complete unit overview without tbody.
      if (!villages.length) {
        $(doc).find('#units_table tr').each(function () {
          const $row = $(this);
          if ($row.find('th').length) return;

          const coordMatch = ($row.text() || '').match(/[0-9]{1,3}\|[0-9]{1,3}/);
          if (!coordMatch) return;

          const $link = $row.find('a[href*="village="]').first();
          const villageId = parseInt(
            fgGetUrlParam('village', $link.attr('href') || ''),
            10
          );
          if (!Number.isFinite(villageId)) return;

          const $headers = $row.closest('table').find('tr').first().children('th,td');
          const columns = {};
          $headers.each(function (index) {
            const src = $(this).find('img').attr('src') || '';
            unitConfig.forEach(function (unit) {
              if (src.indexOf('unit_' + unit) !== -1) columns[unit] = index;
            });
          });

          const read = function (unit) {
            if (columns[unit] === undefined) return 0;
            const match = $row.children('td').eq(columns[unit]).text()
              .replace(/\./g, '').match(/\d+/);
            return match ? parseInt(match[0], 10) || 0 : 0;
          };

          villages.push({
            id: villageId,
            name: ($row.find('.quickedit-label').text() || $link.text() || coordMatch[0]).trim(),
            coord: coordMatch[0],
            x: parseInt(coordMatch[0].split('|')[0], 10),
            y: parseInt(coordMatch[0].split('|')[1], 10),
            units: {
              axe: read('axe'),
              ram: read('ram'),
              spy: read('spy')
            }
          });
        });
      }

      const seen = {};
      const unique = villages.filter(function (v) {
        if (seen[v.id]) return false;
        seen[v.id] = true;
        return true;
      });

      if (!unique.length) {
        throw new Error('FarmGod+ konnte die vollständige Truppenübersicht nicht lesen.');
      }

      return unique;
    });
  };

  const fgDistanceCoords = function (a, b) {
    const ap = String(a).split('|').map(Number);
    const bp = String(b).split('|').map(Number);
    return Math.hypot(ap[0] - bp[0], ap[1] - bp[1]);
  };

  const fgCanSupplyWallbreaker = function (available, need) {
    return available.axe >= need.axe &&
      available.ram >= need.ram &&
      available.spy >= need.spy;
  };

  const fgWallbreakerMissingText = function (available, need) {
    const missing = [];
    if (available.axe < need.axe) missing.push((need.axe - available.axe) + ' Axt');
    if (available.ram < need.ram) missing.push((need.ram - available.ram) + ' Rammen');
    if (available.spy < need.spy) missing.push((need.spy - available.spy) + ' Späher');
    return missing.join(', ');
  };

  const fgAssignWallbreakers = function (items, villages) {
    const remaining = {};
    const reserve = fgGetTroopReserve();
    villages.forEach(function (v) {
      remaining[v.id] = {
        axe: Math.max(0, (v.units.axe || 0) - (reserve.enabled ? reserve.axe : 0)),
        ram: Math.max(0, (v.units.ram || 0) - (reserve.enabled ? reserve.ram : 0)),
        spy: Math.max(0, (v.units.spy || 0) - (reserve.enabled ? reserve.spy : 0))
      };
    });

    // Harder targets first so scarce rams/axes are reserved sensibly.
    const ordered = items.slice().sort(function (a, b) {
      const an = fgGetWallbreakerUnits(a.wall);
      const bn = fgGetWallbreakerUnits(b.wall);
      if (bn.ram !== an.ram) return bn.ram - an.ram;
      if (bn.axe !== an.axe) return bn.axe - an.axe;
      return parseFloat(a.distance) - parseFloat(b.distance);
    });

    ordered.forEach(function (item) {
      const need = fgGetWallbreakerUnits(item.wall);
      const candidates = villages
        .filter(function (v) {
          return fgCanSupplyWallbreaker(remaining[v.id], need);
        })
        .map(function (v) {
          return {
            village: v,
            distance: fgDistanceCoords(v.coord, item.coord)
          };
        })
        .sort(function (a, b) {
          return a.distance - b.distance;
        });

      if (candidates.length) {
        const chosen = candidates[0];
        item.origin = chosen.village;
        item.originDistance = chosen.distance;
        item.possible = true;
        item.missing = '';

        remaining[chosen.village.id].axe -= need.axe;
        remaining[chosen.village.id].ram -= need.ram;
        remaining[chosen.village.id].spy -= need.spy;
      } else {
        item.origin = null;
        item.possible = false;

        // Show shortage of the village that comes closest to fulfilling the attack.
        let best = null;
        villages.forEach(function (v) {
          const av = remaining[v.id];
          const shortage =
            Math.max(0, need.axe - av.axe) +
            Math.max(0, need.ram - av.ram) * 10 +
            Math.max(0, need.spy - av.spy) * 50;
          const distance = fgDistanceCoords(v.coord, item.coord);
          if (!best || shortage < best.shortage ||
              (shortage === best.shortage && distance < best.distance)) {
            best = { village: v, available: av, shortage: shortage, distance: distance };
          }
        });

        item.closestOrigin = best ? best.village : null;
        item.missing = best
          ? fgWallbreakerMissingText(best.available, need)
          : 'keine eigenen Dörfer gefunden';
      }
    });

    return {
      items: items,
      remaining: remaining
    };
  };

  const fgIntegratedPlanKey = function () {
    return 'farmGod_integrated_plan_' + game_data.world + '_' + game_data.player.id;
  };

  const fgReadIntegratedPlan = function () {
    try {
      const raw = JSON.parse(localStorage.getItem(fgIntegratedPlanKey()) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) {
      return {};
    }
  };

  const fgWriteIntegratedPlan = function (plan) {
    localStorage.setItem(fgIntegratedPlanKey(), JSON.stringify(plan || {}));
  };

  const fgClearIntegratedPlan = function () {
    localStorage.removeItem(fgIntegratedPlanKey());
  };

  const fgSaveWallbreakerReservations = function (items) {
    const state = fgReadIntegratedPlan();
    const previous = Array.isArray(state.wallbreakers) ? state.wallbreakers : [];
    const previousByTarget = {};

    previous.forEach(function (entry) {
      previousByTarget[String(entry.targetId)] = entry;
    });

    const reservations = items.filter(function (item) {
      return item.possible && item.origin;
    }).map(function (item) {
      const old = previousByTarget[String(item.villageId)];
      const sameWall = old && String(old.wall) === String(item.wall);

      let status = 'planned';
      if (old && sameWall && ['planned', 'prepared', 'waiting_report'].includes(old.status)) {
        status = old.status;
      }

      return {
        targetId: item.villageId,
        targetCoord: item.coord,
        wall: item.wall,
        originId: item.origin.id,
        originCoord: item.origin.coord,
        originName: item.origin.name,
        units: fgGetWallbreakerUnits(item.wall),
        status: status,
        createdAt: old && old.createdAt ? old.createdAt : Date.now(),
        preparedAt: old && old.preparedAt ? old.preparedAt : null,
        sentAt: old && old.sentAt ? old.sentAt : null,
        updatedAt: Date.now()
      };
    });

    state.wallbreakers = reservations;
    state.updatedAt = Date.now();
    fgWriteIntegratedPlan(state);
    return reservations;
  };

  
  const fgReportDebugLog = function (message) {
    try {
      if (typeof fgSimulationAddLog === 'function') fgSimulationAddLog('🧪 Report-Debug · ' + message);
      else console.log('FarmGod+ Report-Debug:', message);
    } catch (e) {
      console.log('FarmGod+ Report-Debug:', message);
    }
  };

  const fgDebugReportHtml = function (reportId, html, targetCoord) {
    try {
      const text = typeof html === 'string' ? html : String(html || '');
      const $doc = $( $.parseHTML(text, document, true) || [] );
      const fullText = $doc.text();
      const hasSpy = /Spionage|Espionage|spy/i.test(fullText);
      const hasBuildings = /Gebäude|Buildings/i.test(fullText);
      const wallTextMatch = fullText.match(/(?:Wall|Mauer)\s*(?:Stufe|Level)?\s*(\d{1,2})/i);
      let wallFromTable = null;
      $doc.find('tr').each(function () {
        const rowText = $(this).text().replace(/\s+/g, ' ').trim();
        const m = rowText.match(/(?:Wall|Mauer).*?(\d{1,2})/i);
        if (m && wallFromTable === null) wallFromTable = parseInt(m[1],10);
      });
      const wall = wallFromTable !== null ? wallFromTable : (wallTextMatch ? parseInt(wallTextMatch[1],10) : null);
      fgReportDebugLog(
        'Ziel ' + (targetCoord || '?') +
        ' · Report-ID ' + (reportId || '?') +
        ' · Detailseite geladen ' + (text.length > 500 ? '✓' : '✗') +
        ' · Spionage ' + (hasSpy ? '✓' : '✗') +
        ' · Gebäudedaten ' + (hasBuildings ? '✓' : '✗') +
        ' · Wall gefunden ' + (wall !== null ? ('✓ ('+wall+')') : '✗')
      );
      return wall;
    } catch (e) {
      fgReportDebugLog('Fehler beim Auswerten von Report ' + (reportId || '?') + ': ' + e.message);
      return null;
    }
  };

const fgWallbreakerStatusLabel = function (status) {
    if (status === 'prepared') return '🔵 vorbereitet';
    if (status === 'waiting_report') return '🟣 wartet auf neue Daten';
    if (status === 'needs_replan') return '🔄 neu planen';
    if (status === 'cleared') return '✅ erledigt';
    return '🟡 geplant';
  };

  const fgMarkWallbreakerPrepared = function (targetId) {
    const state = fgReadIntegratedPlan();
    const list = Array.isArray(state.wallbreakers) ? state.wallbreakers : [];
    list.forEach(function (entry) {
      if (String(entry.targetId) === String(targetId)) {
        entry.status = 'prepared';
        entry.preparedAt = Date.now();
        entry.updatedAt = Date.now();
      }
    });
    state.wallbreakers = list;
    state.updatedAt = Date.now();
    fgWriteIntegratedPlan(state);
  };

  const fgMarkWallbreakerSent = function (targetId) {
    const state = fgReadIntegratedPlan();
    const list = Array.isArray(state.wallbreakers) ? state.wallbreakers : [];
    list.forEach(function (entry) {
      if (String(entry.targetId) === String(targetId)) {
        entry.status = 'waiting_report';
        entry.sentAt = Date.now();
        entry.updatedAt = Date.now();
      }
    });
    state.wallbreakers = list;
    state.updatedAt = Date.now();
    fgWriteIntegratedPlan(state);
  };

  const fgUpdateWallbreakerStatus = function (targetId, status) {
    const state = fgReadIntegratedPlan();
    const list = Array.isArray(state.wallbreakers) ? state.wallbreakers : [];
    list.forEach(function (entry) {
      if (String(entry.targetId) === String(targetId)) {
        entry.status = status;
        if (status === 'prepared') entry.preparedAt = Date.now();
        if (status === 'waiting_report') entry.sentAt = Date.now();
        entry.updatedAt = Date.now();
      }
    });
    state.wallbreakers = list;
    state.updatedAt = Date.now();
    fgWriteIntegratedPlan(state);
  };

  const fgGetActiveWallbreakers = function () {
    const state = fgReadIntegratedPlan();
    const list = Array.isArray(state.wallbreakers) ? state.wallbreakers : [];
    return list.filter(function (entry) {
      return entry &&
        entry.status !== 'cleared' &&
        entry.status !== 'needs_replan';
    });
  };

  const fgParseFarmTargetStates = function (pages) {
    let rowsHtml = '';
    pages.forEach(function (page) {
      if (page && page.plunder_list !== undefined) rowsHtml += page.plunder_list;
      else if (typeof page === 'string') rowsHtml += page;
    });

    const states = {};
    const coordRegex = /[0-9]{1,3}\|[0-9]{1,3}/;

    ($.parseHTML(rowsHtml) || []).forEach(function (node) {
      const $row = $(node);
      if (!$row.is('tr')) return;
      const $cells = $row.find('td');
      if ($cells.length < 8) return;

      const $villageLink = $cells.eq(3).find('a').first();
      const coordMatch = ($villageLink.text() || '').match(coordRegex);
      if (!coordMatch) return;

      const $action = $cells.last().find('a').last();
      const targetId = parseInt(fgGetUrlParam('target', $action.attr('href') || ''), 10);
      if (!Number.isFinite(targetId)) return;

      const wallText = $cells.eq(6).text().trim();
      states[String(targetId)] = {
        targetId: targetId,
        coord: coordMatch[0],
        wall: wallText,
        wallLevel: /^\d+$/.test(wallText) ? parseInt(wallText, 10) : null
      };
    });

    return states;
  };

  const fgSmartRefreshIntegratedPlan = function (faPages) {
    const state = fgReadIntegratedPlan();
    const knownCoords = fgParseKnownFarmCoords(faPages);
    const targetStates = fgParseFarmTargetStates(faPages);
    const scouts = Array.isArray(state.scouts) ? state.scouts : [];
    const wallbreakers = Array.isArray(state.wallbreakers) ? state.wallbreakers : [];
    let clearedScouts = 0;
    let clearedWalls = 0;
    let changedWalls = 0;

    scouts.forEach(function (entry) {
      if (entry.status !== 'cleared' && knownCoords[String(entry.targetCoord)]) {
        entry.status = 'cleared';
        entry.completedReason = 'known_in_farm_assistant';
        entry.updatedAt = Date.now();
        clearedScouts++;
      }
    });

    wallbreakers.forEach(function (entry) {
      if (entry.status === 'cleared') return;
      const current = targetStates[String(entry.targetId)];
      if (!current) return;

      if (current.wallLevel === 0) {
        entry.status = 'cleared';
        entry.completedReason = 'wall_zero';
        entry.updatedAt = Date.now();
        clearedWalls++;
      } else if (
        current.wallLevel !== null &&
        parseInt(entry.wall, 10) !== current.wallLevel
      ) {
        entry.wall = current.wallLevel;
        entry.units = fgGetWallbreakerUnits(current.wallLevel);
        entry.status = 'needs_replan';
        entry.replanReason = 'wall_changed';
        entry.updatedAt = Date.now();
        changedWalls++;
      }
    });

    state.scouts = scouts;
    state.wallbreakers = wallbreakers;
    if (!scouts.some(function (entry) { return entry && entry.status !== 'cleared'; })) {
      state.scoutEnabled = false;
    }
    state.lastSmartRefresh = Date.now();
    state.updatedAt = Date.now();
    fgWriteIntegratedPlan(state);

    return {
      clearedScouts: clearedScouts,
      clearedWalls: clearedWalls,
      changedWalls: changedWalls
    };
  };

  const fgBuildSmartRefreshMessage = function (cleanup) {
    const parts = [];
    if (cleanup.clearedScouts) parts.push(cleanup.clearedScouts + ' Späherziel(e) übernommen');
    if (cleanup.clearedWalls) parts.push(cleanup.clearedWalls + ' Mauerziel(e) freigegeben');
    if (cleanup.changedWalls) parts.push(cleanup.changedWalls + ' Mauerziel(e) neu bewerten');
    return parts.join(' · ');
  };


  const fgLoadSharedFAPages = function (onProgress) {
    const options = getStoredOptions();
    const maxPages = Math.max(1, Math.min(50, parseInt(options.optionFAPages, 10) || 20));
    return fgFetchFarmAssistantPages(maxPages).then(function (urls) {
      return fgFetchSequential(urls, onProgress);
    });
  };

  const fgGetTroopReserve = function () {
    const options = getStoredOptions();
    return {
      enabled: options.reserveEnabled === true,
      spear: Math.max(0, parseInt(options.reserveSpear, 10) || 0),
      sword: Math.max(0, parseInt(options.reserveSword, 10) || 0),
      axe: Math.max(0, parseInt(options.reserveAxe, 10) || 0),
      spy: Math.max(0, parseInt(options.reserveSpy, 10) || 0),
      light: Math.max(0, parseInt(options.reserveLight, 10) || 0),
      ram: Math.max(0, parseInt(options.reserveRam, 10) || 0)
    };
  };

  const fgReserveUnitsObject = function (units) {
    const reserve = fgGetTroopReserve();
    const result = Object.assign({}, units || {});
    if (!reserve.enabled) return result;
    ['spear', 'sword', 'axe', 'spy', 'light', 'ram'].forEach(function (unit) {
      result[unit] = Math.max(0, (parseInt(result[unit], 10) || 0) - reserve[unit]);
    });
    return result;
  };

  const fgApplyFarmTroopReserve = function (data) {
    const reserve = fgGetTroopReserve();
    if (!reserve.enabled) return data;

    const filteredUnits = game_data.units.filter(function (unit) {
      return ['ram', 'catapult', 'knight', 'snob', 'militia'].indexOf(unit) === -1;
    });

    const reserveByUnit = {
      spear: reserve.spear,
      sword: reserve.sword,
      axe: reserve.axe,
      spy: reserve.spy,
      light: reserve.light
    };

    Object.keys(data.villages || {}).forEach(function (coord) {
      const village = data.villages[coord];
      Object.keys(reserveByUnit).forEach(function (unit) {
        const index = filteredUnits.indexOf(unit);
        if (index === -1) return;
        village.units[index] = Math.max(
          0,
          (parseInt(village.units[index], 10) || 0) - reserveByUnit[unit]
        );
      });
    });

    data.troopReserve = reserve;
    return data;
  };

  const fgApplyIntegratedReservations = function (data) {
    const reservations = fgGetActiveWallbreakers();
    const scoutReservations = fgGetActiveScouts();
    const blockedTargets = {};
    const reservedByVillage = {};

    reservations.forEach(function (entry) {
      blockedTargets[String(entry.targetCoord)] = true;
      if (!reservedByVillage[entry.originId]) {
        reservedByVillage[entry.originId] = { axe: 0, ram: 0, spy: 0 };
      }
      reservedByVillage[entry.originId].axe += parseInt(entry.units.axe, 10) || 0;
      reservedByVillage[entry.originId].ram += parseInt(entry.units.ram, 10) || 0;
      reservedByVillage[entry.originId].spy += parseInt(entry.units.spy, 10) || 0;
    });

    const filteredUnits = game_data.units.filter(function (unit) {
      return ['ram', 'catapult', 'knight', 'snob', 'militia'].indexOf(unit) === -1;
    });
    const axeIndex = filteredUnits.indexOf('axe');
    const spyIndex = filteredUnits.indexOf('spy');

    scoutReservations.forEach(function (entry) {
      if (!reservedByVillage[entry.originId]) {
        reservedByVillage[entry.originId] = { axe: 0, ram: 0, spy: 0 };
      }
      reservedByVillage[entry.originId].spy += 1;
    });

    Object.keys(data.villages || {}).forEach(function (coord) {
      const village = data.villages[coord];
      const reserved = reservedByVillage[village.id];
      if (!reserved) return;

      if (axeIndex !== -1) {
        village.units[axeIndex] = Math.max(0, (village.units[axeIndex] || 0) - reserved.axe);
      }
      if (spyIndex !== -1) {
        village.units[spyIndex] = Math.max(0, (village.units[spyIndex] || 0) - reserved.spy);
      }
    });

    Object.keys(data.farms.farms || {}).forEach(function (coord) {
      if (blockedTargets[String(coord)]) delete data.farms.farms[coord];
    });

    data.integration = {
      wallbreakers: reservations,
      scouts: scoutReservations,
      blockedTargets: Object.keys(blockedTargets).length,
      reservedByVillage: reservedByVillage
    };

    return data;
  };

  const fgScoutSentKey = function () {
    return 'farmGod_scout_sent_' + game_data.world + '_' + game_data.player.id;
  };

  const fgReadScoutSent = function () {
    try {
      return JSON.parse(localStorage.getItem(fgScoutSentKey()) || '{}');
    } catch (e) {
      return {};
    }
  };

  const fgWriteScoutSent = function (data) {
    localStorage.setItem(fgScoutSentKey(), JSON.stringify(data || {}));
  };

  const fgParseKnownFarmCoords = function (pages) {
    let rowsHtml = '';
    pages.forEach(function (page) {
      if (page && page.plunder_list !== undefined) rowsHtml += page.plunder_list;
      else if (typeof page === 'string') rowsHtml += page;
    });

    const coords = {};
    const coordRegex = /[0-9]{1,3}\|[0-9]{1,3}/g;
    const parsed = $.parseHTML(rowsHtml) || [];

    $(parsed).each(function () {
      const $row = $(this);
      if (!$row.is('tr')) return;
      const matches = ($row.text() || '').match(coordRegex) || [];
      matches.forEach(function (coord) {
        coords[coord] = true;
      });
    });

    return coords;
  };

  const fgAssignScoutTargets = function (targets, villages) {
    const remainingSpy = {};
    const reserve = fgGetTroopReserve();
    villages.forEach(function (v) {
      const available = parseInt(v.units.spy, 10) || 0;
      remainingSpy[v.id] = reserve.enabled
        ? Math.max(0, available - reserve.spy)
        : available;
    });

    const ordered = targets.slice().sort(function (a, b) {
      return a.bestDistance - b.bestDistance;
    });

    ordered.forEach(function (target) {
      const candidates = villages
        .filter(function (v) {
          return (remainingSpy[v.id] || 0) > 0;
        })
        .map(function (v) {
          return {
            village: v,
            distance: fgDistanceCoords(v.coord, target.coord)
          };
        })
        .sort(function (a, b) {
          return a.distance - b.distance;
        });

      if (candidates.length) {
        target.origin = candidates[0].village;
        target.originDistance = candidates[0].distance;
        target.possible = true;
        remainingSpy[target.origin.id] -= 1;
      } else {
        target.origin = null;
        target.originDistance = null;
        target.possible = false;
      }
    });

    return {
      items: targets,
      remainingSpy: remainingSpy
    };
  };

  const fgSaveScoutReservations = function (items) {
    const scouts = items
      .filter(function (item) {
        return item.possible && item.origin;
      })
      .map(function (item) {
        return {
          targetId: item.id,
          targetCoord: item.coord,
          originId: item.origin.id,
          originCoord: item.origin.coord,
          originName: item.origin.name,
          units: { spy: 1 },
          status: 'planned',
          createdAt: Date.now()
        };
      });

    const state = fgReadIntegratedPlan();
    state.scouts = scouts;
    state.scoutEnabled = scouts.length > 0;
    state.updatedAt = Date.now();
    fgWriteIntegratedPlan(state);
    return scouts;
  };

  const fgUpdateScoutStatus = function (targetId, status) {
    const state = fgReadIntegratedPlan();
    const list = Array.isArray(state.scouts) ? state.scouts : [];
    list.forEach(function (entry) {
      if (String(entry.targetId) === String(targetId)) {
        entry.status = status;
        entry.updatedAt = Date.now();
      }
    });
    state.scouts = list;
    state.updatedAt = Date.now();
    fgWriteIntegratedPlan(state);
  };

  const fgIsScoutPlanEnabled = function () {
    const state = fgReadIntegratedPlan();
    return state.scoutEnabled === true;
  };

  const fgSetScoutPlanEnabled = function (enabled) {
    const state = fgReadIntegratedPlan();
    state.scoutEnabled = !!enabled;
    state.updatedAt = Date.now();
    fgWriteIntegratedPlan(state);
  };

  const fgGetStoredScouts = function () {
    const state = fgReadIntegratedPlan();
    const list = Array.isArray(state.scouts) ? state.scouts : [];
    return list.filter(function (entry) {
      return entry && entry.status !== 'cleared';
    });
  };

  const fgGetActiveScouts = function () {
    if (!fgIsScoutPlanEnabled()) return [];
    return fgGetStoredScouts();
  };

  const fgBuildScoutCommandUrl = function (item) {
    if (!item.origin) return '#';
    return game_data.link_base_pure +
      'place&village=' + item.origin.id +
      '&target=' + item.id +
      '&spy=1';
  };

  const fgBuildScoutPlanHtml = function (items, radius, knownCount) {
    const sent = fgReadScoutSent();
    const esc = function (value) {
      return $('<div>').text(String(value == null ? '' : value)).html();
    };

    const possible = items.filter(function (x) { return x.possible; }).length;
    const impossible = items.length - possible;

    let html = '<div class="fgScoutSummary">' +
      '<div><strong>' + knownCount + '</strong><span>bereits im Farm-Assistenten</span></div>' +
      '<div><strong>' + items.length + '</strong><span>fehlende BBs ≤ ' + radius + ' Felder</span></div>' +
      '<div><strong>' + possible + '</strong><span>mit Späher planbar</span></div>' +
      '<div><strong>' + impossible + '</strong><span>kein Späher frei</span></div>' +
      '</div>';

    if (!items.length) {
      return html + '<div class="fgBarbNote">Innerhalb der gewählten Reichweite fehlen aktuell keine Barbarendörfer im Farm-Assistenten.</div>';
    }

    html += '<div class="fgScoutTableWrap"><table class="vis fgScoutTable" width="100%">' +
      '<tr><th>Neues BB</th><th>Ausgangsdorf</th><th>Distanz</th><th>Späher</th><th>Aktion</th></tr>';

    items.forEach(function (item) {
      const isSent = !!sent[item.id];

      let origin = '<span class="fgWallImpossible">Kein Späher verfügbar</span>';
      let action = '<span class="fgWallImpossible">Nicht möglich</span>';

      if (item.possible && item.origin) {
        origin = '<b>' + esc(item.origin.name) + '</b><br><span>' + esc(item.origin.coord) + '</span>';
        action = '<a class="btn fgScoutPrepare' + (isSent ? ' btn-confirm-yes' : '') + '"' +
          ' href="' + fgBuildScoutCommandUrl(item) + '"' +
          ' target="_blank" rel="noopener noreferrer"' +
          ' data-target="' + item.id + '">' +
          (isSent ? 'Vorbereitet ✓' : '1 Späher vorbereiten') +
          '</a>';
      }

      html += '<tr class="fgScoutRow' +
        (isSent ? ' fgScoutSent' : '') +
        (!item.possible ? ' fgWallNoTroops' : '') +
        '" data-target="' + item.id + '">' +
        '<td><b>' + esc(item.coord) + '</b><br><span>' + esc(item.points) + ' Punkte</span></td>' +
        '<td>' + origin + '</td>' +
        '<td>' + (item.possible ? item.originDistance.toFixed(2) + ' Felder' : item.bestDistance.toFixed(2) + ' Felder') + '</td>' +
        '<td><img src="/graphic/unit/unit_spy.png" alt="Späher"> 1</td>' +
        '<td>' + action + '</td>' +
        '</tr>';
    });

    html += '</table></div>' +
      '<div class="fgBarbNote"><b>So funktioniert es:</b> FarmGod+ nimmt nur Barbarendörfer, die in den Weltdaten existieren, aber auf den gelesenen Farm-Assistent-Seiten noch nicht auftauchen. Pro Ziel wird genau 1 Späher aus dem nächstgelegenen geeigneten Dorf eingeplant. Die Reservierung gilt nur, solange „BB-Erschließung“ aktiv ist. Im pausierten Zustand bleiben die Ziele gespeichert, aber die Späher stehen dem normalen Farmplan vollständig zur Verfügung.</div>';

    return html;
  };

  const fgBindScoutResultEvents = function () {
    $('.fgScoutPrepare')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const target = String($(this).data('target'));
        const sent = fgReadScoutSent();
        sent[target] = Date.now();
        fgWriteScoutSent(sent);
        fgUpdateScoutStatus(target, 'prepared');

        $(this)
          .addClass('btn-confirm-yes')
          .text('Vorbereitet ✓')
          .closest('.fgScoutRow')
          .addClass('fgScoutSent');
      });
  };

  const runScoutDiscovery = function () {
    const currentOptions = readOptionsFromDialog();
    const radius = Math.max(1, Math.min(100, currentOptions.optionDistance || 8));
    const maxPages = Math.max(1, Math.min(50, currentOptions.optionFAPages || 20));
    localStorage.setItem('farmGod_options', JSON.stringify(currentOptions));

    const $result = $('.fgScoutResult');
    $('.fgScoutAnalyze').prop('disabled', true).val('Analysiere …');
    $result
      .html('<div class="fgBarbLoading">' + UI.Throbber[0].outerHTML +
        '<span class="fgScoutProgressText">Weltdaten und Farm-Assistent werden verglichen …</span></div>')
      .show();

    let worldVillages = null;
    let knownCoords = null;

    return $.when(
      $.get('/map/village.txt'),
      fgFetchFarmAssistantPages(maxPages).then(function (urls) {
        return fgFetchSequential(urls, function (done, total) {
          $('.fgScoutProgressText').text('Farm-Assistent wird gelesen: ' + done + ' / ' + total);
        });
      }),
      fgFetchOwnVillageTroops()
    )
      .then(function (worldResult, faPages, ownVillages) {
        const cleanup = fgSmartRefreshIntegratedPlan(faPages);
        if (cleanup.clearedScouts || cleanup.clearedWalls || cleanup.changedWalls) {
          UI.SuccessMessage('Gesamtplan aktualisiert: ' + fgBuildSmartRefreshMessage(cleanup), 2200);
        }

        const rawWorld = Array.isArray(worldResult) ? worldResult[0] : worldResult;
        worldVillages = parseVillageTxt(rawWorld);
        knownCoords = fgParseKnownFarmCoords(faPages);

        const barbs = worldVillages.filter(function (v) {
          return v.playerId === 0;
        });

        const ownById = {};
        ownVillages.forEach(function (v) {
          ownById[v.id] = v;
        });

        const candidates = [];

        barbs.forEach(function (barb) {
          if (knownCoords[barb.coord]) return;

          let bestDistance = Infinity;
          ownVillages.forEach(function (origin) {
            const d = fgDistanceCoords(origin.coord, barb.coord);
            if (d < bestDistance) bestDistance = d;
          });

          if (bestDistance <= radius) {
            candidates.push({
              id: barb.id,
              coord: barb.coord,
              points: barb.points,
              bestDistance: bestDistance
            });
          }
        });

        candidates.sort(function (a, b) {
          return a.bestDistance - b.bestDistance;
        });

        $('.fgScoutProgressText').text('Späher werden auf eigene Dörfer verteilt …');

        const assignment = fgAssignScoutTargets(candidates, ownVillages);
        const reservations = fgSaveScoutReservations(assignment.items);

        const totalSpy = ownVillages.reduce(function (sum, village) {
          return sum + (parseInt(village.units.spy, 10) || 0);
        }, 0);
        const spyVillages = ownVillages.filter(function (village) {
          return (parseInt(village.units.spy, 10) || 0) > 0;
        }).length;

        $result.html(
          '<div class="fgTroopDiagnostic"><b>Erkannte Späher:</b> ' +
          totalSpy + ' in ' + spyVillages + ' von ' + ownVillages.length +
          ' Dörfern.</div>' +
          fgBuildScoutPlanHtml(
          assignment.items,
          radius,
          Object.keys(knownCoords).length
        ));

        if (reservations.length) {
          $result.prepend(
            '<div class="fgIntegrationNotice"><b>Gemeinsamer Plan erweitert:</b> ' +
            reservations.length +
            ' Späher sind jetzt für neue Barbarendörfer reserviert.</div>'
          );
        }

        fgBindScoutResultEvents();
        fgUpdateScoutPlanControl();
      })
      .catch(function (error) {
        console.error('FarmGod+ scout discovery error:', error);
        $result.html('<div class="fgBarbError">Die BB-Erschließung konnte nicht erstellt werden.</div>');
        UI.ErrorMessage('FarmGod+ konnte die fehlenden Barbarendörfer nicht ermitteln.');
      })
      .always(function () {
        $('.fgScoutAnalyze').prop('disabled', false).val('Fehlende BBs finden');
      });
  };

  const fgWallbreakerSentKey = function () {
    return 'farmGod_wallbreaker_sent_' + game_data.world + '_' + game_data.player.id;
  };

  const fgReadWallbreakerSent = function () {
    try {
      return JSON.parse(localStorage.getItem(fgWallbreakerSentKey()) || '{}');
    } catch (e) {
      return {};
    }
  };

  const fgWriteWallbreakerSent = function (data) {
    localStorage.setItem(fgWallbreakerSentKey(), JSON.stringify(data));
  };

  const fgBuildWallbreakerCommandUrl = function (item) {
    const units = fgGetWallbreakerUnits(item.wall);
    if (!item.origin) return '#';
    return game_data.link_base_pure +
      'place&village=' + item.origin.id +
      '&target=' + item.villageId +
      '&axe=' + units.axe +
      '&ram=' + units.ram +
      '&spy=' + units.spy +
      '&wall=' + encodeURIComponent(item.wall);
  };

  const fgBuildWallbreakerHtml = function (items) {
    const state = fgReadIntegratedPlan();
    const stored = Array.isArray(state.wallbreakers) ? state.wallbreakers : [];
    const storedByTarget = {};
    stored.forEach(function (entry) {
      storedByTarget[String(entry.targetId)] = entry;
    });

    const esc = function (value) {
      return $('<div>').text(String(value == null ? '' : value)).html();
    };

    const possibleCount = items.filter(function (x) { return x.possible; }).length;
    const impossibleCount = items.length - possibleCount;
    const waitingCount = stored.filter(function (x) {
      return x && x.status === 'waiting_report';
    }).length;

    let html = '<div class="fgWallSummary">' +
      '<div><strong>' + items.length + '</strong><span>Mauerziele gefunden</span></div>' +
      '<div><strong>' + possibleCount + '</strong><span>mit Truppen planbar</span></div>' +
      '<div><strong>' + waitingCount + '</strong><span>warten auf neue Daten</span></div>' +
      '</div>';

    if (!items.length) {
      return html + '<div class="fgBarbNote">Keine passenden Barbarendörfer mit Mauer in den gelesenen Farm-Assistent-Seiten gefunden.</div>';
    }

    html += '<div class="fgWallTableWrap"><table class="vis fgWallTable" width="100%">' +
      '<tr><th>Ziel</th><th>Mauer</th><th>Benötigt</th><th>Ausgangsdorf</th><th>Distanz</th><th>Status / Aktion</th></tr>';

    items.forEach(function (item) {
      const units = fgGetWallbreakerUnits(item.wall);
      const storedEntry = storedByTarget[String(item.villageId)];
      const status = storedEntry ? storedEntry.status : 'planned';

      let originHtml = '–';
      let actionHtml = '';

      if (item.possible && item.origin) {
        originHtml =
          '<b>' + esc(item.origin.name) + '</b><br>' +
          '<span>' + esc(item.origin.coord) + '</span>';

        if (status === 'waiting_report') {
          actionHtml =
            '<span class="fgWallLife fgWallLife-waiting_report">' +
            fgWallbreakerStatusLabel(status) +
            '</span><br><span class="fgWallLifeHint">„Plan aktualisieren“ prüft auf neue Mauerdaten.</span>';
        } else if (status === 'prepared') {
          actionHtml =
            '<span class="fgWallLife fgWallLife-prepared">' +
            fgWallbreakerStatusLabel(status) +
            '</span><br>' +
            '<button type="button" class="btn fgWallMarkSent" data-target="' +
            item.villageId + '">Als gesendet markieren</button>';
        } else {
          actionHtml =
            '<span class="fgWallLife fgWallLife-planned">' +
            fgWallbreakerStatusLabel('planned') +
            '</span><br>' +
            '<a class="btn fgWallPrepare" href="' +
            fgBuildWallbreakerCommandUrl(item) +
            '" target="_blank" rel="noopener noreferrer" data-target="' +
            item.villageId + '">Angriff vorbereiten</a>';
        }
      } else {
        const closest = item.closestOrigin
          ? '<br><span>am ehesten: ' + esc(item.closestOrigin.name) + ' (' + esc(item.closestOrigin.coord) + ')</span>'
          : '';
        originHtml = '<span class="fgWallImpossible">Kein geeignetes Dorf</span>' + closest;
        actionHtml =
          '<span class="fgWallImpossible"><b>Nicht möglich</b><br>Fehlt: ' +
          esc(item.missing || 'Truppen') +
          '</span>';
      }

      html += '<tr class="fgWallRow' +
        (!item.possible ? ' fgWallNoTroops' : '') +
        '" data-target="' + item.villageId + '">' +
        '<td><b>' + esc(item.coord) + '</b></td>' +
        '<td><b>' + esc(item.wall) + '</b></td>' +
        '<td>' + units.axe + ' Axt · ' + units.ram + ' Rammen · ' + units.spy + ' Späher</td>' +
        '<td>' + originHtml + '</td>' +
        '<td>' + (item.possible ? item.originDistance.toFixed(2) + ' Felder' : '–') + '</td>' +
        '<td>' + actionHtml + '</td>' +
        '</tr>';
    });

    html += '</table></div>' +
      '<div class="fgBarbNote"><b>Mauerbrecher-Lebenszyklus:</b> geplant → vorbereitet → als gesendet markieren → warten auf neue Daten. Erkennt FarmGod+ Mauer 0, wird das Ziel erledigt und wieder für normales Farmen freigegeben. Ändert sich die Mauerstufe, wird der Mauerbrecher zur Neuberechnung markiert.</div>';

    return html;
  };

  const fgBindWallbreakerResultEvents = function () {
    $('.fgWallPrepare')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const target = String($(this).data('target'));
        fgMarkWallbreakerPrepared(target);

        $(this)
          .replaceWith(
            '<button type="button" class="btn fgWallMarkSent" data-target="' +
            target + '">Als gesendet markieren</button>'
          );

        const $cell = $('.fgWallRow[data-target="' + target + '"] td').last();
        $cell.prepend(
          '<span class="fgWallLife fgWallLife-prepared">' +
          fgWallbreakerStatusLabel('prepared') + '</span><br>'
        );
        fgBindWallbreakerResultEvents();
      });

    $('.fgWallMarkSent')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const target = String($(this).data('target'));
        fgMarkWallbreakerSent(target);

        const $cell = $(this).closest('td');
        $cell.html(
          '<span class="fgWallLife fgWallLife-waiting_report">' +
          fgWallbreakerStatusLabel('waiting_report') +
          '</span><br><span class="fgWallLifeHint">„Plan aktualisieren“ prüft auf neue Mauerdaten.</span>'
        );

        UI.SuccessMessage('Mauerbrecher als gesendet markiert.', 1200);
      });

    $('.fgWallReset')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        localStorage.removeItem(fgWallbreakerSentKey());
        fgClearIntegratedPlan();
        localStorage.removeItem(fgScoutSentKey());
        $('.fgWallRow').removeClass('fgWallSent');
        $('.fgScoutRow').removeClass('fgScoutSent');
        $('.fgScoutPrepare').removeClass('btn-confirm-yes').text('1 Späher vorbereiten');
        $('.fgWallPrepare').removeClass('btn-confirm-yes').text('Angriff vorbereiten');
        fgUpdateScoutPlanControl();
        UI.SuccessMessage('Gemeinsamer Plan zurückgesetzt.', 1200);
      });
  };

  const runWallbreakerAnalysis = function () {
    const currentOptions = readOptionsFromDialog();
    const maxPages = Math.max(1, Math.min(50, currentOptions.optionFAPages || 20));
    localStorage.setItem('farmGod_options', JSON.stringify(currentOptions));

    const $result = $('.fgWallbreakerResult');
    $('.fgWallAnalyze').prop('disabled', true).val('Analysiere …');
    $result
      .html('<div class="fgBarbLoading">' + UI.Throbber[0].outerHTML + '<span class="fgWallProgressText">Farm-Assistent wird gelesen …</span></div>')
      .show();

    return fgFetchFarmAssistantPages(maxPages)
      .then(function (urls) {
        return fgFetchSequential(urls, function (done, total) {
          $('.fgWallProgressText').text('Farm-Assistent wird gelesen: ' + done + ' / ' + total);
        });
      })
      .then(function (pages) {
        const cleanup = fgSmartRefreshIntegratedPlan(pages);
        if (cleanup.clearedScouts || cleanup.clearedWalls || cleanup.changedWalls) {
          UI.SuccessMessage('Gesamtplan aktualisiert: ' + fgBuildSmartRefreshMessage(cleanup), 2200);
        }

        const items = fgParseWallbreakerRows(pages);
        $('.fgWallProgressText').text('Verfügbare Truppen werden geprüft …');

        return fgFetchOwnVillageTroops().then(function (villages) {
          if (!villages.length) {
            throw new Error('Keine eigenen Dörfer/Truppen aus der Dorfübersicht lesbar.');
          }

          const assignment = fgAssignWallbreakers(items, villages);
          const reservations = fgSaveWallbreakerReservations(assignment.items);
          $result.html(fgBuildWallbreakerHtml(assignment.items));
          if (reservations.length) {
            $result.prepend('<div class="fgIntegrationNotice"><b>Gemeinsamer Plan aktiv:</b> ' +
              reservations.length +
              ' Mauerbrecher reservieren jetzt Truppen und Ziele für den normalen Farmplan.</div>');
          }
          fgBindWallbreakerResultEvents();
        });
      })
      .catch(function (error) {
        console.error('FarmGod+ wallbreaker error:', error);
        $result.html('<div class="fgBarbError">Die Mauerbrecher-Analyse konnte nicht geladen werden.</div>');
        UI.ErrorMessage('FarmGod+ konnte den Farm-Assistenten nicht auswerten.');
      })
      .always(function () {
        $('.fgWallAnalyze').prop('disabled', false).val('Mauerziele analysieren');
      });
  };

  const fgUpdateScoutPlanControl = function () {
    const stored = fgGetStoredScouts();
    const enabled = fgIsScoutPlanEnabled();
    const $button = $('.fgScoutToggle');

    if (!stored.length) {
      $button.prop('disabled', true).val('Kein Späher-Plan');
      $('.fgScoutPlanState').html('<b>Status:</b> Noch kein Späher-Plan gespeichert.');
      return;
    }

    $button.prop('disabled', false).val(
      enabled ? 'BB-Erschließung pausieren' : 'BB-Erschließung aktivieren'
    );

    $('.fgScoutPlanState').html(
      '<b>Status:</b> ' +
      (enabled
        ? '<span class="fgStateActive">AKTIV – ' + stored.length + ' Späher reserviert</span>'
        : '<span class="fgStatePaused">PAUSIERT – keine Späher reserviert</span>')
    );
  };

  const fgRenderIntegratedStatus = function () {
    $('.fgIntegratedStatus').html(fgBuildIntegratedStatusHtml());
  };

  const fgRefreshIntegratedPlan = function () {
    const $button = $('.fgPlanRefresh');
    const originalHtml = $button.html();

    $button.prop('disabled', true).html('<span class="fgActionIcon fgSpin">↻</span><span>Aktualisiere …</span>');
    $('.fgIntegratedStatus').html(
      '<div class="fgSharedStatus"><b>Gesamtplan:</b> Farm-Assistent wird geprüft …</div>'
    );

    const options = readOptionsFromDialog();
    localStorage.setItem('farmGod_options', JSON.stringify(options));

    return fgLoadSharedFAPages(function (done, total) {
      $button.html('<span class="fgActionIcon fgSpin">↻</span><span>Aktualisiere ' + done + ' / ' + total + ' …</span>');
    })
      .then(function (pages) {
        const cleanup = fgSmartRefreshIntegratedPlan(pages);
        fgRenderIntegratedStatus();

        if (cleanup.clearedScouts || cleanup.clearedWalls || cleanup.changedWalls) {
          UI.SuccessMessage(
            'Plan aktualisiert: ' + fgBuildSmartRefreshMessage(cleanup),
            2200
          );
        } else {
          UI.SuccessMessage('Plan ist aktuell – keine Änderungen gefunden.', 1600);
        }

        return cleanup;
      })
      .catch(function (error) {
        console.error('FarmGod+ plan refresh error:', error);
        fgRenderIntegratedStatus();
        UI.ErrorMessage('FarmGod+ konnte den Gesamtplan nicht aktualisieren.');
        throw error;
      })
      .always(function () {
        $button.prop('disabled', false).html(originalHtml);
        fgRenderIntegratedStatus();
      });
  };


  // ---------------------------------------------------------------------------
  // Ziel-Lebenszyklus für den Simulations-Autopiloten
  // ---------------------------------------------------------------------------
  const FG_TARGET_RECHECK_MS = 6 * 60 * 60 * 1000;      // bewaffnete BBs: 6 h
  const FG_TARGET_SCOUT_RETRY_MS = 30 * 60 * 1000;      // unklare Verluste: 30 min
  const FG_WORLD_CACHE_MS = 5 * 60 * 1000;
  let fgWorldVillageCache = { loadedAt: 0, byCoord: {} };

  const fgTargetLifecycleKey = function () {
    return 'farmGod_target_lifecycle_' + game_data.world + '_' + game_data.player.id;
  };

  const fgReadTargetLifecycle = function () {
    try {
      const value = JSON.parse(localStorage.getItem(fgTargetLifecycleKey()) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (e) {
      return {};
    }
  };

  const fgWriteTargetLifecycle = function (state) {
    localStorage.setItem(fgTargetLifecycleKey(), JSON.stringify(state || {}));
  };

  const fgLifecycleStatusLabel = function (status) {
    if (status === 'needs_scout') return '🔎 Späherprüfung nötig';
    if (status === 'armed_bb') return '🛡️ BB mit Truppen';
    if (status === 'needs_wallbreaker') return '🔨 Mauer-Cleaner nötig';
    if (status === 'wall_waiting_report') return '🟣 Mauer-Cleaner simuliert';
    if (status === 'not_barbarian') return '🚫 kein BB mehr';
    if (status === 'safe') return '✅ farmbar';
    return '❔ unbekannt';
  };

  const fgParseLifecycleRows = function (pages) {
    let rowsHtml = '';
    (pages || []).forEach(function (page) {
      if (page && page.plunder_list !== undefined) rowsHtml += page.plunder_list;
      else if (typeof page === 'string') rowsHtml += page;
    });

    const result = {};
    const coordRegex = /[0-9]{1,3}\|[0-9]{1,3}/;
    ($.parseHTML(rowsHtml) || []).forEach(function (node) {
      const $row = $(node);
      if (!$row.is('tr')) return;
      const $cells = $row.find('td');
      if ($cells.length < 4) return;

      const $villageLink = $row.find('a[href*="screen=report"][href*="view="]').first();
      const coordMatch = (($villageLink.text() || $row.text() || '').match(coordRegex));
      if (!coordMatch) return;
      const coord = coordMatch[0];

      const dotSrc = $row.find('img[src*="graphic/dots/"]').first().attr('src') || '';
      const colorMatch = dotSrc.match(/dots\/(green|yellow|red|blue|red_blue)/);
      const color = colorMatch ? colorMatch[1] : null;
      const href = $villageLink.attr('href') || '';
      const reportId = parseInt(fgGetUrlParam('view', href), 10);

      let targetId = parseInt(String($row.attr('id') || '').replace(/\D/g, ''), 10);
      if (!Number.isFinite(targetId)) {
        const $action = $row.find('a[href*="target="]').last();
        targetId = parseInt(fgGetUrlParam('target', $action.attr('href') || ''), 10);
      }

      const wallText = $cells.length > 6 ? $cells.eq(6).text().trim() : '';
      const wallLevel = /^\d+$/.test(wallText) ? parseInt(wallText, 10) : null;

      result[coord] = {
        coord: coord,
        targetId: Number.isFinite(targetId) ? targetId : null,
        color: color,
        reportId: Number.isFinite(reportId) ? reportId : null,
        reportHref: href,
        wall: wallText,
        wallLevel: wallLevel,
        loss: color === 'yellow' || color === 'red' || color === 'red_blue'
      };
    });
    return result;
  };

  const fgGetWorldVillageMap = function () {
    const now = Date.now();
    if (fgWorldVillageCache.loadedAt && now - fgWorldVillageCache.loadedAt < FG_WORLD_CACHE_MS) {
      return Promise.resolve(fgWorldVillageCache.byCoord);
    }
    return $.get('/map/village.txt').then(function (raw) {
      const byCoord = {};
      parseVillageTxt(raw).forEach(function (v) {
        byCoord[v.coord] = v;
      });
      fgWorldVillageCache = { loadedAt: Date.now(), byCoord: byCoord };
      return byCoord;
    });
  };

  const fgParseReportWallLevel = function (html, $doc) {
    try {
      const root = $doc || $($.parseHTML(html, document, true) || []);
      const candidates = [];

      const add = function (value, source) {
        const level = parseInt(value, 10);
        if (!Number.isFinite(level) || level < 0 || level > 30) return;
        candidates.push({ level: level, source: source });
      };

      // Klassische Gebäude-Tabelle im Bericht: z. B. <td>Wall</td><td>9</td>.
      // Die deutsche Spieloberfläche kann das Gebäude trotz deutscher UI als "Wall" ausgeben.
      root.find('tr').each(function () {
        const $row = $(this);
        const $cells = $row.find('td,th');
        if ($cells.length < 2) return;

        for (let i = 0; i < $cells.length - 1; i++) {
          const buildingText = $cells.eq(i).text().replace(/\s+/g, ' ').trim();
          if (!/^(?:wall|mauer)$/i.test(buildingText)) continue;

          const levelText = $cells.eq(i + 1).text().trim();
          const match = levelText.match(/\d{1,2}/);
          if (match) add(match[0], 'report-building-table');
        }
      });

      // Zusätzlich Tabellenzellen prüfen, falls Icon/Name und Stufe in verschachtelten Elementen stehen.
      root.find('td').each(function () {
        const $cell = $(this);
        const text = $cell.text().replace(/\s+/g, ' ').trim();
        if (!/^(?:wall|mauer)$/i.test(text)) return;
        const $next = $cell.next('td');
        const match = $next.text().match(/\d{1,2}/);
        if (match) add(match[0], 'report-building-cell');
      });

      // Moderne/strukturierte Report-Varianten.
      root.find('[data-building="wall"], [data-building-name="wall"], [data-building="building_wall"]').each(function () {
        const $el = $(this);
        add($el.attr('data-level') || $el.data('level') || ($el.text().match(/\d+/) || [])[0], 'report-data');
      });

      root.find('[id*="wall"], [class*="wall"]').each(function () {
        const $el = $(this);
        const text = $el.text().trim();
        const match = text.match(/(?:^|\D)(\d{1,2})(?:\D|$)/);
        if (match) add(match[1], 'report-wall-node');
      });

      // Klassische Berichte enthalten häufig ein Gebäude-Icon building_wall.png.
      root.find('img[src*="building_wall"], img[src*="wall.png"], img[src*="wall.webp"]').each(function () {
        const $img = $(this);
        const probes = [
          $img.closest('tr').text(),
          $img.closest('td').text(),
          $img.parent().text(),
          $img.attr('title') || '',
          $img.attr('alt') || ''
        ];
        probes.forEach(function (text) {
          const nums = String(text || '').match(/\d{1,2}/g) || [];
          if (nums.length) add(nums[nums.length - 1], 'report-wall-icon');
        });
      });

      // Letzter Fallback direkt im HTML rund um eindeutige wall/building_wall-Marker.
      const raw = String(html || '');
      const regexes = [
        /building_wall[^>]{0,250}>[\s\S]{0,180}?(?:level|stufe|niveau|poziom|nivel)?[^0-9]{0,30}(\d{1,2})/ig,
        /(?:data-building|building)[^>]{0,80}["']wall["'][^>]{0,180}(?:data-level=["']?(\d{1,2})|>[^<]*?(\d{1,2}))/ig
      ];
      regexes.forEach(function (re) {
        let m;
        while ((m = re.exec(raw)) !== null) add(m[1] || m[2], 'report-html');
      });

      if (!candidates.length) return { known: false, level: null, source: null };
      // Bevorzugt den ersten strukturierten Treffer. Die Kandidaten sind absichtlich
      // in absteigender Verlässlichkeit gesammelt.
      return { known: true, level: candidates[0].level, source: candidates[0].source };
    } catch (e) {
      return { known: false, level: null, source: null };
    }
  };

  const fgParseReportDefenderUnits = function (html) {
    try {
      const doc = $.parseHTML(html, document, true) || [];
      const $doc = $(doc);
      let $row = $doc.find('#attack_info_def_units').first();
      if (!$row.length) $row = $doc.find('tr[id*="def"][id*="unit"], tr[class*="def"][class*="unit"]').first();

      let total = 0;
      let seen = 0;
      if ($row.length) {
        $row.find('td.unit-item, td').each(function () {
          const txt = $(this).text().replace(/\./g, '').replace(/\s/g, '');
          if (!/^\d+$/.test(txt)) return;
          total += parseInt(txt, 10) || 0;
          seen++;
        });
      }

      const wall = fgParseReportWallLevel(html, $doc);
      return {
        known: seen > 0,
        total: seen > 0 ? total : null,
        wallKnown: !!wall.known,
        wallLevel: wall.known ? wall.level : null,
        wallSource: wall.source || null
      };
    } catch (e) {
      return { known: false, total: null, wallKnown: false, wallLevel: null, wallSource: null };
    }
  };

  const fgFetchLifecycleReportInfo = function (row) {
    if (!row || !row.reportHref || !row.reportId) {
      return Promise.resolve({ known: false, total: null, wallKnown: false, wallLevel: null, wallSource: null });
    }
    return $.get(row.reportHref).then(function (html) {
      // Diagnose direkt an der tatsächlich geladenen Report-Detailseite.
      fgDebugReportHtml(row.reportId, html, row.coord);
      return fgParseReportDefenderUnits(html);
    }).catch(function (error) {
      fgReportDebugLog(
        'Ziel ' + (row.coord || '?') +
        ' · Report-ID ' + (row.reportId || '?') +
        ' · Detailseite laden ✗ · ' + ((error && error.status) ? ('HTTP ' + error.status) : 'Abruf fehlgeschlagen')
      );
      return { known: false, total: null, wallKnown: false, wallLevel: null, wallSource: null };
    });
  };

  const fgResolveLifecycleWallLevel = function (row, old, reportInfo) {
    if (row && Number.isFinite(parseInt(row.wallLevel, 10))) {
      return { known: true, level: parseInt(row.wallLevel, 10), source: 'farm-assistent' };
    }
    if (reportInfo && reportInfo.wallKnown && Number.isFinite(parseInt(reportInfo.wallLevel, 10))) {
      return { known: true, level: parseInt(reportInfo.wallLevel, 10), source: reportInfo.wallSource || 'bericht' };
    }
    if (old && Number.isFinite(parseInt(old.lastWallLevel, 10))) {
      return { known: true, level: parseInt(old.lastWallLevel, 10), source: 'gespeicherter-zielstatus' };
    }
    return { known: false, level: null, source: null };
  };

  const fgFarmUnitIndex = function (unit) {
    const filtered = game_data.units.filter(function (u) {
      return ['ram', 'catapult', 'knight', 'snob', 'militia'].indexOf(u) === -1;
    });
    return filtered.indexOf(unit);
  };

  const fgLifecycleActiveScoutRecords = function (state) {
    const nowSec = Math.round(lib.getCurrentServerTime() / 1000);
    const records = Array.isArray(state.scoutCommands) ? state.scoutCommands : [];
    const active = records.filter(function (x) {
      return x && Number(x.returnAt || 0) > nowSec;
    });
    state.scoutCommands = active;
    return active;
  };

  const fgApplyLifecycleScoutReservations = function (data, state) {
    const spyIndex = fgFarmUnitIndex('spy');
    if (spyIndex < 0) return;
    fgLifecycleActiveScoutRecords(state).forEach(function (entry) {
      const village = data.villages && data.villages[entry.originCoord];
      if (!village || !Array.isArray(village.units)) return;
      village.units[spyIndex] = Math.max(0, (parseInt(village.units[spyIndex], 10) || 0) - 1);
    });
  };

  const fgLifecycleAssignScout = function (target, ownVillages, state) {
    const reserve = fgGetTroopReserve();
    const active = fgLifecycleActiveScoutRecords(state);
    const activeByOrigin = {};
    active.forEach(function (x) {
      activeByOrigin[x.originId] = (activeByOrigin[x.originId] || 0) + 1;
    });

    const candidates = ownVillages.filter(function (v) {
      const total = parseInt(v.units.spy, 10) || 0;
      const available = total - (reserve.enabled ? reserve.spy : 0) - (activeByOrigin[v.id] || 0);
      return available > 0;
    }).map(function (v) {
      return { village: v, distance: fgDistanceCoords(v.coord, target.coord) };
    }).sort(function (a, b) {
      return a.distance - b.distance;
    });

    return candidates.length ? candidates[0] : null;
  };

  const fgLifecycleScoutTravel = function (originCoord, targetCoord) {
    const speeds = lib.getUnitSpeeds() || {};
    const spySpeed = Number(speeds.spy) || 9;
    const distance = fgDistanceCoords(originCoord, targetCoord);
    const nowSec = Math.round(lib.getCurrentServerTime() / 1000);
    const oneWay = Math.round(distance * spySpeed * 60);
    return {
      distance: distance,
      arrivalAt: nowSec + oneWay,
      returnAt: nowSec + oneWay * 2
    };
  };


  const fgLifecycleActiveWallbreakerRecords = function (state) {
    const nowSec = Math.round(lib.getCurrentServerTime() / 1000);
    const records = Array.isArray(state.wallbreakerCommands) ? state.wallbreakerCommands : [];
    const active = records.filter(function (x) {
      return x && Number(x.returnAt || 0) > nowSec;
    });
    state.wallbreakerCommands = active;
    return active;
  };

  const fgLifecycleWallbreakerTravel = function (originCoord, targetCoord, units) {
    const speeds = lib.getUnitSpeeds() || {};
    const used = Object.keys(units || {}).filter(function (unit) {
      return (parseInt(units[unit], 10) || 0) > 0;
    });
    let slowest = 0;
    used.forEach(function (unit) {
      slowest = Math.max(slowest, Number(speeds[unit]) || 0);
    });
    if (!slowest) slowest = Number(speeds.ram) || 30;

    const distance = fgDistanceCoords(originCoord, targetCoord);
    const nowSec = Math.round(lib.getCurrentServerTime() / 1000);
    const oneWay = Math.round(distance * slowest * 60);
    return {
      distance: distance,
      arrivalAt: nowSec + oneWay,
      returnAt: nowSec + oneWay * 2
    };
  };

  const fgLifecycleBuildAvailableWallbreakerTroops = function (ownVillages, state) {
    const reserve = fgGetTroopReserve();
    const activeWalls = fgLifecycleActiveWallbreakerRecords(state);
    const activeScouts = fgLifecycleActiveScoutRecords(state);
    const reserved = {};

    const ensure = function (id) {
      if (!reserved[id]) reserved[id] = { axe: 0, ram: 0, spy: 0 };
      return reserved[id];
    };

    activeWalls.forEach(function (entry) {
      const r = ensure(entry.originId);
      r.axe += parseInt(entry.units && entry.units.axe, 10) || 0;
      r.ram += parseInt(entry.units && entry.units.ram, 10) || 0;
      r.spy += parseInt(entry.units && entry.units.spy, 10) || 0;
    });
    activeScouts.forEach(function (entry) {
      ensure(entry.originId).spy += 1;
    });

    return ownVillages.map(function (v) {
      const r = reserved[v.id] || { axe: 0, ram: 0, spy: 0 };
      return {
        village: v,
        available: {
          axe: Math.max(0, (parseInt(v.units.axe, 10) || 0) - (reserve.enabled ? reserve.axe : 0) - r.axe),
          ram: Math.max(0, (parseInt(v.units.ram, 10) || 0) - (reserve.enabled ? reserve.ram : 0) - r.ram),
          spy: Math.max(0, (parseInt(v.units.spy, 10) || 0) - (reserve.enabled ? reserve.spy : 0) - r.spy)
        }
      };
    });
  };

  const fgLifecycleAssignWallbreaker = function (target, ownVillages, state) {
    const need = fgGetWallbreakerUnits(target.wallLevel);
    const pools = fgLifecycleBuildAvailableWallbreakerTroops(ownVillages, state);
    const candidates = pools.filter(function (entry) {
      return fgCanSupplyWallbreaker(entry.available, need);
    }).map(function (entry) {
      return {
        village: entry.village,
        available: entry.available,
        distance: fgDistanceCoords(entry.village.coord, target.coord)
      };
    }).sort(function (a, b) {
      return a.distance - b.distance;
    });

    return candidates.length ? {
      village: candidates[0].village,
      distance: candidates[0].distance,
      units: need
    } : null;
  };

  const fgApplyLifecycleWallbreakerReservations = function (data, state) {
    const active = fgLifecycleActiveWallbreakerRecords(state);
    if (!active.length) return;

    const filteredUnits = game_data.units.filter(function (unit) {
      return ['ram', 'catapult', 'knight', 'snob', 'militia'].indexOf(unit) === -1;
    });
    const axeIndex = filteredUnits.indexOf('axe');
    const spyIndex = filteredUnits.indexOf('spy');

    active.forEach(function (entry) {
      const village = data.villages && data.villages[entry.originCoord];
      if (!village || !Array.isArray(village.units)) return;
      if (axeIndex >= 0) village.units[axeIndex] = Math.max(
        0,
        (parseInt(village.units[axeIndex], 10) || 0) - (parseInt(entry.units && entry.units.axe, 10) || 0)
      );
      if (spyIndex >= 0) village.units[spyIndex] = Math.max(
        0,
        (parseInt(village.units[spyIndex], 10) || 0) - (parseInt(entry.units && entry.units.spy, 10) || 0)
      );
      // Rammen sind im normalen Farm-Datensatz absichtlich nicht enthalten.
      // Sie werden hier nur über die separate Dorfübersicht bei der Cleaner-Zuteilung reserviert.
    });
  };

  const fgRunTargetLifecycleSimulation = function (pages, data) {
    const rows = fgParseLifecycleRows(pages);
    const lifecycle = fgReadTargetLifecycle();
    lifecycle.targets = lifecycle.targets && typeof lifecycle.targets === 'object' ? lifecycle.targets : {};
    lifecycle.scoutCommands = Array.isArray(lifecycle.scoutCommands) ? lifecycle.scoutCommands : [];
    lifecycle.wallbreakerCommands = Array.isArray(lifecycle.wallbreakerCommands) ? lifecycle.wallbreakerCommands : [];
    const targets = lifecycle.targets;
    const now = Date.now();
    const summary = {
      blocked: 0,
      removed: 0,
      lossTargets: 0,
      armed: 0,
      wallTargets: 0,
      scoutPlanned: [],
      wallbreakersPlanned: [],
      released: 0
    };

    return fgGetWorldVillageMap().then(function (worldByCoord) {
      const reportChecks = [];

      Object.keys(rows).forEach(function (coord) {
        const row = rows[coord];
        const world = worldByCoord[coord];
        const isBarbarian = !!world && parseInt(world.playerId, 10) === 0;
        const old = targets[coord] || { coord: coord, createdAt: now };
        old.targetId = row.targetId || old.targetId || (world && world.id) || null;
        old.lastSeenAt = now;
        old.lastColor = row.color;
        old.lastWallText = row.wall;
        if (row.wallLevel !== null) old.lastWallLevel = row.wallLevel;

        if (!isBarbarian) {
          old.status = 'not_barbarian';
          old.nextCheckAt = null;
          old.updatedAt = now;
          targets[coord] = old;
          if (data.farms && data.farms.farms) delete data.farms.farms[coord];
          summary.removed++;
          return;
        }

        if (row.loss) {
          summary.lossTargets++;
          old.lossDetectedAt = old.lossDetectedAt || now;

          // Wenn derselbe Bericht bereits als "Mauer-Cleaner simuliert" behandelt wurde,
          // warten wir auf einen neuen Bericht / eine neue Mauerinformation und schicken
          // in der Simulation nicht bei jedem Refresh noch einen Cleaner.
          if (old.status === 'wall_waiting_report' &&
              row.reportId && row.reportId === old.wallbreakerSourceReportId) {
            targets[coord] = old;
            if (data.farms && data.farms.farms) delete data.farms.farms[coord];
            return;
          }

          old.status = old.status === 'armed_bb' ? 'armed_bb' : 'needs_scout';
          old.updatedAt = now;
          old.nextCheckAt = old.status === 'armed_bb'
            ? (old.nextCheckAt || now)
            : Math.min(old.nextCheckAt || now, now);
          targets[coord] = old;
          if (data.farms && data.farms.farms) delete data.farms.farms[coord];

          const storedWallKnown = Number.isFinite(parseInt(old.lastWallLevel, 10));
          const defenderCountKnownZero = Number(old.lastReportDefUnits) === 0;
          const wallStillUnknown = row.wallLevel === null && !storedWallKnown;
          const needsWallReinspection = defenderCountKnownZero && wallStillUnknown && old.status === 'needs_scout';

          // Temporärer Diagnose-Haken: Bei Verlustzielen immer sichtbar protokollieren,
          // ob FarmGod überhaupt eine Report-ID / Detail-URL gefunden hat.
          fgReportDebugLog(
            'Ziel ' + coord +
            ' · Zeile erkannt ✓' +
            ' · Report-ID ' + (row.reportId || '?') +
            ' · Report-Link ' + (row.reportHref ? '✓' : '✗') +
            ' · FA-Mauer ' + (row.wallLevel === null ? '?' : row.wallLevel) +
            ' · gespeicherte Mauer ' + (storedWallKnown ? parseInt(old.lastWallLevel, 10) : '?') +
            ' · gespeicherte Verteidiger ' + (old.lastReportDefUnits == null ? '?' : old.lastReportDefUnits)
          );

          // Solange die Mauer trotz 0 Verteidigern unbekannt ist, laden wir den Bericht
          // für die Diagnose bewusst erneut – auch wenn es derselbe Report wie zuvor ist.
          const shouldFetchReport = !!(row.reportId && row.reportHref && (
            row.reportId !== old.lastInspectedReportId ||
            needsWallReinspection ||
            wallStillUnknown
          ));

          if (shouldFetchReport) {
            reportChecks.push(
              fgFetchLifecycleReportInfo(row).then(function (info) {
                old.lastInspectedReportId = row.reportId;
                old.lastReportDefUnits = info.known ? info.total : null;
                if (info.wallKnown) {
                  old.lastWallLevel = info.wallLevel;
                  old.lastWallSource = info.wallSource || 'bericht';
                }

                const wall = fgResolveLifecycleWallLevel(row, old, info);
                old.resolvedWallLevel = wall.known ? wall.level : null;
                old.resolvedWallSource = wall.source;

                if (!info.known) {
                  old.status = 'needs_scout';
                  old.nextCheckAt = now;
                } else if (info.total > 0) {
                  old.status = 'armed_bb';
                  old.nextCheckAt = now;
                  old.armedDetectedAt = now;
                } else if (wall.known && wall.level > 0) {
                  old.status = 'needs_wallbreaker';
                  old.wallLevel = wall.level;
                  old.nextCheckAt = now;
                } else if (wall.known && wall.level === 0) {
                  old.status = 'safe';
                  old.nextCheckAt = null;
                  old.lastSafeReportId = row.reportId;
                  summary.released++;
                } else {
                  // 0 Verteidiger, aber auch nach Farm-Assistent + Bericht + gespeichertem
                  // Zielstatus keine sichere Mauerstufe: erst dann bleibt der Scout-Fallback.
                  old.status = 'needs_scout';
                  old.nextCheckAt = now;
                }
                old.updatedAt = Date.now();
              })
            );
          }
          return;
        }

        // Ein neuer, verlustfreier Bericht kann ein zuvor gesperrtes Ziel wieder freigeben.
        if ((old.status === 'needs_scout' ||
             old.status === 'armed_bb' ||
             old.status === 'needs_wallbreaker' ||
             old.status === 'wall_waiting_report') &&
            row.reportId && row.reportId !== old.lastSafeReportId && row.color === 'green') {
          old.status = 'safe';
          old.lastSafeReportId = row.reportId;
          old.nextCheckAt = null;
          old.updatedAt = now;
          summary.released++;
        } else if (!old.status || old.status === 'unknown') {
          old.status = 'safe';
          old.updatedAt = now;
        }
        targets[coord] = old;
      });

      return Promise.all(reportChecks).then(function () {
        // Alle dauerhaft oder vorübergehend gesperrten Ziele aus dem Farmplan entfernen.
        Object.keys(targets).forEach(function (coord) {
          const item = targets[coord];
          if (!item) return;
          if (item.status === 'not_barbarian' ||
              item.status === 'needs_scout' ||
              item.status === 'armed_bb' ||
              item.status === 'needs_wallbreaker' ||
              item.status === 'wall_waiting_report') {
            if (data.farms && data.farms.farms) delete data.farms.farms[coord];
            summary.blocked++;
            if (item.status === 'armed_bb') summary.armed++;
            if (item.status === 'needs_wallbreaker' || item.status === 'wall_waiting_report') summary.wallTargets++;
          }
        });

        fgApplyLifecycleScoutReservations(data, lifecycle);
        fgApplyLifecycleWallbreakerReservations(data, lifecycle);

        const dueScouts = Object.keys(targets).map(function (coord) {
          return targets[coord];
        }).filter(function (item) {
          if (!item || (item.status !== 'needs_scout' && item.status !== 'armed_bb')) return false;
          return !item.nextCheckAt || item.nextCheckAt <= now;
        });

        const dueWalls = Object.keys(targets).map(function (coord) {
          return targets[coord];
        }).filter(function (item) {
          return item && item.status === 'needs_wallbreaker' &&
            Number.isFinite(parseInt(item.wallLevel, 10)) &&
            parseInt(item.wallLevel, 10) > 0;
        });

        if (!dueScouts.length && !dueWalls.length) {
          lifecycle.targets = targets;
          lifecycle.updatedAt = Date.now();
          fgWriteTargetLifecycle(lifecycle);
          return summary;
        }

        return fgFetchOwnVillageTroops().then(function (ownVillages) {
          // Erst Mauer-Cleaner reservieren, danach Scouts. So kann ein bekannter
          // Mauerfall nicht aus Versehen seine Rammen/Axt/Späher an normale Checks verlieren.
          dueWalls.forEach(function (item) {
            const chosen = fgLifecycleAssignWallbreaker(item, ownVillages, lifecycle);
            if (!chosen) {
              item.lastWallbreakerError = 'nicht genug Axt/Rammen/Späher verfügbar';
              item.updatedAt = Date.now();
              return;
            }

            const travel = fgLifecycleWallbreakerTravel(chosen.village.coord, item.coord, chosen.units);
            lifecycle.wallbreakerCommands.push({
              targetId: item.targetId,
              targetCoord: item.coord,
              originId: chosen.village.id,
              originCoord: chosen.village.coord,
              wallLevel: parseInt(item.wallLevel, 10),
              units: chosen.units,
              arrivalAt: travel.arrivalAt,
              returnAt: travel.returnAt,
              simulatedAt: Math.round(lib.getCurrentServerTime() / 1000),
              sourceReportId: item.lastInspectedReportId || null
            });

            item.status = 'wall_waiting_report';
            item.lastWallbreakerAt = now;
            item.wallbreakerSourceReportId = item.lastInspectedReportId || null;
            item.updatedAt = Date.now();

            summary.wallbreakersPlanned.push({
              coord: item.coord,
              originCoord: chosen.village.coord,
              distance: travel.distance,
              arrivalAt: travel.arrivalAt,
              wallLevel: parseInt(item.wallLevel, 10),
              units: chosen.units,
              wallSource: item.resolvedWallSource || item.lastWallSource || 'unbekannt'
            });
          });

          dueScouts.forEach(function (item) {
            const chosen = fgLifecycleAssignScout(item, ownVillages, lifecycle);
            if (!chosen) {
              item.lastScoutError = 'kein Späher verfügbar';
              item.nextCheckAt = now + 10 * 60 * 1000;
              item.updatedAt = Date.now();
              return;
            }

            const travel = fgLifecycleScoutTravel(chosen.village.coord, item.coord);
            lifecycle.scoutCommands.push({
              targetId: item.targetId,
              targetCoord: item.coord,
              originId: chosen.village.id,
              originCoord: chosen.village.coord,
              arrivalAt: travel.arrivalAt,
              returnAt: travel.returnAt,
              simulatedAt: Math.round(lib.getCurrentServerTime() / 1000),
              reason: item.status
            });

            item.lastScoutAt = now;
            item.nextCheckAt = now + (item.status === 'armed_bb' ? FG_TARGET_RECHECK_MS : FG_TARGET_SCOUT_RETRY_MS);
            item.updatedAt = Date.now();
            summary.scoutPlanned.push({
              coord: item.coord,
              originCoord: chosen.village.coord,
              distance: travel.distance,
              arrivalAt: travel.arrivalAt,
              reason: item.status,
              knownDefUnits: item.lastReportDefUnits
            });
          });

          // Die soeben simulierten Sonderaktionen müssen dem aktuellen Farmplan bereits fehlen.
          fgApplyLifecycleScoutReservations(data, lifecycle);
          fgApplyLifecycleWallbreakerReservations(data, lifecycle);
          lifecycle.targets = targets;
          lifecycle.updatedAt = Date.now();
          fgWriteTargetLifecycle(lifecycle);
          return summary;
        });
      });
    });
  };

  const fgSimulationLogLifecycle = function (summary) {
    if (!summary) return;
    fgSimulationAddLog(
      'Zielpflege · gesperrt ' + summary.blocked +
      ' · Verlust-BBs ' + summary.lossTargets +
      ' · bewaffnete BBs ' + summary.armed +
      ' · Mauerziele ' + (summary.wallTargets || 0) +
      ' · kein BB mehr ' + summary.removed +
      ' · wieder freigegeben ' + summary.released
    );

    (summary.wallbreakersPlanned || []).forEach(function (item, index) {
      fgSimulationAddLog(
        '  🔨 #' + (index + 1) + ' · Mauer-Cleaner · Mauer ' + item.wallLevel +
        ' · ' + item.originCoord + ' → ' + item.coord +
        ' · ' + item.distance.toFixed(2) + ' Felder · ' +
        item.units.axe + ' Axt / ' + item.units.ram + ' Rammen / ' + item.units.spy + ' Späher' +
        ' · Mauerquelle ' + (item.wallSource || 'unbekannt') +
        ' · Ankunft ' + fgSimulationFormatArrival(item.arrivalAt)
      );
    });

    (summary.scoutPlanned || []).forEach(function (item, index) {
      const reason = item.reason === 'armed_bb' ? 'Recheck bewaffnetes BB' : 'Verlust prüfen';
      const troops = item.knownDefUnits != null ? ' · Bericht: ' + item.knownDefUnits + ' Verteidiger' : '';
      fgSimulationAddLog(
        '  🔎 #' + (index + 1) + ' · ' + reason +
        ' · ' + item.originCoord + ' → ' + item.coord +
        ' · ' + item.distance.toFixed(2) + ' Felder · Ankunft ' +
        fgSimulationFormatArrival(item.arrivalAt) + troops
      );
    });
  };

  const fgSimulationKey = function () {
    return 'farmGod_simulation_' + game_data.world + '_' + game_data.player.id;
  };

  const fgReadSimulationState = function () {
    try {
      const value = JSON.parse(localStorage.getItem(fgSimulationKey()) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (e) {
      return {};
    }
  };

  const fgWriteSimulationState = function (state) {
    localStorage.setItem(fgSimulationKey(), JSON.stringify(state || {}));
  };

  const fgSimulationRecords = function () {
    const state = fgReadSimulationState();
    const cutoff = Math.round(lib.getCurrentServerTime() / 1000) - 48 * 60 * 60;
    const records = Array.isArray(state.records) ? state.records.filter(function (x) {
      return x && Number(x.arrival) >= cutoff;
    }) : [];
    state.records = records;
    fgWriteSimulationState(state);
    return records;
  };

  const fgApplySimulationCommands = function (data) {
    fgSimulationRecords().forEach(function (entry) {
      if (!entry.targetCoord || !Number.isFinite(Number(entry.arrival))) return;
      if (!data.commands[entry.targetCoord]) data.commands[entry.targetCoord] = [];
      data.commands[entry.targetCoord].push(Number(entry.arrival));
    });
    return data;
  };

  const fgSimulationAddLog = function (text) {
    const stamp = new Date(lib.getCurrentServerTime());
    const clock = String(stamp.getHours()).padStart(2, '0') + ':' +
      String(stamp.getMinutes()).padStart(2, '0') + ':' + String(stamp.getSeconds()).padStart(2, '0');
    // Während der Diagnosephase bleibt das vollständige Protokoll erhalten.
    fgSimulationSession.log.unshift(clock + ' · ' + text);
  };

  const fgSimulationCopyLog = function () {
    const text = (fgSimulationSession.log || []).join('\n');
    if (!text) {
      UI.ErrorMessage('Das Simulationsprotokoll ist noch leer.');
      return;
    }

    const success = function () {
      UI.SuccessMessage('Vollständiges Simulationsprotokoll kopiert.', 1400);
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(success).catch(function () {
        const $tmp = $('<textarea>').val(text).css({ position: 'fixed', left: '-9999px', top: '-9999px' }).appendTo('body');
        $tmp[0].select();
        try {
          document.execCommand('copy');
          success();
        } catch (e) {
          UI.ErrorMessage('Protokoll konnte nicht automatisch kopiert werden.');
        }
        $tmp.remove();
      });
      return;
    }

    const $tmp = $('<textarea>').val(text).css({ position: 'fixed', left: '-9999px', top: '-9999px' }).appendTo('body');
    $tmp[0].select();
    try {
      document.execCommand('copy');
      success();
    } catch (e) {
      UI.ErrorMessage('Protokoll konnte nicht automatisch kopiert werden.');
    }
    $tmp.remove();
  };

  const fgSimulationFormatArrival = function (timestamp) {
    if (!Number.isFinite(Number(timestamp))) return '–';
    const d = new Date(Number(timestamp) * 1000);
    return String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');
  };

  const fgSimulationLogDiagnostics = function (plan, activeRecordCount) {
    const stats = plan.stats || {};
    const comparison = plan.comparison || {};
    const source = comparison.source === 'legacy-fallback' ? 'alter Plan (Fallback)' : 'Optimierer';
    const parts = [
      'Planquelle: ' + source,
      'Zeitkonflikte ' + (parseInt(stats.time, 10) || 0),
      'Truppen ' + (parseInt(stats.troops, 10) || 0),
      'Distanz ' + (parseInt(stats.distance, 10) || 0),
      'Rückkehr ' + (parseInt(stats.returnTime, 10) || 0),
      'Ankunft ' + (parseInt(stats.arrivalTime, 10) || 0),
      'simulierte Ankünfte aktiv ' + (parseInt(activeRecordCount, 10) || 0)
    ];
    fgSimulationAddLog('Diagnose · ' + parts.join(' · '));
  };

  const fgRenderSimulationPanel = function () {
    $('.fgSimulationPanel').remove();
    const state = fgReadSimulationState();
    if (!state.active && !fgSimulationSession.startedAt) return;

    const active = state.active === true;
    const nextText = fgSimulationSession.nextRun
      ? formatClock(fgSimulationSession.nextRun) + ':' + String(new Date(fgSimulationSession.nextRun).getSeconds()).padStart(2, '0')
      : '–';
    const lastText = fgSimulationSession.lastRun
      ? formatClock(fgSimulationSession.lastRun) + ':' + String(new Date(fgSimulationSession.lastRun).getSeconds()).padStart(2, '0')
      : '–';
    const logs = fgSimulationSession.log.length
      ? fgSimulationSession.log.map(function (x) { return '<div>' + $('<div>').text(x).html() + '</div>'; }).join('')
      : '<div>Noch kein Simulationsdurchlauf.</div>';

    const html = '<div class="vis fgSimulationPanel" style="margin:0 0 10px;border:2px solid #6f4b27;background:#fff7e8;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 11px;background:#6f4b27;color:#fff;">' +
        '<div><b>🧪 FarmGod+ Simulations-Autopilot</b><div style="font-size:10px;opacity:.9;">Es werden keine echten Angriffe abgeschickt.</div></div>' +
        '<div style="display:flex;gap:6px;align-items:center;">' +
          '<button type="button" class="btn fgSimulationCopy">📋 Protokoll kopieren</button>' +
          '<button type="button" class="btn fgSimulationStop"' + (active ? '' : ' disabled') + '>Simulation stoppen</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;padding:10px;">' +
        '<div style="text-align:center;background:#fff;border:1px solid #c9a976;padding:7px;"><b style="font-size:17px;display:block;">' + fgSimulationSession.cycles + '</b>Prüfungen</div>' +
        '<div style="text-align:center;background:#fff;border:1px solid #c9a976;padding:7px;"><b style="font-size:17px;display:block;">' + fgSimulationSession.lastCount + '</b>jetzt möglich</div>' +
        '<div style="text-align:center;background:#fff;border:1px solid #c9a976;padding:7px;"><b style="font-size:17px;display:block;">' + fgSimulationSession.wouldSend + '</b>insgesamt simuliert</div>' +
        '<div style="text-align:center;background:#fff;border:1px solid #c9a976;padding:7px;"><b style="font-size:14px;display:block;">' + lastText + '</b>zuletzt geprüft</div>' +
        '<div style="text-align:center;background:#fff;border:1px solid #c9a976;padding:7px;"><b style="font-size:14px;display:block;">' + nextText + '</b>nächste Prüfung</div>' +
      '</div>' +
      '<div style="padding:0 10px 10px;font-size:10px;color:#705635;"><b>Status:</b> ' +
        (fgSimulationBusy ? 'Farmdaten werden gerade neu eingelesen und geplant …' : (active ? 'läuft' : 'gestoppt')) +
        '<div style="margin-top:6px;max-height:120px;overflow:auto;padding:6px 8px;background:#fff;border:1px solid #d6bd91;line-height:1.45;">' + logs + '</div></div>' +
      '</div>';
    $('#am_widget_Farm').first().before(html);

    $('.fgSimulationCopy').off('click.farmGodSim').on('click.farmGodSim', function () {
      fgSimulationCopyLog();
    });

    $('.fgSimulationStop').off('click.farmGodSim').on('click.farmGodSim', function () {
      fgStopSimulation();
    });
  };

  const fgStopSimulation = function () {
    if (fgSimulationTimer) clearTimeout(fgSimulationTimer);
    fgSimulationTimer = null;
    const state = fgReadSimulationState();
    state.active = false;
    state.stoppedAt = Date.now();
    fgWriteSimulationState(state);
    fgSimulationSession.nextRun = null;
    fgSimulationAddLog('Simulation gestoppt.');
    fgRenderSimulationPanel();
    UI.SuccessMessage('FarmGod+ Simulation gestoppt.', 1400);
  };

  const fgScheduleSimulation = function (seconds) {
    if (fgSimulationTimer) clearTimeout(fgSimulationTimer);
    const delay = Math.max(10, Math.min(300, parseInt(seconds, 10) || 30)) * 1000;
    fgSimulationSession.nextRun = lib.getCurrentServerTime() + delay;
    fgRenderSimulationPanel();
    fgSimulationTimer = setTimeout(function () { fgRunSimulationCycle(); }, delay);
  };

  const fgRunSimulationCycle = function () {
    const state = fgReadSimulationState();
    if (!state.active || fgSimulationBusy) return;
    fgSimulationBusy = true;
    fgSimulationSession.nextRun = null;
    fgRenderSimulationPanel();

    const options = getStoredOptions();
    let returnDeadline = false;
    let arrivalDeadline = false;
    if (options.optionReturnEnabled && normalizeClockInput(options.optionReturnBy)) {
      returnDeadline = getReturnDeadlineTimestamp(options.optionReturnBy);
    }
    if (options.optionArrivalEnabled && normalizeClockInput(options.optionArrivalBy)) {
      arrivalDeadline = getArrivalDeadlineTimestamp(options.optionArrivalBy);
    }

    let smartCleanup = null;
    let sharedPages = null;
    let lifecycleSummary = null;
    fgLoadSharedFAPages()
      .then(function (pages) {
        sharedPages = pages;
        smartCleanup = fgSmartRefreshIntegratedPlan(pages);
        return getData(options.optionGroup, options.optionNewbarbs, options.optionLosses);
      })
      .then(function (data) {
        fgApplySimulationCommands(data);
        return fgRunTargetLifecycleSimulation(sharedPages, data).then(function (summary) {
          lifecycleSummary = summary;
          return data;
        });
      })
      .then(function (data) {
        const normalKey = data.farms.templates[options.optionTemplateNormal]
          ? options.optionTemplateNormal : Object.keys(data.farms.templates)[0];
        const fullKey = data.farms.templates[options.optionTemplateFull]
          ? options.optionTemplateFull : normalKey;
        if (!normalKey) throw new Error('Keine Farmvorlage gefunden.');

        const plan = createPlanning(
          options.optionDistance, options.optionTime, options.optionMaxloot,
          normalKey, fullKey, returnDeadline, arrivalDeadline, data
        );

        const records = fgSimulationRecords();
        const recordsBefore = records.length;
        const attackDetails = [];
        let count = 0;
        Object.keys(plan.farms || {}).forEach(function (coord) {
          (plan.farms[coord] || []).forEach(function (item) {
            records.push({
              originId: item.origin.id,
              originCoord: item.origin.coord,
              targetId: item.target.id,
              targetCoord: item.target.coord,
              templateId: item.template.id,
              templateName: item.template.name,
              arrival: item.arrival,
              simulatedAt: Math.round(lib.getCurrentServerTime() / 1000)
            });
            attackDetails.push({
              originCoord: item.origin.coord,
              targetCoord: item.target.coord,
              templateName: item.template.name,
              fields: item.fields,
              arrival: item.arrival
            });
            count++;
          });
        });

        const newState = fgReadSimulationState();
        newState.records = records.slice(-5000);
        newState.active = true;
        newState.lastRun = Date.now();
        newState.lastCount = count;
        fgWriteSimulationState(newState);

        fgSimulationSession.cycles++;
        fgSimulationSession.lastCount = count;
        fgSimulationSession.wouldSend += count;
        fgSimulationSession.lastRun = lib.getCurrentServerTime();
        fgSimulationAddLog(count
          ? count + ' Farmangriff(e) wären jetzt abgeschickt worden.'
          : 'Aktuell kein neuer Farmangriff möglich.');

        if (attackDetails.length) {
          attackDetails.forEach(function (item, index) {
            const templateLabel = String(item.templateName || '?').toUpperCase();
            const fields = Number.isFinite(Number(item.fields)) ? Number(item.fields).toFixed(2) : '–';
            fgSimulationAddLog(
              '  ↳ #' + (index + 1) + ' · Vorlage ' + templateLabel +
              ' · ' + item.originCoord + ' → ' + item.targetCoord +
              ' · ' + fields + ' Felder · Ankunft ' + fgSimulationFormatArrival(item.arrival)
            );
          });
        }

        fgSimulationLogLifecycle(lifecycleSummary);
        fgSimulationLogDiagnostics(plan, recordsBefore + count);
        if (smartCleanup && (smartCleanup.clearedScouts || smartCleanup.clearedWalls || smartCleanup.changedWalls)) {
          fgSimulationAddLog('Gesamtplan aktualisiert: ' + fgBuildSmartRefreshMessage(smartCleanup));
        }
      })
      .catch(function (error) {
        console.error('FarmGod+ simulation error:', error);
        fgSimulationAddLog('Fehler beim Aktualisieren: ' + (error && error.message ? error.message : error));
      })
      .always(function () {
        fgSimulationBusy = false;
        fgRenderSimulationPanel();
        const current = fgReadSimulationState();
        if (current.active) fgScheduleSimulation(getStoredOptions().simulationRefreshSeconds);
      });
  };

  const fgStartSimulation = function (options) {
    if (fgSimulationTimer) clearTimeout(fgSimulationTimer);
    localStorage.setItem('farmGod_options', JSON.stringify(options));
    const state = fgReadSimulationState();
    state.active = true;
    state.startedAt = Date.now();
    state.records = [];
    fgWriteSimulationState(state);
    fgSimulationSession = { cycles: 0, wouldSend: 0, lastCount: 0, startedAt: Date.now(), lastRun: null, nextRun: null, log: [] };
    fgSimulationAddLog('Simulation gestartet. Farmdaten werden frisch eingelesen.');
    Dialog.close();
    fgRenderSimulationPanel();
    fgRunSimulationCycle();
  };

  const bindOptionEvents = function () {
    $('.fgPlanRefresh')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        fgRefreshIntegratedPlan();
      });

    $('.fgScoutToggle')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const stored = fgGetStoredScouts();
        if (!stored.length) return;

        const enabled = !fgIsScoutPlanEnabled();
        fgSetScoutPlanEnabled(enabled);
        fgUpdateScoutPlanControl();

        UI.SuccessMessage(
          enabled
            ? 'BB-Erschließung aktiviert: Späher werden wieder reserviert.'
            : 'BB-Erschließung pausiert: Späher sind für den Farmplan freigegeben.',
          1600
        );
      });

    $('.fg-collapsible')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const $title = $(this);
        const section = String($title.data('section'));
        const $body = $title.next('.fg-card-body');
        const opening = !$body.is(':visible');
        $body.slideToggle(120);
        $title.find('.fg-collapse-arrow').text(opening ? '▾' : '›');
        $title.find('.fgSectionHint').text(opening ? 'einklappen' : 'öffnen');
        fgSaveSectionOpen(section, opening);
      });

    $('.fgReserveEnabled')
      .off('change.farmGodReserve')
      .on('change.farmGodReserve', function () {
        $('.fgReserveGrid').toggleClass('fgReserveDisabled', !$(this).prop('checked'));
        const options = readOptionsFromDialog();
        localStorage.setItem('farmGod_options', JSON.stringify(options));
      });

    $('.fgReserveInput')
      .off('change.farmGodReserve')
      .on('change.farmGodReserve', function () {
        const value = Math.max(0, parseInt($(this).val(), 10) || 0);
        $(this).val(value);
        const options = readOptionsFromDialog();
        localStorage.setItem('farmGod_options', JSON.stringify(options));
      });

    $('.optionDistance, .optionFAPages, .fgSimulationRefresh')
      .off('change.farmGodShared')
      .on('change.farmGodShared', function () {
        const options = readOptionsFromDialog();
        localStorage.setItem('farmGod_options', JSON.stringify(options));
      });

    $('.fgScoutAnalyze')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        runScoutDiscovery();
      });

    $('.fgWallAnalyze')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        runWallbreakerAnalysis();
      });

    $('.fgWallReset')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        localStorage.removeItem(fgWallbreakerSentKey());
        fgClearIntegratedPlan();
        localStorage.removeItem(fgScoutSentKey());
        $('.fgWallRow').removeClass('fgWallSent');
        $('.fgScoutRow').removeClass('fgScoutSent');
        $('.fgScoutPrepare').removeClass('btn-confirm-yes').text('1 Späher vorbereiten');
        $('.fgWallPrepare').removeClass('btn-confirm-yes').text('Angriff vorbereiten');
        fgUpdateScoutPlanControl();
        UI.SuccessMessage('Gemeinsamer Plan zurückgesetzt.', 1200);
      });

    $('.fgBarbAnalyze')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        runBarbAnalysis();
      });

    $('.fgBarbAnalysisToggle')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        $('.fgBarbAnalysisBody').slideToggle(120);
        const isOpen = $('.fgBarbAnalysisBody').is(':visible');
        $(this).text(isOpen ? 'Barbaren-Analyse ausblenden' : 'Barbaren-Analyse anzeigen');
      });

    $('.optionReturnEnabled')
      .off('change.farmGod')
      .on('change.farmGod', function () {
        $('.fgReturnControls').toggle($(this).prop('checked'));
      });

    $('.optionArrivalEnabled')
      .off('change.farmGod')
      .on('change.farmGod', function () {
        $('.fgArrivalControls').toggle($(this).prop('checked'));
      });

    $('.fgArrivalQuick')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const hours = parseFloat($(this).data('hours')) || 0;
        const target = lib.getCurrentServerTime() + hours * 60 * 60 * 1000;
        $('.optionArrivalEnabled').prop('checked', true);
        $('.fgArrivalControls').show();
        $('.optionArrivalBy').val(formatClock(target));
      });

    $('.fgReturnQuick')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const hours = parseFloat($(this).data('hours')) || 0;
        const target = lib.getCurrentServerTime() + hours * 60 * 60 * 1000;
        $('.optionReturnEnabled').prop('checked', true);
        $('.fgReturnControls').show();
        $('.optionReturnBy').val(formatClock(target));
      });

    $('.optionProfile')
      .off('change.farmGod')
      .on('change.farmGod', function () {
        applyProfileToDialog($(this).val());
      });

    $('.profileSave')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const name = (($('.profileName').val() || '').trim());
        if (!name) {
          UI.ErrorMessage('Bitte einen Profilnamen eingeben.');
          return;
        }
        const profiles = getProfiles();
        profiles[name] = {
          distance: Math.max(0, parseFloat($('.optionDistance').val()) || 0),
          time: Math.max(0, parseFloat($('.optionTime').val()) || 0),
          losses: $('.optionLosses').prop('checked'),
          maxloot: $('.optionMaxloot').prop('checked'),
        };
        saveProfiles(profiles);
        const option = $('<option></option>').val(name).text(name);
        const existing = $('.optionProfile option').filter(function () { return $(this).val() === name; });
        if (existing.length) existing.replaceWith(option);
        else $('.optionProfile').append(option);
        $('.optionProfile').val(name);
        $('.profileName').val('');
        UI.SuccessMessage('Profil gespeichert.');
      });

    $('.profileDelete')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const name = $('.optionProfile').val();
        if (!name) return;
        const profiles = getProfiles();
        delete profiles[name];
        saveProfiles(profiles);
        $('.optionProfile option:selected').remove();
        const first = $('.optionProfile option').first().val();
        $('.optionProfile').val(first);
        if (first) applyProfileToDialog(first);
        UI.SuccessMessage('Profil gelöscht.');
      });

    $('.fgSimulationStart')
      .off('click.farmGodSim')
      .on('click.farmGodSim', function () {
        const options = readOptionsFromDialog();
        if (!options.optionDistance || options.optionDistance <= 0) {
          UI.ErrorMessage('Die maximale Entfernung muss größer als 0 sein.');
          return;
        }
        if (!options.optionTemplateNormal) {
          UI.ErrorMessage('Bitte eine Standardvorlage auswählen.');
          return;
        }
        if (options.optionReturnEnabled && !normalizeClockInput(options.optionReturnBy)) {
          UI.ErrorMessage('Bitte eine gültige Rückkehrzeit im Format HH:MM eingeben.');
          return;
        }
        if (options.optionArrivalEnabled && !normalizeClockInput(options.optionArrivalBy)) {
          UI.ErrorMessage('Bitte eine gültige Ziel-Ankunftszeit im Format HH:MM eingeben.');
          return;
        }
        fgStartSimulation(options);
      });

    $('.optionButton')
      .off('click.farmGod')
      .on('click.farmGod', () => {
        const options = readOptionsFromDialog();
        if (!options.optionDistance || options.optionDistance <= 0) {
          UI.ErrorMessage('Die maximale Entfernung muss größer als 0 sein.');
          return;
        }
        if (!options.optionTemplateNormal) {
          UI.ErrorMessage('Bitte eine Standardvorlage auswählen.');
          return;
        }

        let returnDeadline = false;
        if (options.optionReturnEnabled) {
          const normalizedReturn = normalizeClockInput(options.optionReturnBy);
          if (!normalizedReturn) {
            UI.ErrorMessage('Bitte eine gültige Rückkehrzeit im Format HH:MM eingeben.');
            return;
          }
          options.optionReturnBy = normalizedReturn;
          $('.optionReturnBy').val(normalizedReturn);
          returnDeadline = getReturnDeadlineTimestamp(normalizedReturn);
        }

        let arrivalDeadline = false;
        if (options.optionArrivalEnabled) {
          const normalizedArrival = normalizeClockInput(options.optionArrivalBy);
          if (!normalizedArrival) {
            UI.ErrorMessage('Bitte eine gültige Ziel-Ankunftszeit im Format HH:MM eingeben.');
            return;
          }
          options.optionArrivalBy = normalizedArrival;
          $('.optionArrivalBy').val(normalizedArrival);
          arrivalDeadline = getArrivalDeadlineTimestamp(normalizedArrival);
        }

        localStorage.setItem('farmGod_options', JSON.stringify(options));
        $('.optionsContent').html(
          '<div class="fg-loading">' + UI.Throbber[0].outerHTML + '<div>Gesamtplan wird aktualisiert und Farmplan erstellt …</div></div>'
        );

        let smartCleanup = null;
        fgLoadSharedFAPages()
          .then(function (pages) {
            smartCleanup = fgSmartRefreshIntegratedPlan(pages);
            return getData(
              options.optionGroup,
              options.optionNewbarbs,
              options.optionLosses
            );
          })
          .then((data) => {
          if (smartCleanup && (smartCleanup.clearedScouts || smartCleanup.clearedWalls || smartCleanup.changedWalls)) {
            UI.SuccessMessage('Smart-Update: ' + fgBuildSmartRefreshMessage(smartCleanup), 2200);
          }
          const normalKey = data.farms.templates[options.optionTemplateNormal]
            ? options.optionTemplateNormal
            : Object.keys(data.farms.templates)[0];
          const fullKey = data.farms.templates[options.optionTemplateFull]
            ? options.optionTemplateFull
            : normalKey;

          if (!normalKey) {
            UI.ErrorMessage('Es konnten keine Farmvorlagen gefunden werden.');
            return;
          }

          let plan = createPlanning(
            options.optionDistance,
            options.optionTime,
            options.optionMaxloot,
            normalKey,
            fullKey,
            returnDeadline,
            arrivalDeadline,
            data
          );

          plan = fgApplyFarmPlanState(plan);
          fgSaveFarmPlan(plan);

          Dialog.close();
          $('.farmGodContent').remove();
          $('#am_widget_Farm').first().before(buildTable(plan));

          bindEventHandlers();
        selectFarmRow($('.farmRow').not('.fgPlanDone').first());
          UI.InitProgressBars();
          const unifiedCount = $('.farmRow').not('.fgPlanDone').length;
          UI.updateProgressBar($('#FarmGodProgessbar'), 0, unifiedCount);
          $('#FarmGodProgessbar')
            .data('current', 0)
            .data('max', unifiedCount);
        }).catch((error) => {
          console.error('FarmGod+ planning error:', error);
          UI.ErrorMessage('FarmGod+ konnte den Farmplan nicht erstellen. Details stehen in der Konsole.');
          Dialog.close();
        });
      });
  };

  const bindEventHandlers = function () {
    $('.fgUnifiedPrepare')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const $button = $(this);
        const target = String($button.data('target'));
        const type = String($button.data('type'));
        const $row = $button.closest('.farmRow');

        if (type === 'wallbreaker') {
          fgMarkWallbreakerPrepared(target);
          $row.find('.fgWallLife').last()
            .removeClass()
            .addClass('fgWallLife fgWallLife-prepared')
            .text(fgWallbreakerStatusLabel('prepared'));

          $button.replaceWith(
            '<button type="button" class="btn fgUnifiedMarkWallSent" data-target="' +
            target + '">Als gesendet markieren</button>'
          );
          bindEventHandlers();
          return;
        }

        if (type === 'scout') fgUpdateScoutStatus(target, 'prepared');

        $row.addClass('fgPreparedRow');
        $button.text('Vorbereitet ✓');

        setTimeout(function () {
          const wasSelected = $row.hasClass('fgNextAttack');
          $row.remove();
          const $pb = $('#FarmGodProgessbar');
          $pb.data('current', (Number($pb.data('current')) || 0) + 1);
          UI.updateProgressBar($pb, $pb.data('current'), $pb.data('max'));
          updateFarmGodPlusProgressText();
          if (wasSelected || !$('.farmRow.fgNextAttack').length) {
            selectFarmRow($('.farmRow').not('.fgPlanDone').first());
          }
        }, 150);
      });

    $('.fgUnifiedMarkWallSent')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const target = String($(this).data('target'));
        const $row = $(this).closest('.farmRow');

        fgMarkWallbreakerSent(target);

        $row.find('.fgWallLife').last()
          .removeClass()
          .addClass('fgWallLife fgWallLife-waiting_report')
          .text(fgWallbreakerStatusLabel('waiting_report'));

        $(this).replaceWith(
          '<span class="fgWallLife fgWallLife-waiting_report">' +
          fgWallbreakerStatusLabel('waiting_report') + '</span>'
        );

        const wasSelected = $row.hasClass('fgNextAttack');
        $row.addClass('fgPlanDone');
        updateFarmGodPlusProgressText();
        if (wasSelected) {
          selectFarmRow($('.farmRow').not('.fgPlanDone').first());
        }

        UI.SuccessMessage('Mauerbrecher als gesendet markiert.', 1200);
      });

    $('.farmGod_icon')
      .off('click')
      .on('click', function (event) {
        if (event) event.preventDefault();

        if (
          game_data.market != 'nl' ||
          $(this).data('origin') == curVillage
        ) {
          sendFarm($(this));
        } else {
          UI.ErrorMessage(t.messages.villageError);
        }

        return false;
      });

    $(document)
      .off('keydown.farmGod')
      .on('keydown.farmGod', function (event) {
        const tag = String(event.target && event.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

        const key = event.key;
        const code = event.keyCode || event.which;

        if (key === 'Enter' || code === 13) {
          event.preventDefault();
          const $row = getSelectedFarmRow();
          if ($row.length) {
            const $farm = $row.find('.farmGod_icon').first();
            const $prepare = $row.find('.fgUnifiedPrepare').first();
            const $markWallSent = $row.find('.fgUnifiedMarkWallSent').first();
            if ($farm.length) $farm.trigger('click');
            else if ($markWallSent.length) $markWallSent.trigger('click');
            else if ($prepare.length) $prepare.get(0).click();
          }
        } else if (key === 'ArrowDown' || code === 40) {
          event.preventDefault();
          moveFarmSelection(1);
        } else if (key === 'ArrowUp' || code === 38) {
          event.preventDefault();
          moveFarmSelection(-1);
        } else if (String(key).toLowerCase() === 's' || code === 83) {
          event.preventDefault();
          const $row = getSelectedFarmRow();
          if ($row.length) $row.find('.fgSkip').first().trigger('click');
        }
      });

    $('.switchVillage')
      .off('click')
      .on('click', function () {
        curVillage = $(this).data('id');
        UI.SuccessMessage(t.messages.villageChanged);
        $(this).closest('tr').remove();
      });

    $('.fgRemainingToggle')
      .off('click')
      .on('click', function () {
        const $body = $('.fgRemainingBody');
        const opening = !$body.is(':visible');
        const currentText = $(this).text();
        const countMatch = currentText.match(/\((\d+) Dörfer\)/);
        const suffix = countMatch ? ' (' + countMatch[1] + ' Dörfer)' : '';
        $body.slideToggle(120);
        $(this).text((opening ? '▼ Resttruppen ausblenden' : '▶ Resttruppen anzeigen') + suffix);
      });

    $('.fgSkip')
      .off('click')
      .on('click', function () {
        const $row = $(this).closest('.farmRow');
        fgUpdateFarmPlanItemStatus(String($row.data('plan-signature') || ''), 'skipped');
        const wasSelected = $row.hasClass('fgNextAttack');
        $row.remove();
        updateFarmGodPlusProgressText();
        if (wasSelected || !$('.farmRow.fgNextAttack').length) {
          selectFarmRow($('.farmRow').not('.fgPlanDone').first());
        }
      });

    $('.fgBottleneckToggle')
      .off('click.farmGod')
      .on('click.farmGod', function () {
        const $body = $('.fgBottleneckBody');
        const opening = !$body.is(':visible');
        $body.slideToggle(120);
        $(this).text(opening ? 'Details ausblenden' : 'Details anzeigen');
      });

    $('.fgStatClickable')
      .off('click')
      .on('click', function () {
        const key = $(this).data('detail');
        $('.fgDetailBox').hide();
        $('.fgDetail_' + key).show();
      });

    $('.fgDetailClose')
      .off('click')
      .on('click', function () {
        $(this).closest('.fgDetailBox').hide();
      });
  };

  const getTemplateNames = function () {
    const names = [];
    $('form[action*="action=edit_all"]')
      .find('a.farm_icon')
      .each((i, el) => {
        const match = ($(el).attr('class') || '').match(/farm_icon_([^\s]+)/);
        if (match && !names.includes(match[1])) names.push(match[1]);
      });

    if (!names.length) {
      $('form[action*="action=edit_all"]')
        .find('input[type="hidden"][name*="template"]')
        .closest('tr')
        .prev('tr')
        .find('a.farm_icon')
        .each((i, el) => {
          const match = ($(el).attr('class') || '').match(/farm_icon_([^\s]+)/);
          if (match && !names.includes(match[1])) names.push(match[1]);
        });
    }

    return names;
  };

  const buildTemplateSelect = function (className, selected, fallbackIndex) {
    let names = getTemplateNames();
    if (!names.length) names = ['a', 'b'];
    const fallback = names[Math.min(fallbackIndex, names.length - 1)] || names[0];
    const value = names.includes(selected) ? selected : fallback;
    return `<select class="${className}">${names
      .map((name) => `<option value="${name}" ${name === value ? 'selected' : ''}>Vorlage ${name.toUpperCase()}</option>`)
      .join('')}</select>`;
  };

  const fgGetSmartPlanStats = function () {
    const state = fgReadIntegratedPlan();
    const scouts = Array.isArray(state.scouts) ? state.scouts : [];
    const walls = Array.isArray(state.wallbreakers) ? state.wallbreakers : [];
    return {
      completedScouts: scouts.filter(function (x) {
        return x && x.status === 'cleared' && x.completedReason === 'known_in_farm_assistant';
      }).length,
      completedWalls: walls.filter(function (x) {
        return x && x.status === 'cleared' && x.completedReason === 'wall_zero';
      }).length,
      wallsToReplan: walls.filter(function (x) {
        return x && x.status === 'needs_replan';
      }).length,
      lastRefresh: state.lastSmartRefresh || null
    };
  };

  const fgBuildIntegratedStatusHtml = function () {
    const reservations = fgGetActiveWallbreakers();
    const smartStats = fgGetSmartPlanStats();
    const storedScouts = fgGetStoredScouts();
    const scoutEnabled = fgIsScoutPlanEnabled();
    const scouts = scoutEnabled ? storedScouts : [];

    if (!reservations.length && !storedScouts.length) {
      return '<div class="fgSharedStatus fgSharedStatusEmpty"><b>Gemeinsamer Plan:</b> Keine Mauerbrecher oder Späher gespeichert.</div>';
    }

    const axes = reservations.reduce(function (sum, x) {
      return sum + (parseInt(x.units && x.units.axe, 10) || 0);
    }, 0);
    const rams = reservations.reduce(function (sum, x) {
      return sum + (parseInt(x.units && x.units.ram, 10) || 0);
    }, 0);
    const breakerSpies = reservations.reduce(function (sum, x) {
      return sum + (parseInt(x.units && x.units.spy, 10) || 0);
    }, 0);

    let scoutText = '';
    if (storedScouts.length) {
      scoutText = scoutEnabled
        ? storedScouts.length + ' neue BBs aktiv'
        : storedScouts.length + ' neue BBs pausiert';
    } else {
      scoutText = '0 neue BBs';
    }

    return '<div class="fgSharedStatus' + (!scoutEnabled && storedScouts.length ? ' fgSharedStatusPaused' : '') + '"><b>Gemeinsamer Plan:</b> ' +
      reservations.length + ' Mauerbrecher · ' +
      scoutText + ' · reserviert: ' +
      axes + ' Axt / ' + rams + ' Rammen / ' +
      (breakerSpies + scouts.length) + ' Späher.' +
      (smartStats.wallsToReplan
        ? ' <span class="fgSmartWarning">⚠ ' + smartStats.wallsToReplan + ' Mauerziel(e) warten auf Neuberechnung</span>'
        : '') +
      '</div>';
  };



  const fgSectionStateKey = function () {
    return 'farmGod_section_state_' + game_data.world + '_' + game_data.player.id;
  };

  const fgReadSectionState = function () {
    try {
      return JSON.parse(localStorage.getItem(fgSectionStateKey()) || '{}');
    } catch (e) {
      return {};
    }
  };

  const fgIsSectionOpen = function (name, defaultOpen) {
    const state = fgReadSectionState();
    return state[name] === undefined ? !!defaultOpen : !!state[name];
  };

  const fgSaveSectionOpen = function (name, isOpen) {
    const state = fgReadSectionState();
    state[name] = !!isOpen;
    localStorage.setItem(fgSectionStateKey(), JSON.stringify(state));
  };

  const fgSectionTitle = function (name, title, defaultOpen) {
    const open = fgIsSectionOpen(name, defaultOpen);
    return '<div class="fg-card-title fg-collapsible" data-section="' + name + '">' +
      '<span class="fg-collapse-arrow">' + (open ? '▾' : '›') + '</span>' +
      '<span class="fgSectionTitleText">' + title + '</span>' +
      '<span class="fgSectionHint">' + (open ? 'einklappen' : 'öffnen') + '</span>' +
      '</div>';
  };

  const fgSectionStyle = function (name, defaultOpen) {
    return fgIsSectionOpen(name, defaultOpen) ? '' : 'display:none;';
  };

  const buildOptions = function () {
    const options = getStoredOptions();
    const profiles = getProfiles();
    const fgWarnings = [];

    const $filterChecks = $('#plunder_list_filters').find('input[type="checkbox"]');
    if ($filterChecks.length) {
      const activeCount = $filterChecks.filter(':checked').length;
      if (activeCount === 0) {
        fgWarnings.push('Im Farm-Assistenten ist aktuell kein Ziel-Filter aktiv. Dadurch können passende Ziele fehlen.');
      }
    }

    const templateNames = getTemplateNames();
    if (!templateNames.length) {
      fgWarnings.push('FarmGod+ konnte keine Farmvorlagen A/B im Farm-Assistenten erkennen.');
    } else if (templateNames.length === 1) {
      fgWarnings.push('Es wurde nur eine Farmvorlage erkannt. Die zweite Vorlage steht FarmGod+ daher nicht zur Verfügung.');
    }

    return $.when(buildGroupSelect(options.optionGroup)).then((groupSelect) => {
      const profileNames = Object.keys(profiles);
      const activeProfile = profileNames.includes(options.activeProfile)
        ? options.activeProfile
        : profileNames[0];
      const profileOptions = profileNames
        .map((name) => `<option value="${name}" ${name === activeProfile ? 'selected' : ''}>${name}</option>`)
        .join('');

      const normalTemplate = buildTemplateSelect('optionTemplateNormal', options.optionTemplateNormal, 0);
      const fullTemplate = buildTemplateSelect('optionTemplateFull', options.optionTemplateFull, 1);

      return `<style>
        #popup_box_FarmGod{width:680px!important;max-width:92vw;text-align:left;}
        #popup_box_FarmGod .popup_box_content{padding:0!important;}
        .fg-wrap{font-family:Arial,sans-serif;color:#3b2b1b;background:#f6eddc;border:1px solid #8c642d;box-shadow:0 3px 12px rgba(0,0,0,.22);}
        .fg-head{padding:14px 16px;background:linear-gradient(#7b5329,#5e3c1c);color:#fff;display:flex;justify-content:space-between;align-items:center;}
        .fg-title{font-size:20px;font-weight:700;letter-spacing:.2px;}
        .fg-version{font-size:11px;opacity:.85;background:rgba(255,255,255,.14);padding:3px 7px;border-radius:10px;}
        .fg-body{padding:14px 16px 16px;}
        .fg-card{background:#fffaf0;border:1px solid #c5a46e;border-radius:5px;margin-bottom:10px;overflow:hidden;}
        .fg-card-title{padding:8px 10px;background:#ead7b2;font-weight:700;border-bottom:1px solid #c5a46e;}
        .fg-collapsible{display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none;transition:background .12s ease;}
        .fg-collapsible:hover{background:#dfc79c;}
        .fg-collapse-arrow{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;border-radius:50%;background:rgba(255,255,255,.42);color:#6a4925;font-size:15px;line-height:1;}
        .fgSectionTitleText{flex:1;}
        .fgSectionHint{font-size:9px;font-weight:400;color:#80633e;opacity:.85;}
        .fg-card-body{overflow:hidden;}
        .fg-card{box-shadow:0 1px 2px rgba(80,55,25,.08);}
        .fgWallLifecycleLegend{background:#fffaf0;}

        .fg-common-grid{display:grid;grid-template-columns:1.4fr 1fr 1.4fr 1fr;gap:8px 12px;padding:10px;align-items:center;}
        .fg-common-grid label{font-weight:700;}
        .fg-common-grid input{width:100%;box-sizing:border-box;padding:6px 7px;border:1px solid #a98955;border-radius:3px;background:#fff;}
        .fg-common-note{padding:0 10px 9px;font-size:10px;color:#705635;line-height:1.35;}
        .fgReserveHead{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px;font-size:10px;color:#705635;}
        .fgReserveHead .fg-check{font-size:12px;color:#4d351c;font-weight:700;}
        .fgReserveGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 10px 10px;transition:opacity .15s;}
        .fgReserveGrid label{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;background:#fffaf0;border:1px solid #c9a976;border-radius:4px;font-size:10px;font-weight:700;}
        .fgReserveGrid input{width:72px;box-sizing:border-box;padding:5px;border:1px solid #a98955;background:#fff;text-align:right;}
        .fgReserveDisabled{opacity:.45;}
        @media(max-width:700px){.fgReserveGrid{grid-template-columns:repeat(2,1fr);}.fgReserveHead{align-items:flex-start;flex-direction:column;}}

        .fg-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:8px 14px;padding:10px;align-items:center;}
        .fg-grid label{font-weight:600;}
        .fg-grid input[type=text],.fg-grid select{width:100%;box-sizing:border-box;padding:6px 7px;border:1px solid #a98955;border-radius:3px;background:#fff;}
        .fg-profile-row{display:grid;grid-template-columns:1fr 1fr auto auto;gap:6px;padding:10px;}
        .fg-profile-row select,.fg-profile-row input{min-width:0;padding:6px 7px;border:1px solid #a98955;border-radius:3px;background:#fff;}
        .fg-check{display:flex;align-items:center;gap:7px;font-weight:600;}
        .fg-return-box{padding:10px;border-top:1px solid #d6bd91;background:#fff7e8;}
        .fg-return-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .fg-return-line input[type=text]{width:82px;padding:6px 7px;border:1px solid #a98955;border-radius:3px;background:#fff;text-align:center;font-weight:bold;}
        .fg-return-quick{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;}
        .fg-return-hint{font-size:10px;color:#705635;margin-top:6px;line-height:1.35;}
        .fg-note{font-size:11px;color:#705635;margin-top:3px;font-weight:normal;}
        .fg-warning{margin:0 0 10px;padding:9px 10px;background:#fff2c8;border:1px solid #d5ae3f;border-radius:4px;line-height:1.35;}
        .fg-warning-list{margin:6px 0 0 18px;padding:0;}
        .fg-warning-list li{margin:3px 0;}
        .fg-actions{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:12px;}
        .fg-primary{font-weight:700!important;padding:7px 16px!important;}
        .fg-loading{text-align:center;padding:28px 10px;font-weight:700;}
        .fg-loading>div{margin-top:10px;}
        .fg-barb-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px;}
        .fg-barb-head-text{font-size:11px;color:#705635;line-height:1.35;max-width:470px;}
        .fgBarbAnalysisResult{display:none;border-top:1px solid #d6bd91;padding:10px;background:#fff7e8;}
        .fgBarbLoading{display:flex;align-items:center;justify-content:center;gap:8px;padding:18px;font-weight:bold;}
        .fgBarbSummary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:9px;}
        .fgBarbSummary>div{text-align:center;background:#fffaf0;border:1px solid #c9a976;padding:8px 5px;}
        .fgBarbSummary strong{display:block;font-size:18px;color:#5f421f;}
        .fgBarbSummary span{font-size:10px;color:#705635;}
        .fgBarbTableWrap{max-height:330px;overflow:auto;border:1px solid #c9a976;}
        .fgBarbTable{margin:0!important;}
        .fgBarbTable th{position:sticky;top:0;z-index:1;text-align:center;}
        .fgBarbTable td{text-align:center;padding:5px;}
        .fgBarbTable td:first-child{text-align:left;white-space:nowrap;}
        .fgBarbTable td:first-child span{font-size:10px;color:#705635;}
        .fgBarbBest td{background:#fff0bf!important;}
        .fgBestBadge{display:inline-block!important;margin-left:6px;padding:1px 5px;border-radius:8px;background:#6f4b27;color:#fff!important;font-size:8px!important;font-weight:bold;}
        .fgBarbNote{font-size:10px;color:#705635;margin-top:7px;line-height:1.35;}
        .fgBarbError{padding:10px;background:#ffe1d9;border:1px solid #ba5c46;}
        .fgWallControls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
        .fgWallControls input[type=text]{width:45px;padding:5px;text-align:center;border:1px solid #a98955;}
        .fgWallSummary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:9px;}
        .fgWallSummary>div{text-align:center;background:#fffaf0;border:1px solid #c9a976;padding:8px 5px;}
        .fgWallSummary strong{display:block;font-size:18px;color:#5f421f;}
        .fgWallSummary span{font-size:10px;color:#705635;}
        .fgWallTableWrap{max-height:340px;overflow:auto;border:1px solid #c9a976;}
        .fgWallTable{margin:0!important;}
        .fgWallTable th{position:sticky;top:0;z-index:1;text-align:center;}
        .fgWallTable td{text-align:center;padding:5px;}
        .fgWallSent{opacity:.58;}
        .fgWallSent td{background:#e7e0cd!important;}
        .fgWallNoTroops td{background:#f7dfd8!important;}
        .fgWallImpossible{color:#9b2d20;font-size:10px;line-height:1.35;}
        .fgWallLife{display:inline-block;margin:2px 0;padding:2px 6px;border-radius:9px;border:1px solid #c9a976;font-size:9px;font-weight:700;}
        .fgWallLife-planned{background:#fff2c8;border-color:#d5ae3f;color:#80600f;}
        .fgWallLife-prepared{background:#dfeaf6;border-color:#8fa9c4;color:#355d85;}
        .fgWallLife-waiting_report{background:#eadff3;border-color:#a78bbc;color:#65447c;}
        .fgWallLife-needs_replan{background:#ffe5c6;border-color:#d99a4a;color:#8a5810;}
        .fgWallLife-cleared{background:#e4f0d3;border-color:#8ea95e;color:#45631b;}
        .fgWallLifeHint{font-size:9px;color:#705635;line-height:1.3;}
        .fgWallLifecycleLegend{display:flex;gap:6px;flex-wrap:wrap;padding:0 10px 10px;}
        .fgWallTable td:nth-child(4) span{font-size:10px;color:#705635;}
        .fgIntegrationNotice{margin:0 0 9px;padding:8px 10px;background:#e8f2d5;border:1px solid #8da65e;color:#40551f;font-size:11px;line-height:1.4;}
        .fgSharedStatus{margin:0 0 10px;padding:8px 10px;background:#e8f2d5;border:1px solid #8da65e;color:#40551f;font-size:11px;}
        .fgSharedStatusEmpty{background:#f7edda;border-color:#d6bd91;color:#705635;}
        .fgSharedStatusPaused{background:#fff2c8;border-color:#d5ae3f;color:#6b5423;}
        .fgStateActive{color:#4e6d1f;font-weight:700;}
        .fgStatePaused{color:#9a6b13;font-weight:700;}
        .fgSmartStatus{margin:0 10px 10px;padding:9px 11px;background:#edf3df;border:1px solid #a8b87c;border-radius:4px;color:#40551f;font-size:10px;line-height:1.4;}
        .fgSmartWarning{display:inline-block;margin-left:6px;padding:2px 5px;background:#fff0bd;border:1px solid #d5ae3f;color:#8a6110;font-weight:700;}
        .fg-actions{display:flex;gap:10px;flex-wrap:wrap;}
        .fgMainActions{align-items:stretch;margin-top:4px;}
        .fgMainActions .fgActionButton{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;flex:1 1 210px;padding:7px 14px!important;box-sizing:border-box;font-weight:700;line-height:1.15;}
        .fgMainActions .fgPlanRefresh{min-width:0;background:#f7edd8;border-color:#b8945e;color:#5b3d1f;}
        .fgMainActions .fgPlanRefresh:hover{background:#fff5e2;}
        .fgMainActions .fgActionPrimary{min-width:0;box-shadow:inset 0 1px rgba(255,255,255,.22);}
        .fgActionIcon{display:inline-block;font-size:14px;line-height:1;}
        .fgSpin{animation:fgSpin .9s linear infinite;}
        @keyframes fgSpin{to{transform:rotate(360deg);}}


        .fgScoutControls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
        .fgScoutControls input[type=text]{width:48px;padding:5px;text-align:center;border:1px solid #a98955;}
        .fgScoutSummary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:9px;}
        .fgScoutSummary>div{text-align:center;background:#fffaf0;border:1px solid #c9a976;padding:8px 5px;}
        .fgScoutSummary strong{display:block;font-size:18px;color:#5f421f;}
        .fgScoutSummary span{font-size:10px;color:#705635;}
        .fgScoutTableWrap{max-height:360px;overflow:auto;border:1px solid #c9a976;}
        .fgScoutTable{margin:0!important;}
        .fgScoutTable th{position:sticky;top:0;z-index:1;text-align:center;}
        .fgScoutTable td{text-align:center;padding:5px;}
        .fgScoutTable td span{font-size:10px;color:#705635;}
        .fgScoutTable img{width:18px;height:18px;vertical-align:middle;}
        .fgScoutSent{opacity:.58;}
        .fgScoutSent td{background:#e7e0cd!important;}
        .fgUnifiedSummary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:0 10px 9px;}
        .fgUnifiedSummary>div{text-align:center;background:#fffaf0;border:1px solid #c9a976;padding:7px 5px;}
        .fgUnifiedSummary strong{display:block;font-size:17px;color:#5f421f;}
        .fgUnifiedSummary span,.fgQueueSub{font-size:10px;color:#705635;}
        .fgPreparedRow{opacity:.55;}

        .fgTroopDiagnostic{margin:0 0 9px;padding:7px 9px;background:#eef4df;border:1px solid #9daf72;color:#40551f;font-size:11px;}
        @media(max-width:700px){.fgBarbSummary,.fgWallSummary,.fgScoutSummary{grid-template-columns:1fr}.fg-barb-head{align-items:flex-start;flex-direction:column;}}
        @media(max-width:700px){.fg-grid,.fg-common-grid{grid-template-columns:1fr}.fg-profile-row{grid-template-columns:1fr 1fr}.fg-profile-row .btn{width:100%}}
      </style>
      <div class="fg-wrap">
        <div class="fg-head"><div class="fg-title">FarmGod+</div><div class="fg-version">v2.7.7</div></div>
        <div class="fg-body optionsContent">
          <div class="fgIntegratedStatus">${fgBuildIntegratedStatusHtml()}</div>
          ${fgWarnings.length
            ? `<div class="fg-warning"><b>Hinweis:</b><ul class="fg-warning-list">${fgWarnings.map(function (warning) {
                return `<li>${warning}</li>`;
              }).join('')}</ul></div>`
            : ''}

          <div class="fg-card">
            <div class="fg-card-title">Gemeinsame Einstellungen</div>
            <div class="fg-common-grid">
              <label>Reichweite</label>
              <input type="text" class="optionDistance" value="${options.optionDistance}" maxlength="5">
              <label>Farm-Assistent-Seiten</label>
              <input type="text" class="optionFAPages" value="${options.optionFAPages || 20}" maxlength="2">
            </div>
            <div class="fg-common-note">Die Reichweite gilt gemeinsam für Farmplan und BB-Erschließung. Die Zahl der Farm-Assistent-Seiten gilt gemeinsam für BB-Erschließung, Mauerbrecher und die automatische Aktualisierung des Gesamtplans.</div>
            <div class="fgSmartStatus"><b>Smart-Gesamtplan:</b> Beim Erstellen werden die Farm-Assistent-Daten automatisch neu geprüft. Bekannte Späherziele geben ihre Späher frei, Mauer 0 wird wieder normal farmbar und eine veränderte Mauer wird zur Neuberechnung markiert.</div>
          </div>

          <div class="fg-card">
            ${fgSectionTitle('profile', 'Profil', false)}
            <div class="fg-card-body" style="${fgSectionStyle('profile', false)}">
              <div class="fg-profile-row">
                <select class="optionProfile">${profileOptions}</select>
                <input class="profileName" type="text" maxlength="30" placeholder="Neues Profil …">
                <input type="button" class="btn profileSave" value="Speichern">
                <input type="button" class="btn profileDelete" value="Löschen">
              </div>
            </div>
          </div>

          <div class="fg-card">
            ${fgSectionTitle('farmplan', 'Farmplan', true)}
            <div class="fg-card-body" style="${fgSectionStyle('farmplan', true)}">
              <div class="fg-grid">
                <label>Dorfgruppe<div class="fg-note">Aus welchen eigenen Dörfern gefarmt werden soll.</div></label><div>${groupSelect}</div>
                <label>Mindestabstand zwischen Angriffen<div class="fg-note">Zeitfenster in Minuten je Ziel.</div></label><input type="text" class="optionTime" value="${options.optionTime}">
                <label>Standardvorlage<div class="fg-note">Wird normalerweise für Farmangriffe verwendet.</div></label><div>${normalTemplate}</div>
                <label>Vorlage bei voller Beute<div class="fg-note">Wird nur genutzt, wenn „größere Vorlage“ aktiviert ist.</div></label><div>${fullTemplate}</div>
              </div>
              <div class="fg-return-box">
                <div class="fg-return-line">
                  <label class="fg-check"><input type="checkbox" class="optionArrivalEnabled" ${options.optionArrivalEnabled ? 'checked' : ''}> Angriffe müssen spätestens im Ziel eintreffen um</label>
                  <div class="fgArrivalControls" style="${options.optionArrivalEnabled ? '' : 'display:none;'}">
                    <input type="text" class="optionArrivalBy" maxlength="5" placeholder="22:30" value="${options.optionArrivalBy || ''}">
                  </div>
                </div>
                <div class="fgArrivalControls" style="${options.optionArrivalEnabled ? '' : 'display:none;'}">
                  <div class="fg-return-quick">
                    <input type="button" class="btn fgArrivalQuick" data-hours="1" value="+1h">
                    <input type="button" class="btn fgArrivalQuick" data-hours="2" value="+2h">
                    <input type="button" class="btn fgArrivalQuick" data-hours="4" value="+4h">
                  </div>
                  <div class="fg-return-hint">Nur Angriffe, die spätestens zu dieser festen Uhrzeit am Ziel ankommen, werden eingeplant.</div>
                </div>
              </div>

              <div class="fg-return-box">
                <div class="fg-return-line">
                  <label class="fg-check"><input type="checkbox" class="optionReturnEnabled" ${options.optionReturnEnabled ? 'checked' : ''}> Truppen müssen spätestens zurück sein um</label>
                  <div class="fgReturnControls" style="${options.optionReturnEnabled ? '' : 'display:none;'}">
                    <input type="text" class="optionReturnBy" maxlength="5" placeholder="22:30" value="${options.optionReturnBy || ''}">
                  </div>
                </div>
                <div class="fgReturnControls" style="${options.optionReturnEnabled ? '' : 'display:none;'}">
                  <div class="fg-return-quick">
                    <input type="button" class="btn fgReturnQuick" data-hours="1" value="+1h">
                    <input type="button" class="btn fgReturnQuick" data-hours="2" value="+2h">
                    <input type="button" class="btn fgReturnQuick" data-hours="4" value="+4h">
                  </div>
                  <div class="fg-return-hint">Feste Zieluhrzeit: Ein eingestelltes 22:30 bleibt 22:30. Liegt die Uhrzeit heute bereits in der Vergangenheit, wird morgen 22:30 verwendet.</div>
                </div>
              </div>
            </div>
          </div>

          <div class="fg-card">
            ${fgSectionTitle('barbs', 'Barbaren-Analyse', false)}
            <div class="fg-card-body" style="${fgSectionStyle('barbs', false)}">
              <div class="fg-barb-head">
                <div class="fg-barb-head-text">Zeigt für jedes deiner Dörfer, wie viele Barbarendörfer in 5, 10, 15 und 20 Feldern liegen.</div>
                <input type="button" class="btn fgBarbAnalyze" value="Barbarendörfer analysieren">
              </div>
              <div class="fgBarbAnalysisResult"></div>
            </div>
          </div>

          <div class="fg-card">
            ${fgSectionTitle('scouts', 'BB erschließen', true)}
            <div class="fg-card-body" style="${fgSectionStyle('scouts', true)}">
              <div class="fg-barb-head">
                <div class="fg-barb-head-text">Findet BBs innerhalb der gemeinsamen Reichweite, die im Farm-Assistenten noch fehlen, und verteilt je 1 Späher.</div>
                <div class="fgScoutControls">
                  <input type="button" class="btn fgScoutAnalyze" value="Fehlende BBs finden">
                  <input type="button" class="btn fgScoutToggle" value="${fgIsScoutPlanEnabled() ? 'BB-Erschließung pausieren' : 'BB-Erschließung aktivieren'}" ${fgGetStoredScouts().length ? '' : 'disabled'}>
                </div>
              </div>
              <div class="fgScoutPlanState" style="padding:0 10px 9px;font-size:11px;color:#705635;">
                <b>Status:</b> ${
                  fgGetStoredScouts().length
                    ? (fgIsScoutPlanEnabled()
                        ? `<span class="fgStateActive">AKTIV – ${fgGetStoredScouts().length} Späher reserviert</span>`
                        : `<span class="fgStatePaused">PAUSIERT – keine Späher reserviert</span>`)
                    : 'Noch kein Späher-Plan gespeichert.'
                }
              </div>
              <div class="fgScoutResult" style="display:none;border-top:1px solid #d6bd91;padding:10px;background:#fff7e8;"></div>
            </div>
          </div>

          <div class="fg-card">
            ${fgSectionTitle('wallbreaker', 'Mauerbrecher', true)}
            <div class="fg-card-body" style="${fgSectionStyle('wallbreaker', true)}">
              <div class="fg-barb-head">
                <div class="fg-barb-head-text">Verfolgt Mauerbrecher von geplant über vorbereitet und gesendet bis zur neuen Mauerauswertung. Veränderte Mauern werden automatisch neu berechnet.</div>
                <div class="fgWallControls">
                  <input type="button" class="btn fgWallAnalyze" value="Mauerziele analysieren">
                  <input type="button" class="btn fgWallReset" value="Gemeinsamen Plan löschen">
                </div>
              </div>
              <div class="fgWallLifecycleLegend">
                <span class="fgWallLife fgWallLife-planned">🟡 geplant</span>
                <span class="fgWallLife fgWallLife-prepared">🔵 vorbereitet</span>
                <span class="fgWallLife fgWallLife-waiting_report">🟣 wartet auf neue Daten</span>
                <span class="fgWallLife fgWallLife-needs_replan">🔄 neu planen</span>
                <span class="fgWallLife fgWallLife-cleared">✅ erledigt</span>
              </div>
              <div class="fgWallbreakerResult" style="display:none;border-top:1px solid #d6bd91;padding:10px;background:#fff7e8;"></div>
            </div>
          </div>

          <div class="fg-card">
            ${fgSectionTitle('reserve', 'Truppenreserve pro Dorf', false)}
            <div class="fg-card-body" style="${fgSectionStyle('reserve', false)}">
              <div class="fgReserveHead">
                <label class="fg-check"><input type="checkbox" class="fgReserveEnabled" ${options.reserveEnabled ? 'checked' : ''}> Reserve aktivieren</label>
                <span>Diese Truppen bleiben in jedem eigenen Dorf unangetastet.</span>
              </div>
              <div class="fgReserveGrid ${options.reserveEnabled ? '' : 'fgReserveDisabled'}">
                <label>🛡 Speer<input type="number" min="0" class="fgReserveInput fgReserveSpear" value="${options.reserveSpear || 0}"></label>
                <label>⚔ Schwert<input type="number" min="0" class="fgReserveInput fgReserveSword" value="${options.reserveSword || 0}"></label>
                <label>🪓 Axt<input type="number" min="0" class="fgReserveInput fgReserveAxe" value="${options.reserveAxe || 0}"></label>
                <label>👁 Späher<input type="number" min="0" class="fgReserveInput fgReserveSpy" value="${options.reserveSpy || 0}"></label>
                <label>🐎 Leichte Kav.<input type="number" min="0" class="fgReserveInput fgReserveLight" value="${options.reserveLight || 0}"></label>
                <label>🔨 Rammen<input type="number" min="0" class="fgReserveInput fgReserveRam" value="${options.reserveRam || 0}"></label>
              </div>
              <div class="fg-common-note">Die Reserve gilt gemeinsam für Farmplan, BB-Erschließung und Mauerbrecher. Beispiel: 50 Späher bedeutet, dass FarmGod+ pro Dorf immer mindestens 50 Späher unberührt lässt. Wert 0 = keine Reserve.</div>
            </div>
          </div>

          <div class="fg-card">
            ${fgSectionTitle('behavior', 'Weitere Einstellungen', false)}
            <div class="fg-card-body" style="${fgSectionStyle('behavior', false)}">
              <div class="fg-grid">
                <label>Teilweise Verluste zulassen</label><div class="fg-check"><input type="checkbox" class="optionLosses" ${options.optionLosses ? 'checked' : ''}> Ziel trotzdem berücksichtigen</div>
                <label>Größere Vorlage bei voller Beute</label><div class="fg-check"><input type="checkbox" class="optionMaxloot" ${options.optionMaxloot ? 'checked' : ''}> Aktiv</div>
                <label>Simulations-Check</label><div><input type="number" min="10" max="300" class="fgSimulationRefresh" value="${options.simulationRefreshSeconds || 30}" style="width:72px;padding:5px;border:1px solid #a98955;"> Sekunden</div>
                ${game_data.market == 'nl' ? `<label>Neue Barbarendörfer ergänzen</label><div class="fg-check"><input type="checkbox" class="optionNewbarbs" ${options.optionNewbarbs ? 'checked' : ''}> Aktiv</div>` : ''}
              </div>
            </div>
          </div>

          <div class="fg-actions fgMainActions">
              <button type="button" class="btn fgPlanRefresh fgActionButton"><span class="fgActionIcon">↻</span><span>Plan aktualisieren</span></button>
              <button type="button" class="btn fgSimulationStart fgActionButton"><span class="fgActionIcon">🧪</span><span>Simulation starten</span></button>
              <button type="button" class="btn optionButton fg-primary fgActionButton fgActionPrimary"><span class="fgActionIcon">⚡</span><span>Gesamtplan erstellen</span></button>
            </div>
        </div>
      </div>`;
    });
  };

  const buildGroupSelect = function (id) {
    return $.get(
      TribalWars.buildURL('GET', 'groups', { ajax: 'load_group_menu' })
    ).then((groups) => {
      let html = `<select class="optionGroup">`;

      groups.result.forEach((val) => {
        if (val.type == 'separator') {
          html += `<option disabled=""/>`;
        } else {
          html += `<option value="${val.group_id}" ${val.group_id == id ? 'selected' : ''
            }>${val.name}</option>`;
        }
      });

      html += `</select>`;

      return html;
    });
  };

  const fgFarmPlanStateKey = function () {
    return 'farmGod_farm_plan_state_' + game_data.world + '_' + game_data.player.id;
  };

  const fgReadFarmPlanState = function () {
    try {
      const value = JSON.parse(localStorage.getItem(fgFarmPlanStateKey()) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (e) {
      return {};
    }
  };

  const fgWriteFarmPlanState = function (state) {
    localStorage.setItem(fgFarmPlanStateKey(), JSON.stringify(state || {}));
  };

  const fgFarmPlanSignature = function (item) {
    return [
      String(item.originId || ''),
      String(item.targetId || ''),
      String(item.templateId || ''),
      String(item.arrival || '')
    ].join('|');
  };

  const fgApplyFarmPlanState = function (plan) {
    const state = fgReadFarmPlanState();
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);

    Object.keys(state).forEach(function (signature) {
      if (state[signature] && state[signature].updatedAt && state[signature].updatedAt < cutoff) {
        delete state[signature];
      }
    });

    Object.keys(plan.farms || {}).forEach(function (coord) {
      (plan.farms[coord] || []).forEach(function (item) {
        const signature = fgFarmPlanSignature({
          originId: item.origin.id,
          targetId: item.target.id,
          templateId: item.template.id,
          arrival: item.arrival
        });
        const saved = state[signature];
        item.status = saved && saved.status ? saved.status : 'planned';
        item.planSignature = signature;
      });
    });

    fgWriteFarmPlanState(state);
    return plan;
  };

  const fgSaveFarmPlan = function (plan) {
    const state = fgReadFarmPlanState();

    Object.keys(plan.farms || {}).forEach(function (coord) {
      (plan.farms[coord] || []).forEach(function (item) {
        const signature = fgFarmPlanSignature({
          originId: item.origin.id,
          targetId: item.target.id,
          templateId: item.template.id,
          arrival: item.arrival
        });
        const previous = state[signature] || {};
        state[signature] = {
          status: item.status || previous.status || 'planned',
          updatedAt: Date.now(),
          originId: item.origin.id,
          targetId: item.target.id,
          templateId: item.template.id,
          arrival: item.arrival || null
        };
      });
    });

    fgWriteFarmPlanState(state);
  };

  const fgUpdateFarmPlanItemStatus = function (signature, status) {
    if (!signature) return;
    const state = fgReadFarmPlanState();
    const current = state[signature] || {};
    current.status = status;
    current.updatedAt = Date.now();
    state[signature] = current;
    fgWriteFarmPlanState(state);
  };

  const fgGetFarmPlanStatusLabel = function (status) {
    if (status === 'sent') return '✓ gesendet';
    if (status === 'skipped') return '⏭ übersprungen';
    if (status === 'failed') return '⚠ Fehler';
    return '● geplant';
  };

  const fgGetUnifiedQueue = function (plan) {
    const queue = [];
    const integration = plan.integration || {};
    const scouts = integration.scouts || [];
    const wallbreakers = integration.wallbreakers || [];

    scouts.forEach(function (item) {
      queue.push({
        type: 'scout',
        priority: 1,
        targetId: item.targetId,
        targetCoord: item.targetCoord,
        originId: item.originId,
        originCoord: item.originCoord,
        originName: item.originName,
        status: item.status || 'planned',
        units: item.units || { spy: 1 }
      });
    });

    wallbreakers.forEach(function (item) {
      queue.push({
        type: 'wallbreaker',
        priority: 2,
        targetId: item.targetId,
        targetCoord: item.targetCoord,
        originId: item.originId,
        originCoord: item.originCoord,
        originName: item.originName,
        status: item.status || 'planned',
        wall: item.wall,
        units: item.units || {}
      });
    });

    Object.keys(plan.farms || {}).forEach(function (key) {
      (plan.farms[key] || []).forEach(function (item) {
        queue.push({
          type: 'farm',
          priority: 3,
          targetId: item.target.id,
          targetCoord: item.target.coord,
          originId: item.origin.id,
          originCoord: item.origin.coord,
          originName: item.origin.name,
          fields: item.fields,
          templateId: item.template.id,
          templateName: item.template.name,
          arrival: item.arrival || null,
          status: item.status || 'planned',
          planSignature: item.planSignature || fgFarmPlanSignature({
            originId: item.origin.id,
            targetId: item.target.id,
            templateId: item.template.id,
            arrival: item.arrival
          })
        });
      });
    });

    queue.sort(function (a, b) {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const af = Number.isFinite(a.fields) ? a.fields : fgDistanceCoords(a.originCoord, a.targetCoord);
      const bf = Number.isFinite(b.fields) ? b.fields : fgDistanceCoords(b.originCoord, b.targetCoord);
      return af - bf;
    });

    return queue;
  };

  const fgQueueTypeLabel = function (item) {
    if (item.type === 'scout') return '🔎 Späher';
    if (item.type === 'wallbreaker') return '🔨 Mauerbrecher';
    return '⚔ Farm ' + String(item.templateName || '').toUpperCase();
  };

  const fgBuildBottleneckAnalysis = function (plan) {
    const stats = plan.stats || {};
    const integration = plan.integration || {};
    const diagnostics = plan.diagnostics || {};
    const reserve = plan.troopReserve || fgGetTroopReserve();
    const evaluatedTemplates = Math.max(
      1,
      parseInt(stats.evaluatedTemplates, 10) || 0
    );

    const unitLabels = {
      spear: 'Speere',
      sword: 'Schwerter',
      axe: 'Äxte',
      spy: 'Späher',
      light: 'Leichte Kavallerie',
      marcher: 'Berittene Bogenschützen',
      heavy: 'Schwere Kavallerie'
    };

    const reasons = [
      {
        key: 'troops',
        label: 'Nicht genug nutzbare Truppen',
        count: parseInt(stats.troops, 10) || 0,
        hint: reserve.enabled
          ? 'Für diese eindeutigen Dorf-Ziel-Vorlagen-Kombinationen fehlen Einheiten nach Abzug von Reserve und Sonderreservierungen.'
          : 'Für diese eindeutigen Dorf-Ziel-Vorlagen-Kombinationen fehlen die benötigten Einheiten.'
      },
      {
        key: 'time',
        label: 'Mindestabstand / Zeitkonflikt',
        count: parseInt(stats.time, 10) || 0,
        hint: 'Die geplante Ankunft wäre zu nah an einer bereits bekannten Ankunft am selben Ziel.'
      },
      {
        key: 'distance',
        label: 'Außerhalb der Reichweite',
        count: parseInt(stats.distance, 10) || 0,
        hint: 'Diese Dorf-Ziel-Paare liegen außerhalb deiner gemeinsamen Reichweite.'
      },
      {
        key: 'returnTime',
        label: 'Rückkehr wäre zu spät',
        count: parseInt(stats.returnTime, 10) || 0,
        hint: 'Die Truppen würden deine eingestellte Rückkehrfrist überschreiten.'
      },
      {
        key: 'arrivalTime',
        label: 'Ankunft wäre zu spät',
        count: parseInt(stats.arrivalTime, 10) || 0,
        hint: 'Der Angriff würde nach deiner eingestellten Ziel-Ankunftszeit eintreffen.'
      },
      {
        key: 'blockedTargets',
        label: 'Durch Mauerbrecher blockierte Ziele',
        count: parseInt(integration.blockedTargets, 10) || 0,
        hint: 'Diese Ziele werden erst nach dem Mauerbrecher wieder normal in den Farmplan aufgenommen.'
      }
    ];

    reasons.sort(function (a, b) {
      return b.count - a.count;
    });

    const activeReasons = reasons.filter(function (reason) {
      return reason.count > 0;
    });

    let reserveText = 'Keine Truppenreserve aktiv.';
    if (reserve.enabled) {
      const parts = [];
      [
        ['Speer', reserve.spear],
        ['Schwert', reserve.sword],
        ['Axt', reserve.axe],
        ['Späher', reserve.spy],
        ['LKav', reserve.light],
        ['Rammen', reserve.ram]
      ].forEach(function (pair) {
        if (pair[1] > 0) parts.push(pair[0] + ' ' + pair[1]);
      });
      reserveText = parts.length
        ? 'Reserve pro Dorf: ' + parts.join(' · ')
        : 'Truppenreserve ist aktiviert, alle Werte stehen aber auf 0.';
    }

    const missingUnits = Object.keys(diagnostics.troopMissingByUnit || {})
      .map(function (unit) {
        const info = diagnostics.troopMissingByUnit[unit];
        return {
          unit: unit,
          label: unitLabels[unit] || unit,
          combinations: parseInt(info.combinations, 10) || 0,
          missingTotal: parseInt(info.missingTotal, 10) || 0
        };
      })
      .sort(function (a, b) {
        if (b.combinations !== a.combinations) {
          return b.combinations - a.combinations;
        }
        return b.missingTotal - a.missingTotal;
      });

    const missingTemplates = Object.keys(diagnostics.troopMissingByTemplate || {})
      .map(function (template) {
        return {
          template: String(template).toUpperCase(),
          count: parseInt(diagnostics.troopMissingByTemplate[template], 10) || 0
        };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });

    let html = '<div class="fgBottleneckBox">' +
      '<div class="fgBottleneckHead">' +
        '<div><b>Warum gehen nicht mehr Angriffe?</b>' +
        '<span>Analyse der einmalig geprüften Dorf-Ziel-/Vorlagen-Kombinationen – unabhängig von den späteren Optimierungsvarianten.</span></div>' +
        '<button type="button" class="btn fgBottleneckToggle">Details anzeigen</button>' +
      '</div>';

    if (!activeReasons.length) {
      html += '<div class="fgBottleneckGood">Kein klarer Engpass aus den aktuellen Prüfwerten erkennbar.</div>';
    } else {
      const top = activeReasons[0];
      html += '<div class="fgBottleneckTop"><b>Größter Engpass:</b> ' +
        top.label + ' (' + top.count + ')' +
        '<span>' + top.hint + '</span></div>';

      html += '<div class="fgBottleneckBody" style="display:none;">' +
        '<div class="fgDiagnosticBasis"><b>Prüfbasis:</b> ' +
        (parseInt(stats.candidates, 10) || 0) + ' Dorf-Ziel-Paare · ' +
        (parseInt(stats.evaluatedTemplates, 10) || 0) +
        ' konkrete Vorlagen-Kombinationen.</div>';

      activeReasons.forEach(function (reason) {
        let pct = null;
        if (reason.key !== 'blockedTargets' && reason.key !== 'distance') {
          pct = Math.min(100, (reason.count / evaluatedTemplates) * 100);
        }

        html += '<div class="fgBottleneckRow">' +
          '<div class="fgBottleneckLabel"><b>' + reason.label + '</b><span>' + reason.hint + '</span></div>' +
          '<div class="fgBottleneckNumber"><b>' + reason.count + '</b>' +
            (pct === null ? '' : '<span>' + pct.toFixed(1) + '% der Vorlagenprüfungen</span>') +
          '</div>' +
        '</div>';
      });

      if (missingUnits.length) {
        html += '<div class="fgDiagnosticSection"><b>Welche Truppen fehlen?</b>';
        missingUnits.forEach(function (entry) {
          html += '<div class="fgDiagnosticRow"><span>' + entry.label + '</span>' +
            '<b>' + entry.combinations + ' Kombinationen</b>' +
            '<small>insgesamt ' + entry.missingTotal + ' Stück zu wenig</small></div>';
        });
        html += '</div>';
      }

      if (missingTemplates.length) {
        html += '<div class="fgDiagnosticSection"><b>Welche Vorlage scheitert an Truppen?</b>';
        missingTemplates.forEach(function (entry) {
          html += '<div class="fgDiagnosticRow"><span>Vorlage ' + entry.template + '</span>' +
            '<b>' + entry.count + ' Kombinationen</b></div>';
        });
        html += '</div>';
      }

      html += '<div class="fgBottleneckReserve"><b>Reserve:</b> ' + reserveText + '</div>' +
        '<div class="fgBottleneckHint"><b>Wichtig:</b> Die Zahlen entstehen nur einmal beim Aufbau der möglichen Kombinationen. Die danach getesteten Optimierungsvarianten erhöhen diese Zähler nicht. Ein Dorf-Ziel-Paar kann trotzdem mehr als eine Vorlagenprüfung erzeugen, z. B. wenn A und B als mögliche Vorlage geprüft werden.</div>' +
      '</div>';
    }

    html += '</div>';
    return html;
  };

  const buildTable = function (plan) {
    const stats = plan.stats || {};
    const details = plan.details || {};
    const remaining = plan.remaining || {};
    const planned = plan.counter || 0;
    const comparison = plan.comparison || { legacy: planned, efficient: planned, gain: 0, source: 'optimized' };

    const escapeHtml = function (value) {
      return $('<div>').text(String(value)).html();
    };

    const buildDetailBox = function (key, title) {
      const rows = details[key] || [];
      let body = '';

      if (rows.length === 0) {
        body = '<tr><td colspan="3" style="text-align:center;padding:8px;">Keine Einträge.</td></tr>';
      } else {
        rows.slice(0, 200).forEach(function (row) {
          body += '<tr>' +
            '<td>' + escapeHtml(row.origin) + '</td>' +
            '<td>' + escapeHtml(row.target) + '</td>' +
            '<td>' + escapeHtml(row.info) + '</td>' +
            '</tr>';
        });
      }

      return '<div class="fgDetailBox fgDetail_' + key + '" style="display:none;margin:0 10px 10px;padding:8px;background:#fffaf0;border:1px solid #c9a976;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
          '<b>' + title + '</b>' +
          '<button type="button" class="btn fgDetailClose">Schließen</button>' +
        '</div>' +
        '<div style="max-height:220px;overflow:auto;">' +
          '<table class="vis" width="100%">' +
            '<tr><th>Ausgang</th><th>Ziel</th><th>Grund</th></tr>' +
            body +
          '</table>' +
        '</div>' +
      '</div>';
    };

    let html = '<style>' +
      '.farmGodContent{margin-bottom:12px!important;}' +
      '.fgPlanHeader{background:#6f4b27;color:#fff;padding:9px 11px;display:flex;justify-content:space-between;align-items:center;}' +
      '.fgPlanTitle{font-size:17px;font-weight:bold;}' +
      '.fgPlanHint{font-size:10px;opacity:.9;margin-top:2px;}' +
      '.fgStats{display:flex;gap:7px;flex-wrap:wrap;padding:10px;}' +
      '.fgStat{flex:1;min-width:110px;text-align:center;background:#fffaf0;border:1px solid #c9a976;padding:7px 5px;}' +
      '.fgStat strong{display:block;font-size:17px;color:#5f421f;}' +
      '.fgStatClickable{cursor:pointer;}' +
      '.fgStatClickable:hover{background:#f0dfbe;}' +
      '.fgRemainingWrap{margin:0 10px 9px;border:1px solid #c9a976;background:#efe0c2;}' +
      '.fgRemainingToggle{width:100%;box-sizing:border-box;text-align:left;padding:7px 9px;border:0;background:#e4cfa6;cursor:pointer;font-weight:bold;color:#5f421f;}' +
      '.fgRemainingToggle:hover{background:#dcc18e;}' +
      '.fgRemainingBody{display:none;padding:6px 8px;}' +
      '.fgRemaining{margin:4px 0;padding:6px 8px;background:#fff7e7;border:1px solid #d5bb8d;font-size:11px;}' +
      '.fgRemainingUnit{display:inline-flex;align-items:center;gap:3px;margin-right:10px;white-space:nowrap;}' +
      '.fgRemainingUnit img{width:18px;height:18px;vertical-align:middle;}' +
      '.fgTableWrap{padding:0 10px 10px;overflow:auto;}' +
      '.fgActionWrap{display:flex;gap:8px;justify-content:center;align-items:center;}' +
      '.fgNextAttack td{box-shadow:inset 0 2px 0 #6f4b27,inset 0 -2px 0 #6f4b27;background:#fff1c9!important;}' +
      '.fgNextBadge{display:inline-block;margin-left:5px;padding:1px 5px;background:#6f4b27;color:#fff;border-radius:9px;font-size:9px;font-weight:bold;}' +
      '.fgKeyboardBar{margin:0 10px 9px;padding:7px 9px;background:#f7edda;border:1px solid #d6bd91;font-size:11px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;}' +
      '.fgKeyboardBar kbd{display:inline-block;padding:2px 6px;border:1px solid #9f8357;border-radius:3px;background:#fffaf0;font-weight:bold;}' +
      '.fgSendLabel{display:inline-flex;align-items:center;gap:4px;font-weight:bold;}' +
      '.fgSkip{font-size:10px!important;padding:2px 6px!important;}' +
      '.fgProgressText{text-align:center;font-size:11px;font-weight:bold;color:#5f421f;margin:4px 0 8px;}' +
      '.fgPlanStatus{display:inline-block;margin-top:3px;padding:2px 6px;background:#ead9b8;border:1px solid #c9a976;border-radius:9px;font-size:9px;font-weight:bold;color:#6f4b27;}' +
      '.fgPlanStatus-planned{background:#fff2c8;border-color:#d5ae3f;color:#80600f;}' +
      '.fgPlanStatus-sent{background:#e4f0d3;border-color:#8ea95e;color:#45631b;}' +
      '.fgPlanStatus-skipped{background:#ece7dc;border-color:#b8aa92;color:#6f6251;}' +
      '.fgPlanStatus-failed{background:#f7dfd8;border-color:#c87c6a;color:#972f22;}' +
      '.fgPlanDone{opacity:.62;}' +
      '.fgPlanDone td{background:#eee7d9!important;}' +
      '.fgStatusSummary{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin:0 10px 9px;}' +
      '.fgStatusSummary>div{text-align:center;background:#fffaf0;border:1px solid #c9a976;border-radius:4px;padding:8px 5px;}' +
      '.fgStatusSummary strong{display:block;font-size:17px;color:#5f421f;}' +
      '.fgStatusSummary span{font-size:10px;color:#705635;}' +
      '.fgUnifiedSummary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:0 10px 9px;}' +
      '.fgUnifiedSummary>div{text-align:center;background:#fffaf0;border:1px solid #c9a976;border-radius:4px;padding:8px 5px;}' +
      '.fgUnifiedSummary strong{display:block;font-size:17px;color:#5f421f;}' +
      '.fgUnifiedSummary span{font-size:10px;color:#705635;}' +
      '.fgDiagnosticBasis{padding:7px 8px;margin-bottom:5px;background:#f7edda;border:1px solid #d6bd91;font-size:9px;color:#705635;}' +
      '.fgDiagnosticSection{margin-top:8px;padding:8px;background:#fff7e7;border:1px solid #d6bd91;font-size:10px;}' +
      '.fgDiagnosticSection>b{display:block;margin-bottom:5px;color:#5f421f;}' +
      '.fgDiagnosticRow{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:4px 0;border-top:1px solid #eadcc5;}' +
      '.fgDiagnosticRow:first-of-type{border-top:0;}' +
      '.fgDiagnosticRow small{font-size:8px;color:#806c50;}' +
      '@media(max-width:800px){.fgStatusSummary{grid-template-columns:repeat(3,1fr);}.fgUnifiedSummary{grid-template-columns:repeat(2,1fr);}.fgDiagnosticRow{grid-template-columns:1fr auto;}.fgDiagnosticRow small{grid-column:1 / -1;}}' +
      '.fgPlanInfo{margin:0 10px 9px;padding:6px 9px;background:#edf3df;border:1px solid #b7c68d;color:#4d612b;font-size:10px;line-height:1.35;}' +
      '.fgBottleneckBox{margin:0 10px 9px;border:1px solid #c9a976;background:#fffaf0;}' +
      '.fgBottleneckHead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 9px;background:#ead9b8;}' +
      '.fgBottleneckHead>div{display:flex;flex-direction:column;gap:2px;}' +
      '.fgBottleneckHead span{font-size:9px;color:#705635;font-weight:normal;}' +
      '.fgBottleneckToggle{white-space:nowrap;font-size:10px!important;}' +
      '.fgBottleneckTop{padding:8px 9px;background:#fff2c8;border-top:1px solid #d5ae3f;color:#70511a;font-size:11px;}' +
      '.fgBottleneckTop span{display:block;margin-top:3px;font-size:9px;color:#806526;}' +
      '.fgBottleneckGood{padding:9px;color:#45631b;background:#edf3df;border-top:1px solid #a8b87c;font-size:10px;}' +
      '.fgBottleneckBody{padding:7px 9px;}' +
      '.fgBottleneckRow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #eadcc5;}' +
      '.fgBottleneckLabel{display:flex;flex-direction:column;gap:2px;}' +
      '.fgBottleneckLabel span{font-size:9px;color:#705635;line-height:1.3;}' +
      '.fgBottleneckNumber{text-align:right;min-width:95px;}' +
      '.fgBottleneckNumber b{display:block;font-size:15px;color:#5f421f;}' +
      '.fgBottleneckNumber span{display:block;font-size:8px;color:#806c50;}' +
      '.fgBottleneckReserve{margin-top:7px;padding:7px 8px;background:#edf3df;border:1px solid #b7c68d;font-size:9px;color:#4d612b;}' +
      '.fgBottleneckHint{margin-top:6px;font-size:9px;color:#705635;line-height:1.35;}' +
      '@media(max-width:800px){.fgActionWrap{gap:6px;justify-content:flex-start;}.farmGod_icon{transform:scale(1.08);transform-origin:center;}.fgSkip{min-height:30px;}.fgNextBadge{font-size:8px;}.fgTableWrap{padding-left:4px;padding-right:4px;}}' +
      '</style>';

    html += '<div class="vis farmGodContent">';
    html += '<div class="fgPlanHeader">' +
      '<div><div class="fgPlanTitle">FarmGod+ – Farmplan</div>' +
      '<div class="fgPlanHint">Effizienzmodus: Mehrfachsuche nach der größten Angriffszahl. Ziel-Ankunft und Rückkehrfrist werden dabei berücksichtigt.</div></div>' +
      '<div class="fgOpenCount"><b>' + planned + '</b> offen</div>' +
      '</div>';

    html += '<div class="fgStats">' +
      '<div class="fgStat"><strong>' + planned + '</strong>verwendeter Plan</div>' +
      '<div class="fgStat"><strong>' + comparison.legacy + '</strong>alter Plan</div>' +
      '<div class="fgStat"><strong>' + comparison.efficient + '</strong>Optimierer</div>' +
      '<div class="fgStat"><strong>' + (comparison.gain >= 0 ? '+' : '') + comparison.gain + '</strong>Mehrangriffe</div>' +
      '<div class="fgStat fgStatClickable" data-detail="time"><strong>' + (stats.time || 0) + '</strong>Zeitkonflikte</div>' +
      '<div class="fgStat fgStatClickable" data-detail="troops"><strong>' + (stats.troops || 0) + '</strong>nicht genug Truppen</div>' +
      '<div class="fgStat fgStatClickable" data-detail="distance"><strong>' + (stats.distance || 0) + '</strong>zu weit</div>' +
      '<div class="fgStat"><strong>' + (stats.candidates || 0) + '</strong>Dorf-Ziel-Paare</div>' +
      '<div class="fgStat"><strong>' + (stats.evaluatedTemplates || 0) + '</strong>Vorlagen geprüft</div>' +
      ((stats.returnTime || 0) > 0 ? '<div class="fgStat fgStatClickable" data-detail="returnTime"><strong>' + stats.returnTime + '</strong>Rückkehr zu spät</div>' : '') +
      ((stats.arrivalTime || 0) > 0 ? '<div class="fgStat fgStatClickable" data-detail="arrivalTime"><strong>' + stats.arrivalTime + '</strong>Ankunft zu spät</div>' : '') +
      '</div>';

    html += fgBuildBottleneckAnalysis(plan);

    if (comparison.source === 'legacy-fallback') {
      html += '<div style="margin:0 10px 9px;padding:7px 9px;background:#fff1c9;border:1px solid #c99a37;font-size:11px;"><b>Sicherheitsmodus aktiv:</b> Der Optimierer war schlechter als der alte Plan. FarmGod+ verwendet deshalb automatisch den besseren alten Plan.</div>';
    }

    if (plan.integration) {
      const wallbreakers = plan.integration.wallbreakers || [];
      const scouts = plan.integration.scouts || [];
      if (wallbreakers.length || scouts.length) {
        const reservedAxe = wallbreakers.reduce(function (sum, x) { return sum + (parseInt(x.units && x.units.axe, 10) || 0); }, 0);
        const reservedRam = wallbreakers.reduce(function (sum, x) { return sum + (parseInt(x.units && x.units.ram, 10) || 0); }, 0);
        const breakerSpy = wallbreakers.reduce(function (sum, x) { return sum + (parseInt(x.units && x.units.spy, 10) || 0); }, 0);
        html += '<div class="fgIntegrationNotice"><b>Gemeinsamer Plan verknüpft:</b> ' +
          wallbreakers.length + ' Mauerziele · ' +
          scouts.length + ' neue BBs per Späher · reserviert: ' +
          reservedAxe + ' Axt · ' + reservedRam + ' Rammen · ' +
          (breakerSpy + scouts.length) + ' Späher.</div>';
      }
    }

    if (plan.searchInfo) {
      html += '<div style="margin:0 10px 9px;padding:5px 8px;background:#f7edda;border:1px solid #d6bd91;font-size:10px;color:#705635;">Optimierung: <b>' +
        plan.searchInfo.strategies + '</b> Planvarianten aus <b>' +
        plan.searchInfo.candidates + '</b> möglichen Kombinationen geprüft.</div>';
    }

    html += buildDetailBox('time', 'Zeitkonflikte');
    html += buildDetailBox('troops', 'Nicht genug Truppen');
    html += buildDetailBox('distance', 'Außerhalb der maximalen Entfernung');
    html += buildDetailBox('returnTime', 'Rückkehr wäre zu spät');
    html += buildDetailBox('arrivalTime', 'Ankunft im Ziel wäre zu spät');

    html += '<div class="fgKeyboardBar"><b>Gesamtplan-Schnellsteuerung:</b> <span><kbd>Enter</kbd> nächste Aktion</span><span><kbd>↓</kbd>/<kbd>↑</kbd> auswählen</span><span><kbd>S</kbd> überspringen</span></div>';
    html += '<div class="fgPlanInfo">Wiederholte Farmangriffe bleiben möglich: Ein fehlender Bericht sperrt ein Ziel nicht. Es zählt nur der eingestellte Mindestabstand zu bereits bekannten Ankunftszeiten.</div>';

    html += '<div style="padding:0 10px 0;">' +
      '<div id="FarmGodProgessbar" class="progress-bar live-progress-bar progress-bar-alive" style="width:100%;margin:0 auto;">' +
      '<div style="background:rgb(146,194,0);"></div><span class="label" style="margin-top:0px;"></span></div>' +
      '</div>';

    if (Object.keys(remaining).length > 0) {
      html += '<div class="fgRemainingWrap">' +
        '<button type="button" class="fgRemainingToggle">▶ Resttruppen anzeigen (' + Object.keys(remaining).length + ' Dörfer)</button>' +
        '<div class="fgRemainingBody">';

      Object.keys(remaining).forEach(function (coord) {
        const village = remaining[coord];
        let unitText = '';

        village.units.forEach(function (count, index) {
          if (count > 0) {
            const unitName = game_data.units[index] || ('Einheit ' + (index + 1));
            const iconUrl = '/graphic/unit/unit_' + unitName + '.png';
            unitText += '<span class="fgRemainingUnit" title="' + escapeHtml(unitName) + '">' +
              '<img src="' + iconUrl + '" alt="' + escapeHtml(unitName) + '">' +
              '<b>' + count + '</b></span>';
          }
        });

        if (!unitText) unitText = 'Keine nutzbaren Resttruppen.';
        html += '<div class="fgRemaining"><b>' +
          escapeHtml(village.name) + ' (' + escapeHtml(coord) + '):</b> ' +
          unitText + '</div>';
      });

      html += '</div></div>';
    }

    const unifiedQueue = fgGetUnifiedQueue(plan);
    const scoutCount = unifiedQueue.filter(function (x) { return x.type === 'scout'; }).length;
    const breakerCount = unifiedQueue.filter(function (x) { return x.type === 'wallbreaker'; }).length;
    const farmCount = unifiedQueue.filter(function (x) { return x.type === 'farm'; }).length;

    const farmPlannedCount = unifiedQueue.filter(function (x) {
      return x.type === 'farm' && (!x.status || x.status === 'planned');
    }).length;
    const farmSentCount = unifiedQueue.filter(function (x) {
      return x.type === 'farm' && x.status === 'sent';
    }).length;
    const farmSkippedCount = unifiedQueue.filter(function (x) {
      return x.type === 'farm' && x.status === 'skipped';
    }).length;
    const farmFailedCount = unifiedQueue.filter(function (x) {
      return x.type === 'farm' && x.status === 'failed';
    }).length;

    html += '<div class="fgStatusSummary">' +
      '<div><strong>' + farmPlannedCount + '</strong><span>geplant</span></div>' +
      '<div><strong>' + farmSentCount + '</strong><span>gesendet</span></div>' +
      '<div><strong>' + farmSkippedCount + '</strong><span>übersprungen</span></div>' +
      '<div><strong>' + farmFailedCount + '</strong><span>Fehler</span></div>' +
      '<div><strong>' + scoutCount + '</strong><span>Späher offen</span></div>' +
      '<div><strong>' + breakerCount + '</strong><span>Mauerbrecher offen</span></div>' +
      '</div>';

    html += '<div class="fgUnifiedSummary">' +
      '<div><strong>' + unifiedQueue.length + '</strong><span>Gesamtaktionen</span></div>' +
      '<div><strong>' + scoutCount + '</strong><span>Späher</span></div>' +
      '<div><strong>' + breakerCount + '</strong><span>Mauerbrecher</span></div>' +
      '<div><strong>' + farmCount + '</strong><span>Farmangriffe</span></div>' +
      '</div>';

    html += '<div class="fgTableWrap"><table class="vis" width="100%">' +
      '<tr><th style="text-align:center;">Typ</th>' +
      '<th style="text-align:center;">' + t.table.origin + '</th>' +
      '<th style="text-align:center;">' + t.table.target + '</th>' +
      '<th style="text-align:center;">' + t.table.fields + '</th>' +
      '<th style="text-align:center;">Aktion</th></tr>';

    if (unifiedQueue.length) {
      unifiedQueue.forEach(function (item, i) {
        const fields = Number.isFinite(item.fields)
          ? item.fields
          : fgDistanceCoords(item.originCoord, item.targetCoord);
        let actionHtml = '';

        if (item.type === 'farm') {
          if (item.status === 'sent' || item.status === 'skipped') {
            actionHtml =
              '<span class="fgPlanDoneText">' +
              escapeHtml(fgGetFarmPlanStatusLabel(item.status)) +
              '</span>';
          } else {
            actionHtml =
              '<span class="fgSendLabel"><a href="javascript:void(0)" title="Senden mit Vorlage ' +
              escapeHtml(String(item.templateName).toUpperCase()) +
              '" data-origin="' + item.originId +
              '" data-target="' + item.targetId +
              '" data-template="' + item.templateId +
              '" class="farmGod_icon farm_icon farm_icon_' +
              escapeHtml(item.templateName) + '"></a>' +
              (item.status === 'failed' ? 'Erneut senden' : 'Senden') +
              '</span>';
          }
        } else {
          const units = item.units || {};
          const href = game_data.link_base_pure +
            'place&village=' + item.originId +
            '&target=' + item.targetId +
            (units.axe ? '&axe=' + units.axe : '') +
            (units.ram ? '&ram=' + units.ram : '') +
            (units.spy ? '&spy=' + units.spy : '');

          if (item.type === 'wallbreaker' && item.status === 'waiting_report') {
            actionHtml =
              '<span class="fgWallLife fgWallLife-waiting_report">' +
              fgWallbreakerStatusLabel('waiting_report') + '</span>';
          } else if (item.type === 'wallbreaker' && item.status === 'prepared') {
            actionHtml =
              '<button type="button" class="btn fgUnifiedMarkWallSent" data-target="' +
              item.targetId + '">Als gesendet markieren</button>';
          } else {
            actionHtml =
              '<a class="btn fgUnifiedPrepare" href="' + href +
              '" target="_blank" rel="noopener noreferrer"' +
              ' data-type="' + item.type +
              '" data-target="' + item.targetId + '">Vorbereiten</a>';
          }
        }

        const isDoneFarm = item.type === 'farm' && (item.status === 'sent' || item.status === 'skipped');
        const isWaitingWall = item.type === 'wallbreaker' && item.status === 'waiting_report';

        html += '<tr class="farmRow fgUnifiedRow row_' + (i % 2 === 0 ? 'a' : 'b') +
          ((isDoneFarm || isWaitingWall) ? ' fgPlanDone' : '') +
          '" data-action-type="' + item.type +
          '" data-plan-signature="' + escapeHtml(item.planSignature || '') +
          '" data-arrival="' + escapeHtml(item.arrival || '') + '">' +
          '<td style="text-align:center;"><b>' + fgQueueTypeLabel(item) + '</b>' +
          (item.type === 'farm'
            ? '<br><span class="fgPlanStatus fgPlanStatus-' +
              escapeHtml(item.status || 'planned') + '">' +
              escapeHtml(fgGetFarmPlanStatusLabel(item.status || 'planned')) +
              '</span>'
            : '') +
          (item.type === 'wallbreaker'
            ? '<br><span class="fgQueueSub">Mauer ' + escapeHtml(item.wall) + '</span>' +
              '<br><span class="fgWallLife fgWallLife-' + escapeHtml(item.status || 'planned') + '">' +
              escapeHtml(fgWallbreakerStatusLabel(item.status || 'planned')) + '</span>'
            : '') +
          '</td>' +
          '<td style="text-align:center;"><a href="' + game_data.link_base_pure +
            'info_village&id=' + item.originId + '">' +
            escapeHtml(item.originName || item.originCoord) + ' (' +
            escapeHtml(item.originCoord) + ')</a></td>' +
          '<td style="text-align:center;"><a href="' + game_data.link_base_pure +
            'info_village&id=' + item.targetId + '">' +
            escapeHtml(item.targetCoord) + '</a></td>' +
          '<td style="text-align:center;">' + fields.toFixed(2) + '</td>' +
          '<td><div class="fgActionWrap">' + actionHtml +
            '<button type="button" class="btn fgSkip">Überspringen</button>' +
          '</div></td></tr>';
      });
    } else {
      html += '<tr><td colspan="5" style="text-align:center;padding:12px;">Keine Aktionen geplant.</td></tr>';
    }
    html += '</table></div></div>';
    return html;
  };

  const getData = function (group, newbarbs, losses) {
    let data = {
      villages: {},
      commands: {},
      farms: { templates: {}, farms: {} },
    };

    let villagesProcessor = ($html) => {
      let skipUnits = ['ram', 'catapult', 'knight', 'snob', 'militia'];
      const mobileCheck = $('#mobileHeader').length > 0;

      if (mobileCheck) {
        let table = jQuery($html).find('.overview-container > div');
        table.each((i, el) => {
          try {
            const villageId = jQuery(el)
              .find('.quickedit-vn')
              .data('id');
            const name = jQuery(el)
              .find('.quickedit-label')
              .attr('data-text');
            const coord = jQuery(el)
              .find('.quickedit-label')
              .text()
              .toCoord();

            const units = new Array(game_data.units.length).fill(0);
            const unitsElements = jQuery(el).find(
              '.overview-units-row > div.unit-row-item'
            );

            unitsElements.each((_, unitElement) => {
              const img = jQuery(unitElement).find('img');
              const span =
                jQuery(unitElement).find('span.unit-row-name');
              if (img.length && span.length) {
                let unitType = img
                  .attr('src')
                  .split('unit_')[1]
                  .replace('@2x.webp', '')
                  .replace('.webp', '')
                  .replace('.png', '');
                const value = parseInt(span.text()) || 0;
                const unitIndex =
                  game_data.units.indexOf(unitType);
                if (unitIndex !== -1) {
                  units[unitIndex] = value;
                }
              }
            });

            const filteredUnits = units.filter(
              (_, index) =>
                skipUnits.indexOf(game_data.units[index]) === -1
            );

            data.villages[coord] = {
              name: name,
              id: villageId,
              units: filteredUnits,
            };
          } catch (e) {
            console.error('Error processing village data:', e);
          }
        });
      } else {
        $html
          .find('#combined_table')
          .find('.row_a, .row_b')
          .filter((i, el) => {
            return $(el).find('.bonus_icon_33').length == 0;
          })
          .map((i, el) => {
            let $el = $(el);
            let $qel = $el.find('.quickedit-label').first();
            let units = [];

            units = $el
              .find('.unit-item')
              .filter((index, element) => {
                return (
                  skipUnits.indexOf(game_data.units[index]) ==
                  -1
                );
              })
              .map((index, element) => {
                return $(element).text().toNumber();
              })
              .get();

            return (data.villages[$qel.text().toCoord()] = {
              name: $qel.data('text'),
              id: parseInt(
                $el.find('.quickedit-vn').first().data('id')
              ),
              units: units,
            });
          });
      }

      console.log('villages', data.villages);
      return data;
    };

    let commandsProcessor = ($html) => {
      $html
        .find('#commands_table')
        .find('.row_a, .row_ax, .row_b, .row_bx')
        .map((i, el) => {
          let $el = $(el);
          let coord = $el
            .find('.quickedit-label')
            .first()
            .text()
            .toCoord();

          if (coord) {
            if (!data.commands.hasOwnProperty(coord))
              data.commands[coord] = [];
            return data.commands[coord].push(
              Math.round(
                lib.timestampFromString(
                  $el.find('td').eq(2).text().trim()
                ) / 1000
              )
            );
          }
        });

      return data;
    };

    let farmProcessor = ($html) => {
      if ($.isEmptyObject(data.farms.templates)) {
        let unitSpeeds = lib.getUnitSpeeds();

        $html
          .find('form[action*="action=edit_all"]')
          .find('input[type="hidden"][name*="template"]')
          .closest('tr')
          .map((i, el) => {
            let $el = $(el);

            return (data.farms.templates[
              $el
                .prev('tr')
                .find('a.farm_icon')
                .first()
                .attr('class')
                .match(/farm_icon_(.*)\s/)[1]
            ] = {
              id: $el
                .find(
                  'input[type="hidden"][name*="template"][name*="[id]"]'
                )
                .first()
                .val()
                .toNumber(),
              units: $el
                .find(
                  'input[type="text"], input[type="number"]'
                )
                .map((index, element) => {
                  return $(element).val().toNumber();
                })
                .get(),
              speed: Math.max(
                ...$el
                  .find(
                    'input[type="text"], input[type="number"]'
                  )
                  .map((index, element) => {
                    return $(element).val().toNumber() > 0
                      ? unitSpeeds[
                      $(element)
                        .attr('name')
                        .trim()
                        .split('[')[0]
                      ]
                      : 0;
                  })
                  .get()
              ),
            });
          });
      }

      $html
        .find('#plunder_list')
        .find('tr[id^="village_"]')
        .map((i, el) => {
          let $el = $(el);

          return (data.farms.farms[
            $el
              .find('a[href*="screen=report&mode=all&view="]')
              .first()
              .text()
              .toCoord()
          ] = {
            id: $el.attr('id').split('_')[1].toNumber(),
            color: $el
              .find('img[src*="graphic/dots/"]')
              .attr('src')
              .match(/dots\/(green|yellow|red|blue|red_blue)/)[1],
            max_loot: $el.find('img[src*="max_loot/1"]').length > 0,
          });
        });

      return data;
    };

    let findNewbarbs = () => {
      if (newbarbs) {
        return twLib.get('/map/village.txt').then((allVillages) => {
          allVillages.match(/[^\r\n]+/g).forEach((villageData) => {
            let [id, name, x, y, player_id] =
              villageData.split(',');
            let coord = `${x}|${y}`;

            if (
              player_id == 0 &&
              !data.farms.farms.hasOwnProperty(coord)
            ) {
              data.farms.farms[coord] = {
                id: id.toNumber(),
              };
            }
          });

          return data;
        });
      } else {
        return data;
      }
    };

    let filterFarms = () => {
      data.farms.farms = Object.fromEntries(
        Object.entries(data.farms.farms).filter(([key, val]) => {
          return (
            !val.hasOwnProperty('color') ||
            (val.color != 'red' &&
              val.color != 'red_blue' &&
              (val.color != 'yellow' || losses))
          );
        })
      );

      return data;
    };

    return Promise.all([
      lib.processAllPages(
        TribalWars.buildURL('GET', 'overview_villages', {
          mode: 'combined',
          group: group,
        }),
        villagesProcessor
      ),
      lib.processAllPages(
        TribalWars.buildURL('GET', 'overview_villages', {
          mode: 'commands',
          type: 'attack',
        }),
        commandsProcessor
      ),
      lib.processAllPages(
        TribalWars.buildURL('GET', 'am_farm'),
        farmProcessor
      ),
      findNewbarbs(),
    ])
      .then(filterFarms)
      .then(() => {
        return fgApplyFarmTroopReserve(fgApplyIntegratedReservations(data));
      });
  };

  const createLegacyPlanning = function (
    optionDistance,
    optionTime,
    optionMaxloot,
    optionTemplateNormal,
    optionTemplateFull,
    returnDeadline,
    arrivalDeadline,
    data
  ) {
    let plan = {
      counter: 0,
      farms: {},
      stats: { candidates: 0, distance: 0, time: 0, troops: 0, template: 0, returnTime: 0, arrivalTime: 0 },
      details: { distance: [], time: [], troops: [], returnTime: [], arrivalTime: [] },
      remaining: {},
    };
    let serverTime = Math.round(lib.getCurrentServerTime() / 1000);

    const addDetail = function (type, origin, target, info) {
      if (!plan.details[type]) plan.details[type] = [];
      plan.details[type].push({
        origin: origin,
        target: target,
        info: info,
      });
    };

    for (let prop in data.villages) {
      let orderedFarms = Object.keys(data.farms.farms)
        .map((key) => ({ coord: key, dis: lib.getDistance(prop, key) }))
        .sort((a, b) => a.dis - b.dis);

      orderedFarms.forEach((el) => {
        plan.stats.candidates++;
        const farmIndex = data.farms.farms[el.coord];
        const templateName =
          optionMaxloot &&
          farmIndex.hasOwnProperty('max_loot') &&
          farmIndex.max_loot
            ? optionTemplateFull
            : optionTemplateNormal;
        const template = data.farms.templates[templateName];

        if (!template) {
          plan.stats.template++;
          return;
        }

        const distance = el.dis;
        if (!(distance < optionDistance)) {
          plan.stats.distance++;
          addDetail(
            'distance',
            data.villages[prop].name + ' (' + prop + ')',
            el.coord,
            distance.toFixed(2) + ' Felder (Maximum: ' + optionDistance + ')'
          );
          return;
        }

        if (arrivalDeadline) {
          const arrivalAt = Math.round(
            (serverTime + (distance * template.speed * 60)) * 1000
          );
          if (arrivalAt > arrivalDeadline) {
            plan.stats.arrivalTime++;
            addDetail(
              'arrivalTime',
              data.villages[prop].name + ' (' + prop + ')',
              el.coord,
              'Ankunft wäre erst um ' + formatClock(arrivalAt) + '.'
            );
            return;
          }
        }

        if (returnDeadline) {
          const returnAt = Math.round(
            (serverTime + (distance * template.speed * 60 * 2)) * 1000
          );
          if (returnAt > returnDeadline) {
            plan.stats.returnTime++;
            addDetail(
              'returnTime',
              data.villages[prop].name + ' (' + prop + ')',
              el.coord,
              'Rückkehr wäre erst um ' + formatClock(returnAt) + '.'
            );
            return;
          }
        }

        const unitsLeft = lib.subtractArrays(
          data.villages[prop].units,
          template.units
        );
        if (!unitsLeft) {
          plan.stats.troops++;
          addDetail(
            'troops',
            data.villages[prop].name + ' (' + prop + ')',
            el.coord,
            'Vorlage ' + String(templateName).toUpperCase() + ' kann mit den Resttruppen nicht mehr gestellt werden.'
          );
          return;
        }

        const arrival = Math.round(
          serverTime +
          distance * template.speed * 60 +
          Math.round(plan.counter / 5)
        );
        const maxTimeDiff = Math.round(optionTime * 60);
        let timeDiff = true;

        if (data.commands.hasOwnProperty(el.coord)) {
          // Auch ohne Bericht darf dasselbe Ziel erneut geplant werden.
          // Nur bekannte Befehls-/Ankunftszeiten werden über optionTime gesperrt.
          data.commands[el.coord].forEach((timestamp) => {
            if (Math.abs(timestamp - arrival) < maxTimeDiff) timeDiff = false;
          });
        } else {
          data.commands[el.coord] = [];
        }

        if (!timeDiff) {
          plan.stats.time++;
          addDetail(
            'time',
            data.villages[prop].name + ' (' + prop + ')',
            el.coord,
            'Ein Angriff liegt innerhalb des eingestellten Mindestabstands von ' + optionTime + ' Minuten.'
          );
          return;
        }

        plan.counter++;
        if (!plan.farms.hasOwnProperty(prop)) plan.farms[prop] = [];
        plan.farms[prop].push({
          origin: {
            coord: prop,
            name: data.villages[prop].name,
            id: data.villages[prop].id,
          },
          target: { coord: el.coord, id: farmIndex.id },
          fields: distance,
          template: { name: templateName, id: template.id },
          arrival: arrival,
        });

        data.villages[prop].units = unitsLeft;
        data.commands[el.coord].push(arrival);
      });

      plan.remaining[prop] = {
        name: data.villages[prop].name,
        units: data.villages[prop].units.slice(),
      };
    }

    return plan;
  };

  const updateRemainingCounter = function () {
    const remaining = $('.farmRow').length;
    $('.fg-result-head > div:last-child').html(`<b>${remaining}</b> offen`);
  };



  const clonePlanningData = function (data) {
    return {
      villages: Object.fromEntries(
        Object.entries(data.villages).map(function (entry) {
          return [entry[0], {
            name: entry[1].name,
            id: entry[1].id,
            units: entry[1].units.slice(),
          }];
        })
      ),
      commands: Object.fromEntries(
        Object.entries(data.commands).map(function (entry) {
          return [entry[0], entry[1].slice()];
        })
      ),
      farms: {
        templates: data.farms.templates,
        farms: Object.fromEntries(
          Object.entries(data.farms.farms).map(function (entry) {
            return [entry[0], Object.assign({}, entry[1])];
          })
        ),
      },
    };
  };

  const scorePlan = function (plan) {
    let distance = 0;
    Object.keys(plan.farms || {}).forEach(function (coord) {
      plan.farms[coord].forEach(function (farm) {
        distance += farm.fields || 0;
      });
    });

    return {
      attacks: plan.counter || 0,
      distance: distance,
    };
  };

  const isBetterPlan = function (a, b) {
    const sa = scorePlan(a);
    const sb = scorePlan(b);

    if (sa.attacks !== sb.attacks) return sa.attacks > sb.attacks;
    return sa.distance < sb.distance;
  };

  const seededRandom = function (seed) {
    let state = seed >>> 0;
    return function () {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const shuffledCopy = function (array, seed) {
    const result = array.slice();
    const random = seededRandom(seed);
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result;
  };

  const buildCandidatePool = function (
    optionDistance,
    optionTime,
    optionMaxloot,
    optionTemplateNormal,
    optionTemplateFull,
    returnDeadline,
    arrivalDeadline,
    data
  ) {
    const serverTime = Math.round(lib.getCurrentServerTime() / 1000);
    const maxTimeDiff = Math.round(optionTime * 60);
    const candidates = [];
    const baseStats = {
      candidates: 0,
      evaluatedTemplates: 0,
      distance: 0,
      time: 0,
      troops: 0,
      template: 0,
      returnTime: 0,
      arrivalTime: 0
    };
    const diagnostics = {
      troopMissingByUnit: {},
      troopMissingByTemplate: {},
      rejectedSignatures: {}
    };
    const filteredUnitNames = game_data.units.filter(function (unit) {
      return ['ram', 'catapult', 'knight', 'snob', 'militia'].indexOf(unit) === -1;
    });

    Object.keys(data.villages).forEach(function (originCoord) {
      const origin = data.villages[originCoord];

      Object.keys(data.farms.farms).forEach(function (targetCoord) {
        baseStats.candidates++;

        const farmIndex = data.farms.farms[targetCoord];
        const distance = lib.getDistance(originCoord, targetCoord);

        if (!(distance < optionDistance)) {
          baseStats.distance++;
          return;
        }

        let templateNames = [];
        const wantsFull = optionMaxloot &&
          farmIndex.hasOwnProperty('max_loot') &&
          farmIndex.max_loot;

        if (wantsFull) {
          templateNames.push(optionTemplateFull);
          if (optionTemplateNormal !== optionTemplateFull) {
            templateNames.push(optionTemplateNormal);
          }
        } else {
          templateNames.push(optionTemplateNormal);
        }

        templateNames.forEach(function (templateName, priority) {
          const template = data.farms.templates[templateName];
          if (!template) {
            baseStats.template++;
            return;
          }

          baseStats.evaluatedTemplates++;
          const diagnosticSignature =
            originCoord + '>' + targetCoord + '>' + String(templateName);

          if (arrivalDeadline) {
            const arrivalAt = Math.round(
              (serverTime + (distance * template.speed * 60)) * 1000
            );
            if (arrivalAt > arrivalDeadline) {
              baseStats.arrivalTime++;
              return;
            }
          }

          if (returnDeadline) {
            const returnAt = Math.round(
              (serverTime + (distance * template.speed * 60 * 2)) * 1000
            );
            if (returnAt > returnDeadline) {
              baseStats.returnTime++;
              return;
            }
          }

          const initiallyPossible = lib.subtractArrays(origin.units, template.units);
          if (!initiallyPossible) {
            if (!diagnostics.rejectedSignatures[diagnosticSignature]) {
              diagnostics.rejectedSignatures[diagnosticSignature] = 'troops';
              baseStats.troops++;

              diagnostics.troopMissingByTemplate[templateName] =
                (diagnostics.troopMissingByTemplate[templateName] || 0) + 1;

              template.units.forEach(function (need, index) {
                const have = parseInt(origin.units[index], 10) || 0;
                const required = parseInt(need, 10) || 0;
                if (required > have) {
                  const unitName = filteredUnitNames[index] || ('unit_' + index);
                  if (!diagnostics.troopMissingByUnit[unitName]) {
                    diagnostics.troopMissingByUnit[unitName] = {
                      combinations: 0,
                      missingTotal: 0
                    };
                  }
                  diagnostics.troopMissingByUnit[unitName].combinations++;
                  diagnostics.troopMissingByUnit[unitName].missingTotal +=
                    (required - have);
                }
              });
            }
            return;
          }

          const arrival = Math.round(serverTime + distance * template.speed * 60);
          const existing = data.commands[targetCoord] || [];
          let timeOk = true;

          // Ein fehlender Farm-Assistent-Bericht blockiert KEINEN Folgeangriff.
          // Entscheidend sind ausschließlich bekannte Ankunftszeiten und optionTime.
          existing.forEach(function (timestamp) {
            if (Math.abs(timestamp - arrival) < maxTimeDiff) timeOk = false;
          });

          if (!timeOk) {
            baseStats.time++;
            return;
          }

          let troopCost = 0;
          template.units.forEach(function (need, i) {
            if (need > 0) {
              troopCost += need / Math.max(1, origin.units[i] || 0);
            }
          });

          candidates.push({
            originCoord: originCoord,
            targetCoord: targetCoord,
            origin: origin,
            farmIndex: farmIndex,
            template: template,
            templateName: templateName,
            priority: priority,
            distance: distance,
            arrival: arrival,
            troopCost: troopCost,
          });
        });
      });
    });

    return {
      candidates: candidates,
      stats: baseStats,
      diagnostics: diagnostics,
      maxTimeDiff: maxTimeDiff
    };
  };

  const makeEmptyOptimizedPlan = function (data, stats) {
    return {
      counter: 0,
      farms: {},
      stats: Object.assign({}, stats),
      details: { distance: [], time: [], troops: [], returnTime: [], arrivalTime: [] },
      remaining: {},
      comparison: { legacy: 0, efficient: 0, gain: 0, source: 'optimized' },
    };
  };

  const constructPlanFromOrder = function (orderedCandidates, data, baseStats, maxTimeDiff) {
    const plan = makeEmptyOptimizedPlan(data, baseStats);
    const villageUnits = {};
    const simulatedCommands = {};

    Object.keys(data.villages).forEach(function (coord) {
      villageUnits[coord] = data.villages[coord].units.slice();
    });

    Object.keys(data.commands).forEach(function (coord) {
      simulatedCommands[coord] = data.commands[coord].slice();
    });

    orderedCandidates.forEach(function (candidate) {
      const unitsLeft = lib.subtractArrays(
        villageUnits[candidate.originCoord],
        candidate.template.units
      );
      if (!unitsLeft) return;

      let timeOk = true;
      const commandList = simulatedCommands[candidate.targetCoord] || [];
      commandList.forEach(function (timestamp) {
        if (Math.abs(timestamp - candidate.arrival) < maxTimeDiff) {
          timeOk = false;
        }
      });
      if (!timeOk) return;

      villageUnits[candidate.originCoord] = unitsLeft;

      if (!simulatedCommands[candidate.targetCoord]) {
        simulatedCommands[candidate.targetCoord] = [];
      }
      simulatedCommands[candidate.targetCoord].push(candidate.arrival);

      if (!plan.farms[candidate.originCoord]) {
        plan.farms[candidate.originCoord] = [];
      }

      plan.farms[candidate.originCoord].push({
        origin: {
          coord: candidate.originCoord,
          name: candidate.origin.name,
          id: candidate.origin.id,
        },
        target: {
          coord: candidate.targetCoord,
          id: candidate.farmIndex.id,
        },
        fields: candidate.distance,
        template: {
          name: candidate.templateName,
          id: candidate.template.id,
        },
        arrival: candidate.arrival,
      });

      plan.counter++;
    });

    Object.keys(data.villages).forEach(function (coord) {
      plan.remaining[coord] = {
        name: data.villages[coord].name,
        units: villageUnits[coord].slice(),
      };
    });

    Object.keys(plan.farms).forEach(function (coord) {
      plan.farms[coord].sort(function (a, b) {
        return a.fields - b.fields;
      });
    });

    return plan;
  };

  const createPlanning = function (
    optionDistance,
    optionTime,
    optionMaxloot,
    optionTemplateNormal,
    optionTemplateFull,
    returnDeadline,
    arrivalDeadline,
    data
  ) {
    const legacyData = clonePlanningData(data);
    const legacyPlan = createLegacyPlanning(
      optionDistance,
      optionTime,
      optionMaxloot,
      optionTemplateNormal,
      optionTemplateFull,
      returnDeadline,
      arrivalDeadline,
      legacyData
    );

    const pool = buildCandidatePool(
      optionDistance,
      optionTime,
      optionMaxloot,
      optionTemplateNormal,
      optionTemplateFull,
      returnDeadline,
      arrivalDeadline,
      data
    );

    const candidates = pool.candidates.slice();
    const attempts = [];

    // Deterministic baseline strategies.
    attempts.push(candidates.slice().sort(function (a, b) {
      if (a.troopCost !== b.troopCost) return a.troopCost - b.troopCost;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.priority - b.priority;
    }));

    attempts.push(candidates.slice().sort(function (a, b) {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.troopCost !== b.troopCost) return a.troopCost - b.troopCost;
      return a.priority - b.priority;
    }));

    attempts.push(candidates.slice().sort(function (a, b) {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.troopCost - b.troopCost;
    }));

    const originCandidateCounts = {};
    const targetCandidateCounts = {};
    candidates.forEach(function (c) {
      originCandidateCounts[c.originCoord] = (originCandidateCounts[c.originCoord] || 0) + 1;
      targetCandidateCounts[c.targetCoord] = (targetCandidateCounts[c.targetCoord] || 0) + 1;
    });

    // Protect scarce origins.
    attempts.push(candidates.slice().sort(function (a, b) {
      const ac = originCandidateCounts[a.originCoord] || 0;
      const bc = originCandidateCounts[b.originCoord] || 0;
      if (ac !== bc) return ac - bc;
      if (a.troopCost !== b.troopCost) return a.troopCost - b.troopCost;
      return a.distance - b.distance;
    }));

    // Prioritize targets that have few possible origin/template combinations.
    attempts.push(candidates.slice().sort(function (a, b) {
      const ac = targetCandidateCounts[a.targetCoord] || 0;
      const bc = targetCandidateCounts[b.targetCoord] || 0;
      if (ac !== bc) return ac - bc;
      if (a.troopCost !== b.troopCost) return a.troopCost - b.troopCost;
      return a.distance - b.distance;
    }));

    // Weighted variants: attack count is still evaluated first afterwards.
    [0.25, 0.5, 1, 2, 4].forEach(function (weight) {
      attempts.push(candidates.slice().sort(function (a, b) {
        const as = a.troopCost * weight + a.distance / Math.max(1, optionDistance);
        const bs = b.troopCost * weight + b.distance / Math.max(1, optionDistance);
        if (as !== bs) return as - bs;
        return a.priority - b.priority;
      }));
    });

    // Deterministic multi-search. Different orders can unlock allocations that
    // fixed greedy sorting misses. Seeded => same input gives same result.
    const randomAttempts = Math.min(120, Math.max(30, candidates.length * 2));
    for (let seed = 1; seed <= randomAttempts; seed++) {
      const shuffled = shuffledCopy(candidates, 0xF00D + seed * 7919);

      // Keep a light preference for efficient/short candidates while retaining
      // enough randomness to explore different village-target assignments.
      const random = seededRandom(0xCAFE + seed * 3571);
      shuffled.forEach(function (candidate) {
        candidate._fgSearchNoise = random();
      });

      shuffled.sort(function (a, b) {
        const aScore =
          (a.troopCost * (0.5 + a._fgSearchNoise)) +
          (a.distance / Math.max(1, optionDistance)) * (0.25 + a._fgSearchNoise);
        const bScore =
          (b.troopCost * (0.5 + b._fgSearchNoise)) +
          (b.distance / Math.max(1, optionDistance)) * (0.25 + b._fgSearchNoise);
        return aScore - bScore;
      });

      attempts.push(shuffled);
    }
    let bestOptimized = null;

    attempts.forEach(function (ordered) {
      const candidatePlan = constructPlanFromOrder(
        ordered,
        data,
        pool.stats,
        pool.maxTimeDiff
      );

      if (!bestOptimized || isBetterPlan(candidatePlan, bestOptimized)) {
        bestOptimized = candidatePlan;
      }
    });

    if (bestOptimized) {
      bestOptimized.searchInfo = {
        strategies: attempts.length,
        candidates: candidates.length,
      };
    }

    // Absolute safety rule: never return fewer attacks than legacy.
    let finalPlan;
    if (!bestOptimized || (legacyPlan.counter || 0) > (bestOptimized.counter || 0)) {
      finalPlan = legacyPlan;
      finalPlan.comparison = {
        legacy: legacyPlan.counter || 0,
        efficient: bestOptimized ? bestOptimized.counter || 0 : 0,
        gain: 0,
        source: 'legacy-fallback',
      };
      finalPlan.searchInfo = bestOptimized && bestOptimized.searchInfo
        ? bestOptimized.searchInfo
        : { strategies: attempts.length, candidates: candidates.length };
    } else {
      finalPlan = bestOptimized;
      finalPlan.comparison = {
        legacy: legacyPlan.counter || 0,
        efficient: bestOptimized.counter || 0,
        gain: (bestOptimized.counter || 0) - (legacyPlan.counter || 0),
        source: 'optimized',
      };
      finalPlan.searchInfo = bestOptimized.searchInfo || {
        strategies: attempts.length,
        candidates: candidates.length,
      };
    }

    finalPlan.integration = data.integration || {
      wallbreakers: [],
      scouts: [],
      blockedTargets: 0,
      reservedByVillage: {}
    };
    finalPlan.troopReserve = data.troopReserve || fgGetTroopReserve();
    finalPlan.diagnostics = pool.diagnostics || {
      troopMissingByUnit: {},
      troopMissingByTemplate: {},
      rejectedSignatures: {}
    };
    finalPlan.stats = Object.assign({}, finalPlan.stats || {}, {
      evaluatedTemplates: pool.stats.evaluatedTemplates || 0,
      candidates: pool.stats.candidates || 0,
      distance: pool.stats.distance || 0,
      time: pool.stats.time || 0,
      troops: pool.stats.troops || 0,
      template: pool.stats.template || 0,
      returnTime: pool.stats.returnTime || 0,
      arrivalTime: pool.stats.arrivalTime || 0
    });
    return finalPlan;
  };

  const fgIsMobileQuickMode = function () {
    try {
      return (
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
        window.innerWidth <= 800 ||
        $('#mobileHeader').length > 0
      );
    } catch (e) {
      return window.innerWidth <= 800;
    }
  };

  const selectFarmRow = function ($row, shouldScroll) {
    $('.farmRow').removeClass('fgNextAttack');
    $('.fgNextBadge').remove();
    if (!$row || !$row.length) return;
    $row.addClass('fgNextAttack');
    const $action = $row.find('.fgActionWrap').first();
    if ($action.length) $action.prepend('<span class="fgNextBadge">NÄCHSTER</span>');

    if (shouldScroll === false) return;

    const el = $row.get(0);
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  const fgAlignNextMobileAction = function ($row, desiredTop) {
    if (!fgIsMobileQuickMode() || !$row || !$row.length) return;

    requestAnimationFrame(function () {
      const $action = $row.find('.farmGod_icon, .fgUnifiedPrepare, .fgUnifiedMarkWallSent').first();
      const el = $action.get(0) || $row.get(0);
      if (!el || !el.getBoundingClientRect) return;

      const currentTop = el.getBoundingClientRect().top;
      const delta = currentTop - desiredTop;

      if (Math.abs(delta) > 1) {
        window.scrollBy(0, delta);
      }
    });
  };

  const getSelectedFarmRow = function () {
    let $row = $('.farmRow.fgNextAttack').first();
    if ($row.hasClass('fgPlanDone')) $row = $();
    if (!$row.length) {
      $row = $('.farmRow').not('.fgPlanDone').first();
      selectFarmRow($row);
    }
    return $row;
  };

  const moveFarmSelection = function (direction) {
    const $rows = $('.farmRow').not('.fgPlanDone');
    if (!$rows.length) return;
    const $current = getSelectedFarmRow();
    let index = $rows.index($current);
    if (index < 0) index = 0;
    index = Math.max(0, Math.min($rows.length - 1, index + direction));
    selectFarmRow($rows.eq(index));
  };

  const updateFarmGodPlusProgressText = function () {
    const $pb = $('#FarmGodProgessbar');
    const max = Number($pb.data('max')) || 0;
    const done = Number($pb.data('current')) || 0;
    const open = $('.farmRow').not('.fgPlanDone').length;

    $('.fgOpenCount').html('<b>' + open + '</b> offen');
  };

  const sendFarm = function ($this) {
    let n = Timing.getElapsedTimeSinceLoad();
    if (
      !farmBusy &&
      !(
        Accountmanager.farm.last_click &&
        n - Accountmanager.farm.last_click < 200
      )
    ) {
      farmBusy = true;
      Accountmanager.farm.last_click = n;
      let $pb = $('#FarmGodProgessbar');

      TribalWars.post(
        Accountmanager.send_units_link.replace(
          /village=(\d+)/,
          'village=' + $this.data('origin')
        ),
        null,
        {
          target: $this.data('target'),
          template_id: $this.data('template'),
          source: $this.data('origin'),
        },
        function (r) {
          UI.SuccessMessage(r.success);
          $pb.data('current', $pb.data('current') + 1);
          UI.updateProgressBar(
            $pb,
            $pb.data('current'),
            $pb.data('max')
          );
          const $row = $this.closest('.farmRow');
          const mobileQuick = fgIsMobileQuickMode();
          const tappedTop = ($this.get(0) && $this.get(0).getBoundingClientRect)
            ? $this.get(0).getBoundingClientRect().top
            : 0;
          let $nextRow = $row.nextAll('.farmRow').not('.fgPlanDone').first();

          fgUpdateFarmPlanItemStatus(String($row.data('plan-signature') || ''), 'sent');
          const wasSelected = $row.hasClass('fgNextAttack');

          if (!$nextRow.length) {
            $nextRow = $('.farmRow').not('.fgPlanDone').not($row).first();
          }

          $row.remove();
          updateRemainingCounter();
          updateFarmGodPlusProgressText();

          if ($nextRow.length) {
            selectFarmRow($nextRow, !mobileQuick);
            if (mobileQuick) fgAlignNextMobileAction($nextRow, tappedTop);
          } else if (wasSelected || !$('.farmRow.fgNextAttack').length) {
            selectFarmRow($('.farmRow').not('.fgPlanDone').first(), !mobileQuick);
          }

          farmBusy = false;
        },
        function (r) {
          UI.ErrorMessage(r || t.messages.sendError);
          $pb.data('current', $pb.data('current') + 1);
          UI.updateProgressBar(
            $pb,
            $pb.data('current'),
            $pb.data('max')
          );
          const $row = $this.closest('.farmRow');
          const mobileQuick = fgIsMobileQuickMode();
          const tappedTop = ($this.get(0) && $this.get(0).getBoundingClientRect)
            ? $this.get(0).getBoundingClientRect().top
            : 0;
          let $nextRow = $row.nextAll('.farmRow').not('.fgPlanDone').first();

          fgUpdateFarmPlanItemStatus(String($row.data('plan-signature') || ''), 'failed');
          const wasSelected = $row.hasClass('fgNextAttack');

          if (!$nextRow.length) {
            $nextRow = $('.farmRow').not('.fgPlanDone').not($row).first();
          }

          $row.remove();
          updateRemainingCounter();
          updateFarmGodPlusProgressText();

          if ($nextRow.length) {
            selectFarmRow($nextRow, !mobileQuick);
            if (mobileQuick) fgAlignNextMobileAction($nextRow, tappedTop);
          } else if (wasSelected || !$('.farmRow.fgNextAttack').length) {
            selectFarmRow($('.farmRow').not('.fgPlanDone').first(), !mobileQuick);
          }

          farmBusy = false;
        }
      );
    }
  };

  return {
    init,
  };
})(window.FarmGod.Library, window.FarmGod.Translation);

(() => {
  window.FarmGod.Main.init();
})();

})(typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
