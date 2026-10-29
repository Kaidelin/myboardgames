/* ============================================================================
   🛡️ sleeve_engine.js - BGG 복수 슬리브 실시간 자동 수집 & 초기화 독립 엔진
   (index.html 하단에 연결 시 기존 슬리브 함수를 자동으로 대체합니다)
   ============================================================================ */
(function (global) {
    'use strict';

    const CUSTOM_SLEEVE_DB_KEY = "MY_BG_CUSTOM_SLEEVE_PRESETS_V1";

    /* 1. 국내 다빈도 보유 게임 BGG 공식 복수 슬리브 마스터 사전 (오매칭 방지 1:1 정규화 키) */
    const KOR_BGG_SLEEVE_DICT = {
        // 주요 전략 / 게이머즈 게임
        '킵더히어로즈아웃': [{ size: '63.5x88', count: 193 }, { size: '57.5x89', count: 20 }],
        'keeptheheroesout': [{ size: '63.5x88', count: 193 }, { size: '57.5x89', count: 20 }],
        '정령섬': [{ size: '63.5x88', count: 138 }, { size: '45x68', count: 38 }],
        'spiritisland': [{ size: '63.5x88', count: 138 }, { size: '45x68', count: 38 }],
        '아르낙의잊혀진유적': [{ size: '63.5x88', count: 110 }],
        'lostruinsofarnak': [{ size: '63.5x88', count: 110 }],
        '세티': [{ size: '63.5x88', count: 210 }],
        '세티외계지성체탐사': [{ size: '63.5x88', count: 210 }],
        'seti': [{ size: '63.5x88', count: 210 }],
        '언스토퍼블': [{ size: '63.5x88', count: 150 }],
        'unstoppable': [{ size: '63.5x88', count: 150 }],
        '버건디의성스페셜에디션': [{ size: '44x67', count: 82 }, { size: '59x92', count: 67 }],
        '버건디의성': [{ size: '44x67', count: 82 }, { size: '59x92', count: 67 }],
        'thecastlesofburgundy': [{ size: '44x67', count: 82 }, { size: '59x92', count: 67 }],
        '에버델뉴리프': [{ size: '63.5x88', count: 109 }],
        'everdellnewleaf': [{ size: '63.5x88', count: 109 }],
        '에버델': [{ size: '63.5x88', count: 128 }, { size: '44x63', count: 39 }],
        'everdell': [{ size: '63.5x88', count: 128 }, { size: '44x63', count: 39 }],
        '엔데버심해': [{ size: '63.5x88', count: 80 }, { size: '45x68', count: 60 }],
        'endeavordeepsea': [{ size: '63.5x88', count: 80 }, { size: '45x68', count: 60 }],
        '보이드폴': [{ size: '63.5x88', count: 195 }, { size: '44x67', count: 209 }],
        'voidfall': [{ size: '63.5x88', count: 195 }, { size: '44x67', count: 209 }],
        '버튼즈앤버그즈': [{ size: '63.5x88', count: 52 }, { size: '44x68', count: 80 }],
        '글룸헤이븐버튼즈앤버그즈': [{ size: '63.5x88', count: 52 }, { size: '44x68', count: 80 }],
        '글룸헤이븐사자의턱': [{ size: '63.5x88', count: 251 }, { size: '44x68', count: 325 }],
        '사자의턱': [{ size: '63.5x88', count: 251 }, { size: '44x68', count: 325 }],
        '글룸헤이븐': [{ size: '63.5x88', count: 669 }, { size: '44x68', count: 1031 }],
        '프로스트헤이븐': [{ size: '63.5x88', count: 1159 }, { size: '44x68', count: 1330 }],
        '플립타운': [{ size: '63.5x88', count: 78 }],
        'fliptown': [{ size: '63.5x88', count: 78 }],
        '아크노바': [{ size: '63.5x88', count: 255 }],
        'arknova': [{ size: '63.5x88', count: 255 }],
        '테라포밍마스': [{ size: '63.5x88', count: 233 }],
        'terraformingmars': [{ size: '63.5x88', count: 233 }],
        '테라포밍마스아레스익스페디션': [{ size: '63.5x88', count: 257 }],
        '브라스버밍엄': [{ size: '63.5x88', count: 76 }],
        '브라스랭커셔': [{ size: '63.5x88', count: 66 }],
        '듄임페리움봉기': [{ size: '63.5x88', count: 165 }, { size: '44x68', count: 69 }],
        '듄임페리움': [{ size: '63.5x88', count: 151 }, { size: '44x68', count: 65 }],
        '윙스팬': [{ size: '57.5x89', count: 212 }],
        '윙스팬아시아': [{ size: '57.5x89', count: 117 }],
        '드래곤스팬': [{ size: '57.5x89', count: 235 }],
        '피니스팬': [{ size: '57.5x89', count: 162 }],
        '백로성': [{ size: '45x68', count: 45 }, { size: '59x92', count: 27 }],
        'thewhitecastle': [{ size: '45x68', count: 45 }, { size: '59x92', count: 27 }],
        '다윈의여정': [{ size: '63.5x88', count: 40 }, { size: '44x68', count: 56 }],
        '헤게모니': [{ size: '63.5x88', count: 350 }, { size: '44x68', count: 80 }],
        '슬레이더스파이어': [{ size: '63.5x88', count: 730 }, { size: '44x68', count: 10 }],
        '메이지나이트': [{ size: '63.5x88', count: 374 }],
        '메이지나이트얼티밋에디션': [{ size: '63.5x88', count: 389 }],
        '아컴호러카드게임': [{ size: '63.5x88', count: 234 }, { size: '41x63', count: 5 }],
        '반지의제왕카드게임': [{ size: '63.5x88', count: 226 }],
        '마블챔피언스': [{ size: '63.5x88', count: 343 }],
        '루트': [{ size: '63.5x88', count: 98 }],
        '사이드': [{ size: '57.5x89', count: 42 }, { size: '44x68', count: 80 }, { size: '70x110', count: 42 }],
        '클랭크': [{ size: '63.5x88', count: 184 }],
        '클랭크카타콤': [{ size: '63.5x88', count: 186 }],
        '클랭크인스페이스': [{ size: '63.5x88', count: 190 }],
        '언더워터시티즈': [{ size: '63.5x88', count: 225 }],
        '가이아프로젝트': [{ size: '44x68', count: 17 }],
        '오딘을위한잔치': [{ size: '56x87', count: 206 }, { size: '44x68', count: 126 }],
        '아그리콜라': [{ size: '59x92', count: 360 }],
        '카베르나': [{ size: '59x92', count: 30 }],
        '르아브르': [{ size: '56x87', count: 110 }],
        '그레이트웨스턴트레일': [{ size: '56x87', count: 122 }],
        '마라카이보': [{ size: '63.5x88', count: 265 }, { size: '44x68', count: 19 }],
        '스카이마인': [{ size: '63.5x88', count: 194 }, { size: '44x68', count: 60 }],
        '분더와글': [{ size: '63.5x88', count: 132 }],
        '원더풀월드': [{ size: '65x100', count: 162 }],
        '세븐원더스듀얼': [{ size: '44x68', count: 73 }, { size: '65x100', count: 23 }],
        '세븐원더스': [{ size: '65x100', count: 155 }],
        '스플렌더대결': [{ size: '56x87', count: 67 }],
        '스플렌더듀얼': [{ size: '56x87', count: 67 }],
        '스플렌더': [{ size: '63.5x88', count: 90 }],
        '센추리향신료의길': [{ size: '70x120', count: 94 }],
        '센추리골렘에디션': [{ size: '70x120', count: 99 }],
        '기즈모': [{ size: '60x60', count: 112 }],
        '도미니언': [{ size: '59x92', count: 500 }],
        '네메시스': [{ size: '63.5x88', count: 229 }, { size: '44x68', count: 106 }],
        '네메시스락다운': [{ size: '63.5x88', count: 263 }, { size: '44x68', count: 105 }],
        '엘드리치호러': [{ size: '57.5x89', count: 303 }, { size: '41x63', count: 176 }],
        '광기의저택': [{ size: '41x63', count: 198 }, { size: '70x120', count: 16 }],
        '로빈슨크루소': [{ size: '59x92', count: 277 }, { size: '44x68', count: 62 }],
        '데드오브윈터': [{ size: '63.5x88', count: 344 }],
        '팬데믹': [{ size: '63.5x88', count: 118 }],
        '팬데믹레거시시즌1': [{ size: '63.5x88', count: 185 }],
        '브래스버밍엄': [{ size: '63.5x88', count: 76 }],
        '팍스팜플로나': [{ size: '63.5x88', count: 156 }],
        '팍스파미르': [{ size: '63.5x88', count: 156 }],
        '히트': [{ size: '56x87', count: 324 }],
        '히트페달투더메탈': [{ size: '56x87', count: 324 }],
        '썬더로드벤데타': [{ size: '56x87', count: 55 }, { size: '44x68', count: 30 }],
        '퀘acks오브크베들린부르크': [{ size: '56x87', count: 24 }],
        '크베들린부르크의돌팔이약장수': [{ size: '56x87', count: 24 }],
        '캐스캐디아': [{ size: '70x120', count: 21 }],
        '하모니즈': [{ size: '70x120', count: 42 }],
        '숲속의작은세상': [{ size: '63.5x88', count: 180 }],
        '포레스트셔플': [{ size: '63.5x88', count: 180 }],
        '어스': [{ size: '57.5x89', count: 364 }],
        'earth': [{ size: '57.5x89', count: 364 }],
        '티켓투라이드유럽': [{ size: '44x68', count: 158 }],
        '티켓투라이드': [{ size: '56x87', count: 140 }],
        '카탄': [{ size: '54x80', count: 120 }],
        '석기시대': [{ size: '59x92', count: 36 }],
        '푸에르토리코': [{ size: '59x92', count: 0 }],
        '콩코르디아': [{ size: '59x92', count: 65 }, { size: '45x68', count: 7 }],
        '비티컬처': [{ size: '63.5x88', count: 82 }, { size: '44x68', count: 148 }],
        '칸반ev': [{ size: '57.5x89', count: 68 }],
        '리스보아': [{ size: '57.5x89', count: 103 }],
        '갤러리스트': [{ size: '45x68', count: 20 }],
        '온마스': [{ size: '57.5x89', count: 79 }],
        '이클립스두번째여명': [{ size: '44x67', count: 30 }],
        '황혼의투쟁': [{ size: '63.5x88', count: 110 }],
        '반지의제왕가운데땅전투': [{ size: '67x120', count: 110 }],
        '스타워즈리벨리온': [{ size: '57.5x89', count: 68 }, { size: '41x63', count: 95 }],
        // 가족 / 파티 / 카드 게임
        '스컬킹': [{ size: '56x87', count: 110 }],
        '달무티': [{ size: '56x87', count: 80 }],
        '더그레이트달무티': [{ size: '56x87', count: 80 }],
        '뱅': [{ size: '56x87', count: 103 }],
        '러브레터': [{ size: '63.5x88', count: 27 }],
        '시타델': [{ size: '57.5x89', count: 68 }, { size: '65x100', count: 27 }],
        '딕싯': [{ size: '80x120', count: 84 }],
        '딕싯오디세이': [{ size: '80x120', count: 84 }],
        '코드네임': [{ size: '67.5x44', count: 200 }, { size: '60x60', count: 40 }],
        '더마인드': [{ size: '59x92', count: 120 }],
        '더크루': [{ size: '56x87', count: 45 }, { size: '44x68', count: 39 }],
        '더크루심해탐사': [{ size: '56x87', count: 45 }, { size: '44x68', count: 96 }],
        '스카우트': [{ size: '56x87', count: 45 }],
        '노땡스': [{ size: '56x87', count: 33 }],
        '젝스님트': [{ size: '56x87', count: 104 }],
        '보난자': [{ size: '56x87', count: 154 }],
        '하나비': [{ size: '63.5x88', count: 60 }],
        '자이푸르': [{ size: '63.5x88', count: 55 }],
        '로스트시티': [{ size: '70x110', count: 60 }],
        '타르기': [{ size: '59x92', count: 80 }],
        '아줄': [{ size: '63.5x88', count: 0 }],
        '스시노고': [{ size: '56x87', count: 108 }],
        '익스플로딩키튼': [{ size: '63.5x88', count: 56 }],
        '사보타지': [{ size: '56x87', count: 110 }],
        '쿠': [{ size: '63.5x88', count: 15 }],
        '아발론': [{ size: '57.5x89', count: 24 }],
        '한밤의늑대인간': [{ size: '56x87', count: 16 }],
        '카르카손': [{ size: '63.5x88', count: 0 }],
        '미스테리움': [{ size: '80x120', count: 192 }, { size: '44x67', count: 54 }],
        '디셉션홍콩살인사건': [{ size: '63.5x88', count: 269 }, { size: '70x120', count: 32 }],
        '피드더크라켄': [{ size: '63.5x88', count: 78 }]
    };

    /* 한글 보드게임명 -> BGG 검색용 영문 원제 변환 사전 */
    const KOR_TO_ENG_TITLE = {
        '킵더히어로즈아웃': 'Keep the Heroes Out',
        '정령섬': 'Spirit Island',
        '아르낙의잊혀진유적': 'Lost Ruins of Arnak',
        '세티': 'SETI: Search for Extraterrestrial Intelligence',
        '언스토퍼블': 'Unstoppable',
        '버건디의성': 'The Castles of Burgundy',
        '에버델': 'Everdell',
        '에버델뉴리프': 'Everdell: Newleaf',
        '엔데버심해': 'Endeavor: Deep Sea',
        '보이드폴': 'Voidfall',
        '버튼즈앤버그즈': 'Gloomhaven: Buttons & Bugs',
        '글룸헤이븐': 'Gloomhaven',
        '프로스트헤이븐': 'Frosthaven',
        '플립타운': 'Fliptown',
        '아크노바': 'Ark Nova',
        '테라포밍마스': 'Terraforming Mars',
        '브라스버밍엄': 'Brass: Birmingham',
        '듄임페리움': 'Dune: Imperium',
        '듄임페리움봉기': 'Dune: Imperium – Uprising',
        '윙스팬': 'Wingspan',
        '백로성': 'The White Castle',
        '다윈의여정': "Darwin's Journey",
        '헤게모니': 'Hegemony: Lead Your Class to Victory',
        '슬레이더스파이어': 'Slay the Spire: The Board Game',
        '메이지나이트': 'Mage Knight Board Game',
        '루트': 'Root',
        '사이드': 'Scythe',
        '클랭크': 'Clank!: A Deck-Building Adventure',
        '세븐원더스듀얼': '7 Wonders Duel',
        '세븐원더스': '7 Wonders',
        '스플렌더': 'Splendor',
        '스플렌더대결': 'Splendor Duel',
        '오딘을위한잔치': 'A Feast for Odin',
        '그레이트웨스턴트레일': 'Great Western Trail',
        '크베들린부르크의돌팔이약장수': 'The Quacks of Quedlinburg',
        '숲속의작은세상': 'Forest Shuffle'
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
        if (w >= 69.0 && w <= 71.0 && h >= 119.0 && h >= 121.0) return '70x120';
        if (w >= 79.0 && w <= 81.0 && h >= 119.0 && h >= 121.0) return '80x120';
        const cw = Number.isInteger(w) ? String(w) : w.toFixed(1).replace(/\.0$/, '');
        const ch = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(/\.0$/, '');
        return `${cw}x${ch}`;
    }

    /* 2. CORS 차단을 우회하는 JSON 래퍼 프록시 호출기 */
    async function fetchTextReliable(targetUrl, timeoutMs = 7500) {
        const runners = [
            // 1순위: AllOrigins JSON Wrapper (CORS 헤더 100% 보장)
            async () => {
                const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
                if (!r.ok) throw new Error('ao');
                const j = await r.json();
                return j.contents || '';
            },
            // 2순위: Codetabs Proxy
            async () => {
                const r = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);
                if (!r.ok) throw new Error('ct');
                return await r.text();
            },
            // 3순위: AllOrigins Raw
            async () => {
                const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);
                if (!r.ok) throw new Error('aoraw');
                return await r.text();
            }
        ];

        for (const run of runners) {
            try {
                const text = await Promise.race([
                    run(),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
                ]);
                if (text && text.length > 20) return text;
            } catch (e) {}
        }
        return null;
    }

    /* 3. 한글 게임명 -> 영문 원제 자동 변환 (사전 + 보드라이프 + GTX 번역) */
    async function resolveEnglishTitleAndBggId(game) {
        let bggId = game.bggId || game.customFields?.bggId || null;
        if (bggId) bggId = String(bggId).match(/(\d+)/)?.[1] || null;

        const korName = game.customFields?.['게임 이름'] || game.name || '';
        const normKor = cleanKey(korName);
        let engTitle = game.originalName || game.engName || KOR_TO_ENG_TITLE[normKor] || '';

        // 게임 이름 괄호 안에 영문이 이미 있는 경우 추출: 예 "백로성 (The White Castle)"
        if (!engTitle) {
            const parenMatch = korName.match(/\(([^)]*[a-zA-Z]{2,}[^)]*)\)/);
            if (parenMatch) engTitle = parenMatch[1].trim();
        }
        // 게임 이름 자체가 영문인 경우
        if (!engTitle && /^[a-zA-Z0-9\s:&'\-!.,]+$/.test(korName.trim())) {
            engTitle = korName.trim();
        }

        // 보드라이프 구형/신형 페이지에서 영문 원제 또는 BGG 링크 추출
        const blNum = typeof global.getBlNumId === 'function' ? global.getBlNumId(game) : null;
        if ((!bggId || !engTitle) && blNum) {
            const blUrls = [
                `https://boardlife.co.kr/bbs_detail.php?bbs_num=${blNum}&tb=boardgame_strategy`,
                `https://boardlife.co.kr/game/${blNum}`
            ];
            for (const u of blUrls) {
                const html = await fetchTextReliable(u, 5000);
                if (!html) continue;
                const bggM = html.match(/boardgamegeek\.com\/boardgame(?:expansion)?\/(\d+)/i);
                if (bggM && !bggId) bggId = bggM[1];
                const titleM = html.match(/<title>([^<]+)<\/title>/i);
                if (titleM && !engTitle) {
                    const pm = titleM[1].match(/\(([^)]*[a-zA-Z]{3,}[^)]*)\)/);
                    if (pm) engTitle = pm[1].trim();
                }
                if (bggId || engTitle) break;
            }
        }

        // 여전히 영문명이 없으면 Google GTX API로 한글 보드게임명 -> 영문 변환
        if (!engTitle && korName) {
            try {
                const cleanQ = korName.replace(/\([^)]*\)/g, '').trim();
                const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(cleanQ)}`;
                const r = await fetch(gtxUrl);
                if (r.ok) {
                    const j = await r.json();
                    const tr = j?.[0]?.[0]?.[0];
                    if (tr && /[a-zA-Z]/.test(tr)) engTitle = tr.trim();
                }
            } catch (e) {}
        }

        return { bggId, engTitle, korName };
    }

    /* 4. BGG 공식 내부 JSON API(api.geekdo.com)로 bggId 검색 */
    async function searchBggObjectId(query) {
        if (!query) return null;
        const q = String(query).trim();
        if (!q) return null;
        if (/^\d{1,8}$/.test(q)) return q;

        const urls = [
            `https://api.geekdo.com/api/geekitems?nosession=1&objecttype=thing&subtype=boardgame&search=${encodeURIComponent(q)}&showcount=5`,
            `https://boardgamegeek.com/search/boardgame?q=${encodeURIComponent(q)}&nosession=1&showcount=5`
        ];

        for (const u of urls) {
            const raw = await fetchTextReliable(u, 6000);
            if (!raw) continue;
            try {
                const data = JSON.parse(raw);
                const list = data.items || data.geekitems || [];
                if (list.length > 0) {
                    const first = list[0];
                    const id = first.objectid || first.id;
                    if (id) return String(id);
                }
            } catch (e) {
                const m = raw.match(/"objectid"\s*:\s*"?(\d+)"?/i);
                if (m) return m[1];
            }
        }
        return null;
    }

    /* 5. BGG ID로 슬리브/카드셋 JSON 추출 (api.geekdo.com + /sleeves 페이지) */
    async function fetchSleevesByBggId(bggId) {
        if (!bggId) return [];
        const sizeMap = {};
        const addCard = (w, h, qty) => {
            const sz = normalizeDimension(w, h);
            const c = parseInt(qty, 10) || 0;
            if (sz && c > 0) sizeMap[sz] = (sizeMap[sz] || 0) + c;
        };

        // 시도 A: api.geekdo.com sleever / cardsets 전용 JSON 엔드포인트
        const apiUrls = [
            `https://api.geekdo.com/api/sleever/games/${bggId}`,
            `https://boardgamegeek.com/boardgame/${bggId}/sleeves`
        ];

        for (const u of apiUrls) {
            const raw = await fetchTextReliable(u, 7500);
            if (!raw) continue;

            // JSON 응답 직접 파싱
            try {
                const parsed = JSON.parse(raw);
                const sets = parsed.cardsets || parsed.cardSets || parsed.item?.cardsets || [];
                if (Array.isArray(sets) && sets.length > 0) {
                    const first = sets[0];
                    const subItems = first.items || first.cards || first.rolls;
                    if (Array.isArray(subItems) && subItems.length > 0) {
                        subItems.forEach(s => addCard(s.width || s.w, s.height || s.h, s.quantity || s.count || s.qty));
                    } else {
                        const baseVer = first.versionid || first.setname || null;
                        sets.forEach(s => {
                            if (baseVer && (s.versionid || s.setname) && (s.versionid || s.setname) !== baseVer) return;
                            addCard(s.width || s.cardwidth || s.w, s.height || s.cardheight || s.h, s.quantity || s.count || s.cardcount || s.qty);
                        });
                    }
                }
            } catch (e) {}

            // HTML 내 GEEK.geekitemPreload 파싱
            if (Object.keys(sizeMap).length === 0) {
                try {
                    const m = raw.match(/GEEK\.geekitemPreload\s*=\s*(\{[\s\S]*?\});\s*(?:GEEK\.|<\/script>)/i);
                    if (m) {
                        const preload = JSON.parse(m[1]);
                        const cs = preload?.item?.cardsets || preload?.cardsets || [];
                        if (Array.isArray(cs) && cs.length > 0) {
                            const baseVer = cs[0]?.versionid || cs[0]?.setname || null;
                            cs.forEach(s => {
                                if (baseVer && (s.versionid || s.setname) && (s.versionid || s.setname) !== baseVer) return;
                                addCard(s.width || s.cardwidth || s.w, s.height || s.cardheight || s.h, s.quantity || s.count || s.qty);
                            });
                        }
                    }
                } catch (e) {}
            }

            // 정규식 추출 폴백
            if (Object.keys(sizeMap).length === 0) {
                const reg = /"width"\s*:\s*"?([0-9.]+)"?\s*,\s*"height"\s*:\s*"?([0-9.]+)"?[^}]*?"(?:quantity|count|cardcount)"\s*:\s*"?(\d+)"?/gi;
                let m;
                while ((m = reg.exec(raw)) !== null) addCard(m[1], m[2], m[3]);
            }

            if (Object.keys(sizeMap).length > 0) break;
        }

        return Object.entries(sizeMap).map(([size, count]) => ({ size, count }));
    }

    /* 6. 로컬 사전 & 사용자 학습 캐시 즉시 조회 */
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

    /* 7. 메인 BGG 자동 수집 함수 (index.html의 기존 함수를 완전히 오버라이드) */
    async function autoFetchBggSleevesForGame(game, silent = false, forceRefresh = false, manualQueryOverride = null) {
        if (!game) return { bggId: null, sleeves: [] };

        // 1단계: 내장 BGG 검증 사전에서 먼저 확인 (가장 빠르고 정확함)
        let sleeves = (! manualQueryOverride) ? lookupLocalSleeves(game, forceRefresh) : [];
        let bggId = game.bggId || null;

        // 2단계: 사전에 없는 게임이거나 직접 검색어를 지정한 경우 실시간 BGG API 호출
        if (sleeves.length === 0) {
            if (!silent) global.showMessage?.(`🔍 [${game.name}] BGG 실시간 슬리브 조회 중...`, 'success');

            if (manualQueryOverride) {
                bggId = await searchBggObjectId(manualQueryOverride);
            } else {
                const meta = await resolveEnglishTitleAndBggId(game);
                bggId = meta.bggId;
                if (!bggId && meta.engTitle) bggId = await searchBggObjectId(meta.engTitle);
                if (!bggId && meta.korName) bggId = await searchBggObjectId(meta.korName.replace(/\([^)]*\)/g, '').trim());
            }

            if (bggId) {
                sleeves = await fetchSleevesByBggId(bggId);
            }
        }

        // 3단계: 개별 수동 버튼 클릭(!silent && forceRefresh)인데 못 찾은 경우 영문명/BGG ID 직접 입력 지원
        if (sleeves.length === 0 && !silent && forceRefresh && !manualQueryOverride) {
            const userQ = prompt(
                `[${game.name}]의 한글 이름으로 BGG 자동 매칭이 되지 않았습니다.\n` +
                `게임의 영문 이름(예: White Castle) 또는 BGG ID 번호(예: 371942)를 입력하시면 즉시 슬리브를 가져옵니다:`,
                game.originalName || ''
            );
            if (userQ && userQ.trim()) {
                return await autoFetchBggSleevesForGame(game, false, true, userQ.trim());
            }
        }

        // 4단계: 게임 데이터에 반영 및 저장
        const target = (Array.isArray(global.allUserGames) && global.allUserGames.find(g => g.id === game.id)) || game;
        if (bggId) target.bggId = String(bggId);

        target.sleeves = sleeves;
        target.sleeveSize = typeof global.formatSleevesToText === 'function' ? global.formatSleevesToText(sleeves) : '';
        target.sleeveCount = sleeves.reduce((sum, s) => sum + (parseInt(s.count, 10) || 0), 0);
        if (!target.customFields) target.customFields = {};
        target.customFields['슬리브규격'] = target.sleeveSize;
        target.customFields['슬리브매수'] = String(target.sleeveCount);

        if (sleeves.length > 0 && typeof global.rememberCustomSleevePreset === 'function') {
            global.rememberCustomSleevePreset(target.name, sleeves);
        }
        if (typeof global.persistData === 'function') global.persistData();
        if (typeof global.renderFilteredGames === 'function') global.renderFilteredGames();

        const openModal = document.querySelector('#detailModal .detail-content');
        if (openModal && openModal.dataset.docId === target.id && typeof global.renderModalContent === 'function') {
            global.renderModalContent(target);
        }

        if (!silent) {
            const disp = typeof global.formatSleevesDisplay === 'function' ? global.formatSleevesDisplay(sleeves) : target.sleeveSize;
            if (sleeves.length > 0) {
                global.showMessage?.(`🛡️ [${target.name}] 슬리브 자동 입력 완료: ${disp}`, 'success');
            } else {
                global.showMessage?.(`ℹ️ [${target.name}] 슬리브 정보가 없거나 카드가 없는 게임입니다.`, 'error');
            }
        }

        return { bggId, sleeves };
    }

    /* 전역 함수 덮어쓰기 */
    global.autoDetectSleevesForGame = function (rawGame) {
        return lookupLocalSleeves(rawGame, false);
    };
    global.autoFetchBggSleevesForGame = autoFetchBggSleevesForGame;
})();
