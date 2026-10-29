/* ============================================================================
   🛡️ sleeve_engine.js (v2) - 외부 BGG 슬리브 마스터 DB(CDN) + 다국어 매칭 엔진
   - 코드에 없는 게임도 외부 마스터 JSON DB 및 Wikidata/BGG 연동으로 자동 수집합니다.
   ============================================================================ */
(function (global) {
    'use strict';

    const GAMES_STORAGE_KEY = "MY_BG_SHELF_DATA_V1";
    const CUSTOM_SLEEVE_DB_KEY = "MY_BG_CUSTOM_SLEEVE_PRESETS_V1";

    // 외부 오픈소스 BGG 슬리브 마스터 DB 캐시 (최초 1회 로드 후 메모리 유지)
    let _externalMasterDb = null;
    let _externalDbLoadingPromise = null;

    /* 1. 한국어 보드게임 기본 내장 사전 (즉시 응답용) */
    const KOR_BGG_SLEEVE_DICT = {
        '킵더히어로즈아웃': [{ size: '63.5x88', count: 193 }, { size: '57.5x89', count: 20 }],
        '정령섬': [{ size: '63.5x88', count: 138 }, { size: '45x68', count: 38 }],
        '아르낙의잊혀진유적': [{ size: '63.5x88', count: 110 }],
        '세티': [{ size: '63.5x88', count: 210 }],
        '세티외계지성체탐사': [{ size: '63.5x88', count: 210 }],
        '언스토퍼블': [{ size: '63.5x88', count: 150 }],
        '버건디의성스페셜에디션': [{ size: '44x67', count: 82 }, { size: '59x92', count: 67 }],
        '버건디의성': [{ size: '44x67', count: 82 }, { size: '59x92', count: 67 }],
        '에버델뉴리프': [{ size: '63.5x88', count: 109 }],
        '에버델': [{ size: '63.5x88', count: 128 }, { size: '44x63', count: 39 }],
        '엔데버심해': [{ size: '63.5x88', count: 80 }, { size: '45x68', count: 60 }],
        '보이드폴': [{ size: '63.5x88', count: 195 }, { size: '44x67', count: 209 }],
        '버튼즈앤버그즈': [{ size: '63.5x88', count: 52 }, { size: '44x68', count: 80 }],
        '글룸헤이븐버튼즈앤버그즈': [{ size: '63.5x88', count: 52 }, { size: '44x68', count: 80 }],
        '글룸헤이븐사자의턱': [{ size: '63.5x88', count: 251 }, { size: '44x68', count: 325 }],
        '사자의턱': [{ size: '63.5x88', count: 251 }, { size: '44x68', count: 325 }],
        '글룸헤이븐': [{ size: '63.5x88', count: 669 }, { size: '44x68', count: 1031 }],
        '프로스트헤이븐': [{ size: '63.5x88', count: 1159 }, { size: '44x68', count: 1330 }],
        '플립타운': [{ size: '63.5x88', count: 78 }],
        '아크노바': [{ size: '63.5x88', count: 255 }],
        '테라포밍마스': [{ size: '63.5x88', count: 233 }],
        '브라스버밍엄': [{ size: '63.5x88', count: 76 }],
        '브라스랭커셔': [{ size: '63.5x88', count: 66 }],
        '듄임페리움봉기': [{ size: '63.5x88', count: 165 }, { size: '44x68', count: 69 }],
        '듄임페리움': [{ size: '63.5x88', count: 151 }, { size: '44x68', count: 65 }],
        '윙스팬': [{ size: '57.5x89', count: 212 }],
        '백로성': [{ size: '45x68', count: 45 }, { size: '59x92', count: 27 }],
        '화이트캐슬': [{ size: '45x68', count: 45 }, { size: '59x92', count: 27 }],
        '다윈의여정': [{ size: '63.5x88', count: 40 }, { size: '44x68', count: 56 }],
        '헤게모니': [{ size: '63.5x88', count: 350 }, { size: '44x68', count: 80 }],
        '슬레이더스파이어': [{ size: '63.5x88', count: 730 }, { size: '44x68', count: 10 }],
        '메이지나이트': [{ size: '63.5x88', count: 374 }],
        '아컴호러카드게임': [{ size: '63.5x88', count: 234 }, { size: '41x63', count: 5 }],
        '루트': [{ size: '63.5x88', count: 98 }],
        '사이드': [{ size: '57.5x89', count: 42 }, { size: '44x68', count: 80 }, { size: '70x110', count: 42 }],
        '클랭크': [{ size: '63.5x88', count: 184 }],
        '세븐원더스듀얼': [{ size: '44x68', count: 73 }, { size: '65x100', count: 23 }],
        '세븐원더스': [{ size: '65x100', count: 155 }],
        '스플렌더대결': [{ size: '56x87', count: 67 }],
        '스플렌더듀얼': [{ size: '56x87', count: 67 }],
        '스플렌더': [{ size: '63.5x88', count: 90 }]
    };

    function cleanKey(str) {
        return String(str || '')
            .replace(/\([^)]*\)/g, '')
            .replace(/\[[^\]]*\]/g, '')
            .replace(/[\s:!\-·.,'"+&?~_]+/g, '')
            .toLowerCase();
    }

    function normalizeDimension(wRaw, hRaw) {
        const w = parseFloat(wRaw), h = parseFloat(hRaw);
        if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return '';
        if (w >= 62.5 && w <= 64.5 && h >= 87.5 && h <= 89.5) return '63.5x88';
        if (w >= 55.5 && w <= 56.8 && h >= 86.5 && h <= 88.0) return '56x87';
        if (w >= 57.0 && w <= 58.2 && h >= 88.0 && h <= 89.8) return '57.5x89';
        if (w >= 58.5 && w <= 60.0 && h >= 90.5 && h <= 92.8) return '59x92';
        if (w >= 43.0 && w <= 44.5 && h >= 66.5 && h <= 67.5) return '44x67';
        if (w >= 44.6 && w <= 45.8 && h >= 67.5 && h <= 69.0) return '45x68';
        if (w >= 43.5 && w <= 44.5 && h >= 67.6 && h <= 69.0) return '44x68';
        if (w >= 64.5 && w <= 66.0 && h >= 99.0 && h <= 101.0) return '65x100';
        if (w >= 69.0 && w <= 71.0 && h >= 119.0 && h <= 121.0) return '70x120';
        if (w >= 79.0 && w <= 81.0 && h >= 119.0 && h <= 121.0) return '80x120';
        const cw = Number.isInteger(w) ? String(w) : w.toFixed(1).replace(/\.0$/, '');
        const ch = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(/\.0$/, '');
        return `${cw}x${ch}`;
    }

    /* 2. 한글 음차(외래어) 표기 <-> 영문 발음 자동 매칭기 (번역기 없이 "캐스캐디아" -> "Cascadia" 등 매칭) */
    function korPhoneticToRegexPattern(korStr) {
        // 한글 외래어 보드게임명을 영문 자음/모음 근사 패턴으로 변환하는 보조 함수
        const map = {
            '케': 'ca|ke', '캐': 'ca', '카': 'ca|ka', '코': 'co|ko', '쿠': 'cu|ku', '크': 'c|k', '키': 'ki|key',
            '게': 'ge|ga', '가': 'ga', '고': 'go', '구': 'gu', '그': 'g', '기': 'gi',
            '세': 'se|ce', '샤': 'sha', '소': 'so', '수': 'su', '스': 's', '시': 'si|ci|shi',
            '테': 'te', '타': 'ta', '토': 'to', '투': 'tu|two|to', '트': 't', '티': 'ti|ty',
            '페': 'pe|fe', '파': 'pa|fa', '포': 'po|fo', '푸': 'pu|fu', '프': 'p|f', '피': 'pi|fi',
            '베': 'be|ve', '바': 'ba|va', '보': 'bo|vo', '부': 'bu|vu', '브': 'b|v', '비': 'bi|vi',
            '데': 'de', '다': 'da', '도': 'do', '두': 'du', '드': 'd', '디': 'di',
            '레': 're|le', '라': 'ra|la', '로': 'ro|lo', '루': 'ru|lu', '르': 'r|l', '리': 'ri|li',
            '메': 'me', '마': 'ma', '모': 'mo', '무': 'mu', '므': 'm', '미': 'mi',
            '네': 'ne', '나': 'na', '노': 'no', '누': 'nu', '느': 'n', '니': 'ni',
            '제': 'je|ze', '자': 'ja|za', '조': 'jo|zo', '주': 'ju|zu', '즈': 's|z|ds', '지': 'ji|zi|ge',
            '체': 'che', '차': 'cha', '초': 'cho', '추': 'chu', '츠': 'ts|tz', '치': 'chi',
            '헤': 'he', '하': 'ha', '호': 'ho', '후': 'hu|wh', '흐': 'h', '히': 'hi',
            '에': 'e|a', '애': 'a|e', '아': 'a|ar', '오': 'o|au', '우': 'u|oo', '이': 'i|e|y', '앤': 'and|&', '더': 'the'
        };
        let out = '';
        for (const ch of korStr) {
            if (map[ch]) out += `(?:${map[ch]})[a-z]*`;
        }
        return out ? new RegExp('^' + out, 'i') : null;
    }

    /* 3. 외부 오픈소스 BGG 슬리브 마스터 DB 로드 (CORS 100% 허용 GitHub CDN) */
    async function loadExternalMasterSleeveDB() {
        if (_externalMasterDb) return _externalMasterDb;
        if (_externalDbLoadingPromise) return await _externalDbLoadingPromise;

        _externalDbLoadingPromise = (async () => {
            const byBggId = new Map();
            const byCleanTitle = new Map();
            const rawList = [];

            // 공개된 BGG 슬리브 JSON 데이터셋 CDN 소스 목록
            const cdnUrls = [
                'https://raw.githubusercontent.com/boardgamegeek-sleeves/db/main/sleeves.json',
                'https://cdn.jsdelivr.net/gh/ bgc-moscow/bgg-sleeves@master/games.json',
                'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://bgc.moscow/bgg/games.json')
            ];

            for (const url of cdnUrls) {
                try {
                    const resp = await fetch(url.replace(/\s+/g, ''));
                    if (!resp.ok) continue;
                    const data = await resp.json();
                    const arr = Array.isArray(data) ? data : (data.games || data.items || Object.values(data));
                    if (Array.isArray(arr) && arr.length > 50) {
                        arr.forEach(item => {
                            if (!item) return;
                            const id = String(item.bggId || item.id || item.objectid || '');
                            const name = String(item.name || item.title || '');
                            const rawCards = item.sleeves || item.cards || item.cardsets || [];
                            const parsedSleeves = [];
                            if (Array.isArray(rawCards)) {
                                const szMap = {};
                                rawCards.forEach(c => {
                                    const sz = c.size ? String(c.size) : normalizeDimension(c.width || c.w, c.height || c.h);
                                    const qty = parseInt(c.count || c.qty || c.quantity || 0, 10);
                                    if (sz && qty > 0) szMap[sz] = (szMap[sz] || 0) + qty;
                                });
                                Object.entries(szMap).forEach(([size, count]) => parsedSleeves.push({ size, count }));
                            }
                            if (parsedSleeves.length > 0) {
                                if (id) byBggId.set(id, parsedSleeves);
                                if (name) {
                                    const ck = cleanKey(name);
                                    byCleanTitle.set(ck, { id, name, sleeves: parsedSleeves });
                                    rawList.push({ id, ck, name, sleeves: parsedSleeves });
                                }
                            }
                        });
                        break;
                    }
                } catch (e) {}
            }

            _externalMasterDb = { byBggId, byCleanTitle, rawList };
            return _externalMasterDb;
        })();

        return await _externalDbLoadingPromise;
    }

    /* 4. CORS 100% 허용된 Wikidata API로 한글 보드게임명 -> 영문 원제 & BGG ID(P2339) 조회 */
    async function queryWikidataForBoardgame(korName) {
        if (!korName) return { bggId: null, engTitle: null };
        const cleanQ = korName.replace(/\([^)]*\)/g, '').trim();
        try {
            // Wikidata 검색 API는 origin=* 파라미터로 브라우저 CORS를 100% 공식 지원함
            const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleanQ)}&language=ko&format=json&origin=*&limit=5`;
            const r = await fetch(searchUrl);
            if (!r.ok) return { bggId: null, engTitle: null };
            const sData = await r.json();
            const hits = sData.search || [];
            if (!hits.length) return { bggId: null, engTitle: null };

            const ids = hits.map(h => h.id).join('|');
            const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(ids)}&props=labels|claims&languages=en|ko&format=json&origin=*`;
            const er = await fetch(entityUrl);
            if (!er.ok) return { bggId: null, engTitle: null };
            const eData = await er.json();
            const entities = eData.entities || {};

            for (const qid of Object.keys(entities)) {
                const ent = entities[qid];
                // P2339는 Wikidata의 공식 BoardGameGeek ID 프로퍼티
                const bggClaim = ent?.claims?.P2339?.[0]?.mainsnak?.datavalue?.value;
                const enLabel = ent?.labels?.en?.value || null;
                if (bggClaim || enLabel) {
                    return { bggId: bggClaim ? String(bggClaim) : null, engTitle: enLabel };
                }
            }
        } catch (e) {}
        return { bggId: null, engTitle: null };
    }

    /* 5. 신뢰성 높은 프록시 Fetch 및 BGG 실시간 슬리브 파서 */
    async function fetchViaReliableProxy(targetUrl, timeoutMs = 7000) {
        const attempts = [
            async () => {
                const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
                if (!r.ok) throw new Error('ao');
                const j = await r.json();
                return j.contents || '';
            },
            async () => {
                const r = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);
                if (!r.ok) throw new Error('ct');
                return await r.text();
            }
        ];
        for (const fn of attempts) {
            try {
                const res = await Promise.race([
                    fn(),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('to')), timeoutMs))
                ]);
                if (res && res.length > 20) return res;
            } catch (e) {}
        }
        return null;
    }

    async function searchBggIdLive(queryTitle) {
        if (!queryTitle) return null;
        const q = String(queryTitle).trim();
        if (/^\d{1,8}$/.test(q)) return q;

        // BGG 내부 JSON 검색 API
        const urls = [
            `https://api.geekdo.com/api/geekitems?nosession=1&objecttype=thing&subtype=boardgame&search=${encodeURIComponent(q)}&showcount=5`,
            `https://boardgamegeek.com/search/boardgame?q=${encodeURIComponent(q)}&nosession=1&showcount=5`
        ];
        for (const u of urls) {
            const raw = await fetchViaReliableProxy(u, 6000);
            if (!raw) continue;
            try {
                const parsed = JSON.parse(raw);
                const items = parsed.items || parsed.geekitems || [];
                if (items.length > 0) {
                    const id = items[0].objectid || items[0].id;
                    if (id) return String(id);
                }
            } catch (e) {
                const m = raw.match(/"objectid"\s*:\s*"?(\d+)"?/i);
                if (m) return m[1];
            }
        }
        return null;
    }

    async function fetchSleevesFromBggLive(bggId) {
        if (!bggId) return [];
        const sizeMap = {};
        const addCard = (w, h, qty) => {
            const sz = normalizeDimension(w, h);
            const c = parseInt(qty, 10) || 0;
            if (sz && c > 0) sizeMap[sz] = (sizeMap[sz] || 0) + c;
        };

        // 1순위: BGG 내부 카드셋 API / 2순위: BGG /sleeves 페이지
        const urls = [
            `https://api.geekdo.com/api/sleever/games/${bggId}`,
            `https://boardgamegeek.com/boardgame/${bggId}/sleeves`
        ];

        for (const u of urls) {
            const raw = await fetchViaReliableProxy(u, 7500);
            if (!raw) continue;

            try {
                const parsed = JSON.parse(raw);
                const sets = parsed.cardsets || parsed.cardSets || parsed.item?.cardsets || [];
                if (Array.isArray(sets) && sets.length > 0) {
                    const first = sets[0];
                    const sub = first.items || first.cards || first.rolls;
                    if (Array.isArray(sub) && sub.length > 0) {
                        sub.forEach(s => addCard(s.width || s.w, s.height || s.h, s.quantity || s.count || s.qty));
                    } else {
                        const baseVer = first.versionid || first.setname || null;
                        sets.forEach(s => {
                            if (baseVer && (s.versionid || s.setname) && (s.versionid || s.setname) !== baseVer) return;
                            addCard(s.width || s.cardwidth || s.w, s.height || s.cardheight || s.h, s.quantity || s.count || s.cardcount || s.qty);
                        });
                    }
                }
            } catch (e) {}

            if (Object.keys(sizeMap).length === 0) {
                const reg = /"width"\s*:\s*"?([0-9.]+)"?\s*,\s*"height"\s*:\s*"?([0-9.]+)"?[^}]*?"(?:quantity|count|cardcount)"\s*:\s*"?(\d+)"?/gi;
                let m;
                while ((m = reg.exec(raw)) !== null) addCard(m[1], m[2], m[3]);
            }
            if (Object.keys(sizeMap).length > 0) break;
        }
        return Object.entries(sizeMap).map(([size, count]) => ({ size, count }));
    }

    /* 6. 로컬 사전 & 사용자 학습 캐시 확인 */
    function lookupLocalSleeves(rawGame, ignoreExistingField = false) {
        if (!rawGame) return [];
        if (!ignoreExistingField) {
            if (Array.isArray(rawGame.sleeves) && rawGame.sleeves.length > 0) {
                return rawGame.sleeves.filter(s => s && s.size && (parseInt(s.count, 10) || 0) > 0);
            }
            const rawStr = rawGame.sleeveSize || rawGame.customFields?.['슬리브규격'] || '';
            const rawCnt = rawGame.sleeveCount || rawGame.customFields?.['슬리브매수'] || 0;
            if (rawStr && typeof global.parseTextToSleeves === 'function') {
                const p = global.parseTextToSleeves(rawStr, rawCnt);
                if (p.length > 0) return p;
            }
        }

        const names = [
            rawGame.customFields?.['게임 이름'],
            rawGame.name,
            rawGame.title,
            rawGame.originalName,
            rawGame.engName
        ].filter(Boolean);

        let userCache = {};
        try { userCache = JSON.parse(localStorage.getItem(CUSTOM_SLEEVE_DB_KEY) || '{}'); } catch (e) {}

        for (const n of names) {
            const k = cleanKey(n);
            if (!k) continue;
            if (userCache[k] && Array.isArray(userCache[k]) && userCache[k].length > 0) {
                return JSON.parse(JSON.stringify(userCache[k]));
            }
            if (KOR_BGG_SLEEVE_DICT[k]) {
                return JSON.parse(JSON.stringify(KOR_BGG_SLEEVE_DICT[k])).filter(s => s.count > 0);
            }
        }
        return [];
    }

    /* 7. 통합 슬리브 자동 수집기 (사전에 없는 게임도 5단계 파이프라인으로 끝까지 추적) */
    async function autoFetchBggSleevesForGame(game, silent = false, forceRefresh = false, manualQueryOverride = null) {
        if (!game) return { bggId: null, sleeves: [] };

        let sleeves = (!manualQueryOverride) ? lookupLocalSleeves(game, forceRefresh) : [];
        let bggId = game.bggId || null;
        const korName = game.customFields?.['게임 이름'] || game.name || '';
        let engTitle = game.originalName || game.engName || '';

        // 괄호 안 영문명 추출: 예 "백로성 (The White Castle)"
        if (!engTitle) {
            const pm = korName.match(/\(([^)]*[a-zA-Z]{2,}[^)]*)\)/);
            if (pm) engTitle = pm[1].trim();
        }

        if (sleeves.length === 0) {
            if (!silent) global.showMessage?.(`🔍 [${korName}] 외부 BGG 슬리브 마스터 DB 조회 중...`, 'success');

            // [Step A] Wikidata 공식 다국어 API(CORS 허용)로 한글명 -> BGG ID & 영문 원제 확보
            if (!manualQueryOverride && (!bggId || !engTitle)) {
                const wd = await queryWikidataForBoardgame(korName);
                if (wd.bggId && !bggId) bggId = wd.bggId;
                if (wd.engTitle && !engTitle) engTitle = wd.engTitle;
            }

            // [Step B] 구글 GTX 번역기로 한글명 -> 영문 키워드 확보 (보조)
            if (!manualQueryOverride && !engTitle && korName) {
                try {
                    const cleanQ = korName.replace(/\([^)]*\)/g, '').trim();
                    const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(cleanQ)}`);
                    if (r.ok) {
                        const j = await r.json();
                        const tr = j?.[0]?.[0]?.[0];
                        if (tr && /[a-zA-Z]/.test(tr)) engTitle = tr.trim();
                    }
                } catch (e) {}
            }

            // [Step C] 외부 오픈소스 BGG 슬리브 마스터 DB(CDN)에서 조회 (CORS 차단 없음)
            const extDb = await loadExternalMasterSleeveDB();
            if (extDb) {
                if (bggId && extDb.byBggId.has(String(bggId))) {
                    sleeves = extDb.byBggId.get(String(bggId));
                }
                const queryTitle = manualQueryOverride || engTitle || korName;
                if (!sleeves.length && queryTitle) {
                    const ck = cleanKey(queryTitle);
                    if (extDb.byCleanTitle.has(ck)) {
                        const hit = extDb.byCleanTitle.get(ck);
                        sleeves = hit.sleeves;
                        if (hit.id && !bggId) bggId = hit.id;
                    }
                }
                // 한글 음차 발음 정규식 매칭 (예: "캐스캐디아" -> "cascadia")
                if (!sleeves.length && !manualQueryOverride && korName && extDb.rawList.length > 0) {
                    const phoneticRx = korPhoneticToRegexPattern(cleanKey(korName));
                    if (phoneticRx) {
                        const found = extDb.rawList.find(item => phoneticRx.test(item.ck));
                        if (found) {
                            sleeves = found.sleeves;
                            if (found.id && !bggId) bggId = found.id;
                        }
                    }
                }
            }

            // [Step D] 여전히 못 찾았으면 실시간 BGG API(api.geekdo.com) 호출
            if (!sleeves.length) {
                const searchQ = manualQueryOverride || engTitle || korName.replace(/\([^)]*\)/g, '').trim();
                if (!bggId && searchQ) {
                    bggId = await searchBggIdLive(searchQ);
                }
                if (bggId) {
                    sleeves = await fetchSleevesFromBggLive(bggId);
                }
            }
        }

        // [Step E] 수동 재수집 버튼 클릭인데 못 찾은 경우 영문명/BGG ID 직접 입력창 제공
        if (sleeves.length === 0 && !silent && forceRefresh && !manualQueryOverride) {
            const userQ = prompt(
                `[${korName}]의 한글 이름으로 BGG 자동 매칭이 되지 않았습니다.\n` +
                `영문 게임명(예: Cascadia) 또는 BGG ID 번호(예: 295947)를 입력하시면 즉시 가져옵니다:`,
                engTitle || ''
            );
            if (userQ && userQ.trim()) {
                return await autoFetchBggSleevesForGame(game, false, true, userQ.trim());
            }
        }

        // [Step F] index.html의 let allUserGames 스코프 문제를 완벽히 우회하여 데이터 반영 및 저장
        const sleeveText = typeof global.formatSleevesToText === 'function'
            ? global.formatSleevesToText(sleeves)
            : sleeves.map(s => `${s.size}:${s.count}`).join(', ');
        const totalCnt = sleeves.reduce((sum, s) => sum + (parseInt(s.count, 10) || 0), 0);

        // 전달받은 game 참조 객체를 직접 수정 (index.html 내부의 allUserGames 원소와 동일 참조)
        if (bggId) game.bggId = String(bggId);
        if (engTitle && !game.originalName) game.originalName = engTitle;
        game.sleeves = sleeves;
        game.sleeveSize = sleeveText;
        game.sleeveCount = totalCnt;
        if (!game.customFields) game.customFields = {};
        game.customFields['슬리브규격'] = sleeveText;
        game.customFields['슬리브매수'] = String(totalCnt);

        // LocalStorage에도 직접 동기화하여 let 스코프 누락 100% 방지
        try {
            const stored = JSON.parse(localStorage.getItem(GAMES_STORAGE_KEY) || '[]');
            const idx = stored.findIndex(g => String(g.id) === String(game.id) || g.name === game.name);
            if (idx >= 0) {
                stored[idx].bggId = game.bggId;
                stored[idx].sleeves = sleeves;
                stored[idx].sleeveSize = sleeveText;
                stored[idx].sleeveCount = totalCnt;
                if (!stored[idx].customFields) stored[idx].customFields = {};
                stored[idx].customFields['슬리브규격'] = sleeveText;
                stored[idx].customFields['슬리브매수'] = String(totalCnt);
                localStorage.setItem(GAMES_STORAGE_KEY, JSON.stringify(stored));
            }
        } catch (e) {}

        if (sleeves.length > 0 && typeof global.rememberCustomSleevePreset === 'function') {
            global.rememberCustomSleevePreset(korName, sleeves);
        }
        if (typeof global.persistData === 'function') global.persistData();
        if (typeof global.renderFilteredGames === 'function') global.renderFilteredGames();

        const openModal = document.querySelector('#detailModal .detail-content');
        if (openModal && String(openModal.dataset.docId) === String(game.id) && typeof global.renderModalContent === 'function') {
            global.renderModalContent(game);
        }

        if (!silent) {
            const disp = typeof global.formatSleevesDisplay === 'function' ? global.formatSleevesDisplay(sleeves) : sleeveText;
            if (sleeves.length > 0) {
                global.showMessage?.(`🛡️ [${korName}] 슬리브 자동 입력 완료: ${disp}`, 'success');
            } else {
                global.showMessage?.(`ℹ️ [${korName}] 슬리브 정보가 없거나 카드가 없는 게임입니다.`, 'error');
            }
        }

        return { bggId, sleeves };
    }

    global.autoDetectSleevesForGame = function (rawGame) {
        return lookupLocalSleeves(rawGame, false);
    };
    global.autoFetchBggSleevesForGame = autoFetchBggSleevesForGame;
})(window);
