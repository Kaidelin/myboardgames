/* ============================================================================
   sleeve_engine.js (v4) - 로컬 전용
   조회 순서: 기존 입력값 → 학습 캐시 → 내장 사전 → ./sleeves_db.json
   BGG 조회 없음 / 팝업 없음 / 못 찾으면 기존 값 유지
   ============================================================================ */
(function (global) {
    'use strict';

    const USER_CACHE_KEY = 'MY_BG_CUSTOM_SLEEVE_PRESETS_V1';
    const OWN_DB_URL = './sleeves_db.json';

    /* 1. 내장 사전: 기존 KOR_BGG_SLEEVE_DICT 내용을 그대로 붙여넣으세요 */
    const KOR_BGG_SLEEVE_DICT = {
        // '윙스팬': [{ size: '57.5x89', count: 212 }],
    };

    /* 2. 공통 유틸 */
    function cleanKey(str) {
        return String(str || '')
            .replace(/$[^)]*$/g, '')
            .replace(/$[^$]*$/g, '')
            .replace(/[\s:!\-·.,'"+&?~_]+/g, '')
            .toLowerCase();
    }

    function mergeSleeves(list) {
        const m = {};
        (Array.isArray(list) ? list : []).forEach(s => {
            const size = String(s?.size || '').trim();
            const count = parseInt(s?.count, 10) || 0;
            if (size && count > 0) m[size] = (m[size] || 0) + count;
        });
        return Object.entries(m).map(([size, count]) => ({ size, count }));
    }

    const sleevesToText = list => list.map(s => `${s.size}:${s.count}`).join(', ');
    const sleevesTotal = list => list.reduce((a, s) => a + (parseInt(s.count, 10) || 0), 0);

    /* "63.5x88:193, 44x68:80" 또는 "63.5x88" + 매수 */
    function textToSleeves(text, fallbackCount) {
        const s = String(text || '').trim();
        if (!s) return [];
        if (s.includes(':')) {
            return mergeSleeves(s.split(/[,\n]/).map(p => {
                const [size, c] = p.split(':');
                return { size: (size || '').trim(), count: c };
            }));
        }
        return mergeSleeves([{ size: s, count: fallbackCount }]);
    }

    function nameKeys(game) {
        const raw = [game.customFields?.['게임 이름'], game.name, game.title, game.originalName, game.engName];
        return [...new Set(raw.filter(Boolean).map(cleanKey).filter(Boolean))];
    }

    function existingSleeves(game) {
        if (Array.isArray(game.sleeves) && game.sleeves.length) {
            const s = mergeSleeves(game.sleeves);
            if (s.length) return s;
        }
        return textToSleeves(
            game.sleeveSize || game.customFields?.['슬리브규격'],
            game.sleeveCount || game.customFields?.['슬리브매수']
        );
    }

    /* 3. 학습 캐시 / 사전 / 내 DB */
    function readUserCache() {
        try {
            return JSON.parse(localStorage.getItem(USER_CACHE_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function rememberSleeves(game, sleeves) {
        const merged = mergeSleeves(sleeves);
        if (!game || !merged.length) return;
        const cache = readUserCache();
        nameKeys(game).forEach(k => { cache[k] = merged; });
        if (game.bggId) cache[`bgg:${game.bggId}`] = merged;
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cache));
    }

    function lookupIn(table, game) {
        if (!table) return [];
        if (game.bggId && table[`bgg:${game.bggId}`]) return mergeSleeves(table[`bgg:${game.bggId}`]);
        for (const k of nameKeys(game)) {
            if (table[k]) return mergeSleeves(table[k]);
        }
        return [];
    }

    let _ownDbPromise = null;
    function loadOwnDb() {
        if (!_ownDbPromise) {
            _ownDbPromise = fetch(OWN_DB_URL, { cache: 'no-cache' })
                .then(r => (r.ok ? r.json() : {}))
                .then(raw => {
                    const db = {};
                    for (const [k, v] of Object.entries(raw || {})) {
                        db[k.startsWith('bgg:') ? k : cleanKey(k)] = v;
                    }
                    return db;
                })
                .catch(() => ({}));
        }
        return _ownDbPromise;
    }

    /* 4. 실제 목록 객체에 반영 */
    function resolveLiveGame(game) {
        if (typeof global.getLiveGame === 'function') {
            const live = global.getLiveGame(game.id);
            if (live) return live;
        }
        return game;
    }

    function applySleevesToGame(game, sleeves) {
        const live = resolveLiveGame(game);
        const merged = mergeSleeves(sleeves);
        const text = sleevesToText(merged);
        const total = sleevesTotal(merged);
        live.sleeves = merged;
        live.sleeveSize = text;
        live.sleeveCount = total;
        live.customFields = { ...(live.customFields || {}), '슬리브규격': text, '슬리브매수': String(total) };

        if (typeof global.persistData === 'function') global.persistData();
        if (typeof global.renderFilteredGames === 'function') global.renderFilteredGames();
        const modal = document.querySelector('#detailModal .detail-content');
        if (modal && String(modal.dataset.docId) === String(live.id) && typeof global.renderModalContent === 'function') {
            global.renderModalContent(resolveLiveGame(live));
        }
        return merged;
    }

    /* 5. 메인: 로컬에서만 찾고, 없으면 아무것도 안 함 */
    async function autoFetchBggSleevesForGame(game, silent = true) {
        if (!game) return { sleeves: [], source: 'none' };

        const existing = existingSleeves(game);
        if (existing.length) return { sleeves: existing, source: 'existing' };

        let source = 'cache';
        let sleeves = lookupIn(readUserCache(), game);
        if (!sleeves.length) {
            source = 'dict';
            sleeves = lookupIn(KOR_BGG_SLEEVE_DICT, game);
        }
        if (!sleeves.length) {
            source = 'own-db';
            sleeves = lookupIn(await loadOwnDb(), game);
        }
        if (!sleeves.length) return { sleeves: [], source: 'notfound' };

        const applied = applySleevesToGame(game, sleeves);
        if (!silent) {
            const name = game.customFields?.['게임 이름'] || game.name || '';
            global.showMessage?.(`🛡️ [${name}] 슬리브 입력 완료: ${sleevesToText(applied)}`, 'success');
        }
        return { sleeves: applied, source };
    }

    /* 6. 외부 공개 함수 (기존 이름 유지 → index.html 호출부가 깨지지 않음) */
    global.autoFetchBggSleevesForGame = autoFetchBggSleevesForGame;
    global.autoDetectSleevesForGame = function (game) {
        if (!game) return [];
        const ex = existingSleeves(game);
        if (ex.length) return ex;
        const cached = lookupIn(readUserCache(), game);
        return cached.length ? cached : lookupIn(KOR_BGG_SLEEVE_DICT, game);
    };
    // 상세 모달에서 직접 입력한 값을 학습 캐시에 저장할 때 호출
    global.rememberSleevesForGame = rememberSleeves;
})(window);
