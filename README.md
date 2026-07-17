# csTimer clone — Toss-style speedcubing timer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/INNO-HI-Inc/cstimer-clone/actions/workflows/ci.yml/badge.svg)](https://github.com/INNO-HI-Inc/cstimer-clone/actions/workflows/ci.yml)

[cstimer.net](https://cstimer.net)의 기능을 재현한 **오리지널 코드** 팬 클론입니다.
토스(TDS) 디자인 언어를 적용한 순수 정적 웹앱(바닐라 HTML/CSS/JS)으로, 서버 없이 동작합니다.

## 주요 기능

- **타이머**: 스페이스/터치 홀드 시작, WCA 15초 인스펙션(+2/DNF 자동), 멀티페이즈 스플릿, 목표 시간, 수동 입력(일괄 붙여넣기)
- **스크램블**: WCA 16종 + 트레이너 4종(<R,U>, <R,U,F>, <M,U>, 2x2 CLL), 길이 조절, 히스토리, 미리보기
- **스크램블 이미지**: NxN(2~7), 피라밍크스, 스큐브, 스퀘어-1, 클락, 메가밍크스 — 전부 상태 시뮬레이션 기반
- **통계**: ao5/12/50/100/1000, mo3, BPA/WPA, 분포/추세 차트, PB 히스토리, 세션 비교
- **세션/데이터**: 무제한 세션, 색상/메모/아카이브, 자동 백업, csTimer JSON 가져오기 호환, CSV
- **UI**: 토스 스타일 라이트/다크/시스템 테마, 포인트 컬러 5종, 한/영, 토스트·바텀시트·컨페티
- **모바일/PWA**: 반응형 레이아웃, 홈 화면 설치, 완전 오프라인 동작(서비스워커) — 폰트까지 자체 호스팅이라 네트워크 없이도 그대로 렌더링

## 실행

정적 파일이므로 `index.html`을 열거나:

```bash
python3 -m http.server 8000
```

## 개발 노트

- 각 퍼즐 모듈은 Node 셀프테스트 내장: `node js/draw_nnn.js` 등 (실패 시 exit 1)
- 기능 팩은 `js/feat_*.js`, 코어 API 계약은 [API.md](API.md), 기능 목록은 [UPGRADES.md](UPGRADES.md)
- 랜덤 무브 스크램블 사용(원본의 랜덤 스테이트와 다름) — 연습용으로 충분하지만 대회 규정 수준은 아님
- **모든 URL은 상대경로**여야 합니다. GitHub Pages가 서브패스(`/cstimer-clone/`)로 서빙하므로 `/...`로 시작하면 깨집니다.

### CI

`.github/workflows/ci.yml`이 push/PR마다 아래를 검사합니다 (의존성 없음, npm 불필요):

1. 모든 JS `node --check` 문법 검사
2. 퍼즐/스크램블/통계 모듈 셀프테스트 8종
3. `.github/scripts/check-precache.js` — sw.js의 precache 목록과 실제 파일이 어긋나면 실패
4. desktop/mobile 미디어 쿼리가 서로의 정확한 여집합으로 유지되는지
5. 루트 절대경로(`/...`) URL 사용 여부

### 서비스워커

`sw.js`는 **stale-while-revalidate**입니다. 캐시본을 즉시 주고 백그라운드에서 항상 재검증하므로,
`CACHE_VERSION`을 깜빡해도 다음 로드에서 스스로 최신화됩니다(예전 cache-first는 사용자를 구버전에
영구히 묶어두는 버그가 있었습니다). 업데이트 시 `{type:'SW_UPDATED', version}`을 페이지로 보내
새로고침 토스트를 띄웁니다 — 실행 중인 타이머를 날릴 수 있으므로 자동 새로고침은 하지 않습니다.

## 라이선스 / 크레딧

- 코드: **MIT** — 전문은 [LICENSE](LICENSE) (이 저장소의 코드는 전부 새로 작성된 오리지널입니다)
- 폰트: [Pretendard](https://github.com/orioncactus/pretendard) v1.3.9, SIL Open Font License 1.1 — `fonts/`에 자체 호스팅
- 원본 아이디어·기능 설계: [csTimer](https://cstimer.net) — 이 프로젝트는 비공식 팬 클론이며 원본과 무관합니다

## 구조: 모바일 / 데스크톱 분리

레이아웃은 기기별로 파일이 완전히 분리돼 있고, 두 미디어 쿼리는 서로의 **정확한 여집합**이라 어떤 화면에서도 정확히 하나만 적용됩니다.

| 파일 | 적용 대상 |
|---|---|
| `style.css` | 공통 토큰·컴포넌트 (레이아웃 없음) |
| `desktop.css` | `(min-width:761px) and (min-height:501px), (min-width:951px)` |
| `mobile.css` | `(max-width:760px), (max-height:500px) and (max-width:950px)` |
| `js/mobile.js` | 모바일 UX 레이어 (탭·스와이프·롱프레스·웨이크락). 데스크톱에선 자동 해제 |

`app.js`(엔진)는 기기를 모르며, 모바일 UI는 `window.App` 플러그인 API로만 붙습니다.
따라서 모바일을 고쳐도 데스크톱은 영향을 받지 않습니다.
