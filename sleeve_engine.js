/* ============================================================================
   sleeve_engine.js (v3)
   자동: 기존값 → 학습 캐시 → 내장 사전 → 내 저장소 sleeves_db.json → Wikidata(BGG ID)
   실패: 기존 값 보존 + BGG 페이지 텍스트 붙여넣기 파서
   ============================================================================ */
(function (global) {
    'use strict';

    const GAMES_STORAGE_KEY = 'MY_BG_SHELF_DATA_V1';
    const USER_CACHE_KEY = 'MY_BG_CUSTOM_SLEEVE_PRESETS_V1';
    const OWN_DB_URL = './sleeves_db.json';
    const DEBUG = true;
    const log = (...a) => { if (DEBUG) console.log('[sleeve]', ...a); };

    /* 1. 내장 사전: v2의 KOR_BGG_SLEEVE_DICT 내용을 그대로 붙여넣으세요 */
    const KOR_BGG_SLEEVE_DICT = {
        // '윙스팬': [{ size: '57.5x89', count: 212 }],
    };

    function cleanKey(str) {
        return String(str || '')
            .replace(/$[^)]*$/g, '')
            .replace(/$[^$]*$/g, '')
            .replace(/[\s:!\-·.,'"+&?~_]+/g, '')
            .toLowerCase();
    }

    const STANDARD_SIZES = [
        [63.5, 88], [56, 87], [57.5, 89], [59, 92], [44, 67], [44, 68], [45, 68],
        [41, 63], [65, 100], [70, 110], [70, 120], [80, 120]
    ];

    function normalizeDimension(wRaw, hRaw) {
        let w = parseFloat(wRaw), h = parseFloat(hRaw);
        if (!(w > 0 && h > 0)) return '';
        if (w > h) [w, h] = [h, w];
        let best = '', bestDiff = Infinity;
        for (const [sw, sh] of STANDARD_SIZES) {
            const d = Math.abs(sw - w) + Math.abs(sh - h);
            if (d < bestDiff) { bestDiff = d; best = `${sw}x${sh}`; }
        }
        if (bestDiff <= 1.0) return best;
        const f = n => String(Math.round(n * 10) / 10);
        return `${f(w)}x${f(h)}`;
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

    /* 2. 붙여넣기 텍스트 파서 */
   function parsePastedSleeveText(text) {
       const found = [];
       const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
       const dimRx = /(\d{2,3}(?:\.\d{1,2})?)\s*(?:mm)?\s*[x×X*]\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:mm)?/;
       const qtyRx = /(\d{1,4})\s*(?:cards?|sleeves?|장|매|ea|pcs)(?![a-z])/i;
       const labelRx = /(?:qty|quantity|count|cards|수량|매수)\s*[:：]?\s*(\d{1,4})/i;
       const labelOnlyRx = /^(?:qty|quantity|count|cards|수량|매수)\s*[:：]?$/i;
       const bareNumRx = /^(\d{1,4})$/;
       const pickQty = s => {
           const m = s.match(qtyRx) || s.match(labelRx);
           return m ? parseInt(m[1], 10) : 0;
       };

       lines.forEach((line, i) => {
           const m = line.match(dimRx);
           if (!m) return;
           const size = normalizeDimension(m[1], m[2]);
           let count = pickQty(line.replace(m[0], ' '));

        // 아래로 최대 3줄 (다음 크기 줄이 나오면 중단)
           for (let j = i + 1; !count && j < Math.min(lines.length, i + 4); j++) {
               const l = lines[j];
               if (dimRx.test(l)) break;
               if (labelOnlyRx.test(l) && bareNumRx.test(lines[j + 1] || '')) {
                   count = parseInt(lines[j + 1], 10);
                   break;
               }
               count = pickQty(l) || (bareNumRx.test(l) ? parseInt(l, 10) : 0);
           }
           // 위로 1줄
           if (!count && i > 0 && !dimRx.test(lines[i - 1])) {
               count = pickQty(lines[i - 1]);
           }
           if (size && count > 0) found.push({ size, count });
       });
       return mergeSleeves(found);
   }


    /* 3. 캐시 / 사전 / 내 DB 조회 */
    function nameKeys(game) {
        const raw = [game.customFields?.['게임 이름'], game.name, game.title, game.originalName, game.engName];
        return [...new Set(raw.filter(Boolean).map(cleanKey).filter(Boolean))];
    }

    function readUserCache() {
        try {
            return JSON.parse(localStorage.getItem(USER_CACHE_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function rememberSleeves(game, sleeves) {
        const cache = readUserCache();
        nameKeys(game).forEach(k => { cache[k] = sleeves; });
        if (game.bggId) cache[`bgg:${game.bggId}`] = sleeves;
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cache));
    }

    function lookupIn(table, game, bggId) {
        if (!table) return [];
        if (bggId && table[`bgg:${bggId}`]) return mergeSleeves(table[`bgg:${bggId}`]);
        for (const k of nameKeys(game)) {
            if (table[k]) return mergeSleeves(table[k]);
        }
        return [];
    }

    let _ownDb = null;
    async function loadOwnDb() {
        if (_ownDb) return _ownDb;
        _ownDb = {};
        try {
            const r = await fetch(OWN_DB_URL, { cache: 'no-cache' });
            if (r.ok) {
                const raw = await r.json();
                for (const [k, v] of Object.entries(raw)) {
                    _ownDb[k.startsWith('bgg:') ? k : cleanKey(k)] = v;
                }
            }
            log('sleeves_db.json', r.status, Object.keys(_ownDb).length + '건');
        } catch (e) {
            log('sleeves_db.json 로드 실패', e);
        }
        return _ownDb;
    }

    /* 4. Wikidata: BGG ID(P2339)가 있는 항목만 채택 */
    async function findBggIdViaWikidata(name) {
        const q = String(name || '').replace(/$[^)]*$/g, '').trim();
        if (!q) return null;
        try {
            const sUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=ko&uselang=ko&type=item&limit=7&format=json&origin=*`;
            const s = await (await fetch(sUrl)).json();
            const ids = (s.search || []).map(h => h.id);
            if (!ids.length) return null;
            const eUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=labels|claims&languages=en|ko&format=json&origin=*`;
            const e = await (await fetch(eUrl)).json();
            for (const id of ids) {
                const ent = e.entities?.[id];
                const bgg = ent?.claims?.P2339?.[0]?.mainsnak?.datavalue?.value;
                if (bgg) {
                    log('wikidata 매칭', name, id, bgg);
                    return { bggId: String(bgg), engTitle: ent.labels?.en?.value || null };
                }
            }
        } catch (err) {
            log('wikidata 실패', err);
        }
        return null;
    }

    /* 5. 실제 목록의 객체에 반영 (stale 참조 방지) */
    function resolveLiveGame(game) {
        if (typeof global.getLiveGame === 'function') {
            const live = global.getLiveGame(game.id);
            if (live) return live;
        }
        log('getLiveGame 없음 → 전달받은 객체 사용 (저장 누락 위험)');
        return game;
    }

    function saveAndRefresh(gameId) {
        if (typeof global.persistData === 'function') {
            global.persistData();
        }
        if (typeof global.renderFilteredGames === 'function') {
            global.renderFilteredGames();
        }
        const modal = document.querySelector('#detailModal .detail-content');
        if (modal && String(modal.dataset.docId) === String(gameId) && typeof global.renderModalContent === 'function') {
            const live = typeof global.getLiveGame === 'function' ? global.getLiveGame(gameId) : null;
            if (live) global.renderModalContent(live);
        }
    }

    function applySleevesToGame(game, sleeves, bggId) {
        const live = resolveLiveGame(game);
        const merged = mergeSleeves(sleeves);
        const text = sleevesToText(merged);
        const total = sleevesTotal(merged);
        if (bggId) live.bggId = String(bggId);
        live.sleeves = merged;
        live.sleeveSize = text;
        live.sleeveCount = total;
        live.customFields = { ...(live.customFields || {}), '슬리브규격': text, '슬리브매수': String(total) };
        rememberSleeves(live, merged);
        saveAndRefresh(live.id);
        return merged;
    }

    /* 6. 메인 */
    async function autoFetchBggSleevesForGame(game, silent = false, forceRefresh = false) {
        if (!game) return { bggId: null, sleeves: [], source: 'none' };
        const name = game.customFields?.['게임 이름'] || game.name || '';
        const notify = (msg, type) => {
            if (!silent) global.showMessage?.(msg, type);
        };

        if (!forceRefresh) {
            const existing = textToSleeves(
                game.sleeveSize || game.customFields?.['슬리브규격'],
                game.sleeveCount || game.customFields?.['슬리브매수']
            );
            if (existing.length) return { bggId: game.bggId || null, sleeves: existing, source: 'existing' };
        }

        let bggId = game.bggId ? String(game.bggId) : null;
        let source = 'cache';
        let sleeves = lookupIn(readUserCache(), game, bggId);
        if (!sleeves.length) {
            source = 'dict';
            sleeves = lookupIn(KOR_BGG_SLEEVE_DICT, game, null);
        }
        if (!sleeves.length) {
            source = 'own-db';
            sleeves = lookupIn(await loadOwnDb(), game, bggId);
        }

        if (!sleeves.length && !bggId) {
            const wd = await findBggIdViaWikidata(name);
            if (wd) {
                bggId = wd.bggId;
                const live = resolveLiveGame(game);
                live.bggId = bggId;
                if (wd.engTitle && !live.originalName) live.originalName = wd.engTitle;
                source = 'wikidata+db';
                sleeves = lookupIn(readUserCache(), live, bggId);
                if (!sleeves.length) sleeves = lookupIn(await loadOwnDb(), live, bggId);
                if (!sleeves.length) saveAndRefresh(live.id);
            }
        }

        if (sleeves.length) {
            const applied = applySleevesToGame(game, sleeves, bggId);
            log('찾음', name, source, applied);
            notify(`🛡️ [${name}] 슬리브 입력 완료: ${sleevesToText(applied)}`, 'success');
            return { bggId, sleeves: applied, source };
        }

        log('못 찾음', name, 'bggId=', bggId);
        if (!silent && forceRefresh) {
            return await openSleevePasteImport(game, bggId);
        }
        notify(`ℹ️ [${name}] 자동 DB에 슬리브 정보가 없습니다. 기존 값은 그대로 두었습니다.`, 'error');
        return { bggId, sleeves: [], source: 'notfound' };
    }

    /* 7. 붙여넣기 입력 모달 */
    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = String(s ?? '');
        return d.innerHTML;
    }

    function openSleevePasteImport(game, bggId) {
        return new Promise(resolve => {
            const name = game.customFields?.['게임 이름'] || game.name || '';
            const q = game.originalName || name.replace(/$[^)]*$/g, '').trim();
            const bggUrl = bggId
                ? `https://boardgamegeek.com/boardgame/${bggId}/sleeves`
                : `https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=${encodeURIComponent(q)}`;

            const el = document.createElement('div');
            el.className = 'modal';
            el.style.zIndex = '1000';
            el.innerHTML = `
                <div class="search-panel-content" style="max-width:34rem;">
                    <button type="button" class="modal-close-btn">&times;</button>
                    <h2>🛡️ ${escapeHtml(name)} 슬리브 붙여넣기</h2>
                    <ol style="font-size:0.84rem; color:var(--text-secondary); padding-left:1.2rem; line-height:1.6;">
                        <li><a href="${bggUrl}" target="_blank" rel="noopener">BGG에서 이 게임 열기 ↗</a> 후 슬리브(Sleeves) 정보 화면으로 이동</li>
                        <li>카드 크기와 매수가 나온 부분을 드래그해서 복사</li>
                        <li>아래 칸에 붙여넣고, 인식 결과를 확인한 뒤 저장</li>
                    </ol>
                    <textarea class="memo-box sp-text" rows="7" placeholder="예) 63.5 x 88 mm  100 cards&#10;또는 63.5x88:100, 44x68:50"></textarea>
                    <div class="sp-preview" style="font-size:0.85rem; margin:0.5rem 0; font-weight:700;"></div>
                    <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
                        <button type="button" class="tag-apply-cancel-btn sp-cancel">취소</button>
                        <button type="button" class="tag-apply-save-btn sp-save" disabled>저장</button>
                    </div>
                </div>`;
            document.body.appendChild(el);

            const ta = el.querySelector('.sp-text');
            const pv = el.querySelector('.sp-preview');
            const save = el.querySelector('.sp-save');
            let parsed = [];
            let urlBggId = null;
           
            const close = (result) => {
                el.remove();
                resolve(result);
            };

            ta.addEventListener('input', () => {
                const um = ta.value.match(/boardgamegeek\.com\/boardgame(?:expansion)?\/(\d+)/i);
                urlBggId = um ? um[1] : null;
                parsed = parsePastedSleeveText(ta.value);
                save.disabled = !parsed.length;
                const idNote = urlBggId ? ` · BGG ID ${urlBggId} 인식` : '';
                if (parsed.length) {
                    pv.textContent = `인식 결과: ${sleevesToText(parsed)} (총 ${sleevesTotal(parsed)}장)${idNote}`;
                } else {
                    pv.textContent = ta.value.trim() ? `크기(예: 44x68)와 매수를 찾지 못했습니다.${idNote}` : '';
                }
            });

            const cancel = () => close({ bggId, sleeves: [], source: 'cancel' });
            el.querySelector('.modal-close-btn').onclick = cancel;
            el.querySelector('.sp-cancel').onclick = cancel;
            save.onclick = () => {
             const finalId = urlBggId || bggId;
             const applied = applySleevesToGame(game, parsed, finalId);
             global.showMessage?.(`🛡️ [${name}] 슬리브 저장 완료: ${sleevesToText(applied)}`, 'success');
             close({ bggId: finalId, sleeves: applied, source: 'paste' });
         };
            setTimeout(() => ta.focus(), 50);
        });
    }

    /* 8. 외부 공개 함수 (기존 이름 유지) */
    global.autoDetectSleevesForGame = function (game) {
        if (!game) return [];
        const existing = textToSleeves(game.sleeveSize || game.customFields?.['슬리브규격'], game.sleeveCount);
        if (existing.length) return existing;
        const cached = lookupIn(readUserCache(), game, game.bggId);
        return cached.length ? cached : lookupIn(KOR_BGG_SLEEVE_DICT, game, null);
    };
    global.autoFetchBggSleevesForGame = autoFetchBggSleevesForGame;
    global.openSleevePasteImport = (game) => openSleevePasteImport(game, game?.bggId || null);
    global.parsePastedSleeveText = parsePastedSleeveText;
})(window);
