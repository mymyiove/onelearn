# OneLearn Frontend Prototype

기업별 테넌트 분리형 학습자 온보딩·대시보드·동영상 플레이어 프론트엔드 프로토타입입니다.  
본 프로젝트는 **학습자 로그인 → 약관 동의 → 학습장 대시보드 → 강의 플레이어 → 수료 진행률 기록**까지의 기본 UX 흐름을 검증하기 위한 정적 프론트 패키지입니다.

---

## 1. 프로젝트 목적

OneLearn은 기업 고객별로 독립된 학습 환경을 제공하는 것을 목표로 합니다.

핵심 방향은 다음과 같습니다.

- 기업별 테넌트 분리
- 기업별 브랜딩/공지/과정/학습자 데이터 분리
- 학습자 로그인 및 최초 온보딩
- 약관·개인정보·학습 이력 처리 동의
- 추천 과정 및 진행 중 과정 확인
- 강의 이어보기
- 동영상 시청 기록 저장
- 수료 기준 기반 진행률 표시
- 모바일/PC 반응형 학습 경험 제공

현재 버전은 **관리자 기능 제외**, 학습자 프론트 중심입니다.

---

## 2. 현재 최신 버전

```text
v0.1.9_layout_final
```

최근 반영된 주요 개선 사항은 다음과 같습니다.

- PC/모바일 레이아웃 재정리
- 로그인 페이지 푸터 추가
- 로그인 페이지 모바일 스크롤 최소화
- 학습장 PC 메뉴 제거
- 모바일 전용 햄버거 메뉴 추가
- 학습장 통계 카드 클릭 필터 복구
- 공지 카드 5초 자동 전환
- 공지 팝업 닫기 버튼 개선
- 플레이어 헤더를 학습장과 동일한 구조로 통일
- 플레이어 푸터 위치 오류 수정
- 플레이어 컨트롤러 단순화
- 모바일 플레이어 가로 넘침 수정
- 모바일 플레이어 챕터 drawer 적용
- 스킬 과정 챕터 2 추가

---

## 3. 디렉터리 구조

```text
/
├─ index.html
├─ login.html
├─ dashboard.html
├─ player.html
│
├─ src/
│  ├─ css/
│  │  ├─ common.css
│  │  ├─ auth.css
│  │  ├─ dashboard.css
│  │  └─ player.css
│  │
│  ├─ js/
│  │  ├─ config.js
│  │  ├─ storage.js
│  │  ├─ auth.js
│  │  ├─ dashboard.js
│  │  └─ player.js
│  │
│  └─ img/
│     ├─ Favicon.png
│     └─ skillone_logo_col_full.png
│
└─ data/
   ├─ tenants.json
   └─ tenants/
      └─ woongjin/
         ├─ tenant.json
         ├─ learners.json
         ├─ assignments.json
         ├─ courses.json
         └─ courses/
            ├─ legal-001.json
            └─ skill-001.json
```

---

## 4. 페이지별 역할

### 4.1 `index.html`

진입용 라우팅 페이지입니다.

```text
index.html?tenant=woongjin
```

접속 시 기본적으로 다음 페이지로 이동합니다.

```text
dashboard.html?tenant=woongjin
```

세션이 없으면 대시보드에서 로그인 페이지로 이동됩니다.

---

### 4.2 `login.html`

학습자 로그인 페이지입니다.

현재 지원 기능:

- 이메일/비밀번호 로그인
- 최초 이메일 인증 단계
- 최초 비밀번호 변경 단계
- 비밀번호 찾기 데모 플로우
- 모바일 한 화면 수납 최적화
- PC/모바일 반응형 카드 레이아웃
- 로그인 페이지 푸터 포함

테스트 계정:

```text
이메일: test@company.com
초기 비밀번호: 10018177
이메일 인증 코드: 123456
```

비밀번호 찾기 데모:

1. `비밀번호를 잊으셨나요?` 클릭
2. `test@company.com` 입력
3. 화면에 임시 비밀번호 표시
4. 임시 비밀번호로 로그인
5. 새 비밀번호 변경 화면으로 이동

> 현재는 정적 프론트 데모이므로 실제 이메일 발송은 구현되어 있지 않습니다. 서버 구축 시 이메일 API와 연결하면 됩니다.

---

### 4.3 `dashboard.html`

학습자 학습장 대시보드입니다.

주요 기능:

- 추천 과정 확인
- 진행 중 과정 확인
- 수료 완료 과정 확인
- 마감 임박 과정 확인
- 통계 카드 클릭 필터
- 과정 검색
- 과정 카드 상세보기 접힘/펼침
- 최근 학습 강의 표시
- 추천 강의 섹션
- 공지 카드 표시
- 공지 5초 자동 전환
- 공지 팝업 상세보기
- 약관/개인정보/학습 이력 동의 오버레이
- 모바일 햄버거 메뉴

통계 카드 필터:

```text
추천 과정 → 전체 과정
진행 중 → 진행률이 있는 과정
수료 완료 → 수료 조건 충족 과정
마감 임박 → 7일 이내 마감 과정
```

모바일 헤더 구조:

```text
OneLearn                  [로그아웃] [=]
```

모바일 햄버거 메뉴:

```text
웅진씽크빅 · 정호준 님
안녕하세요!

강의 목록
학습 현황
공지사항
```

---

### 4.4 `player.html`

동영상 학습 플레이어입니다.

주요 기능:

- 강의 상세 정보 접힘/펼침
- 챕터 목록 표시
- 모바일 챕터 drawer
- 챕터 클릭 이동
- 영상 클릭 시 재생/일시정지
- 더블클릭 시 전체화면
- 진행률 저장
- 실제 재생시간 저장
- 앞으로 이동 정책 처리
- 배속 정책 표시
- 본인확인 팝업
- 수료 조건 충족 오버레이
- 완료 오버레이 닫기 버튼
- 전체 진행률 카드 분리
- 수료 기준 카드 표시
- 재생 문제 해결 가이드 팝업
- 푸터 포함

플레이어 컨트롤 구성:

```text
▶ / Ⅱ
배속 선택
🔊 / 🔇
볼륨
CC
⛶
```

플레이어 안내 문구:

```text
화면 탭: 재생/일시정지 · 더블탭: 전체화면   문제가 있나요?
```

`문제가 있나요?` 클릭 시 재생 문제 해결 가이드가 표시됩니다.

---

## 5. 데이터 구조

### 5.1 `data/tenants.json`

전체 테넌트 목록입니다.

```json
{
  "tenants": [
    {
      "tenantId": "woongjin",
      "tenantName": "웅진씽크빅"
    }
  ]
}
```

---

### 5.2 `data/tenants/woongjin/tenant.json`

테넌트 기본 정보입니다.

```json
{
  "tenantId": "woongjin",
  "tenantName": "웅진씽크빅",
  "displayName": "웅진 OneLearn",
  "brand": {
    "primaryColor": "#F47721"
  }
}
```

---

### 5.3 `learners.json`

학습자 데이터입니다.

```json
{
  "tenantId": "woongjin",
  "learners": [
    {
      "userId": "usr-001",
      "name": "정호준",
      "email": "test@company.com",
      "employeeNo": "10018177",
      "tempPassword": "10018177"
    }
  ]
}
```

---

### 5.4 `courses.json`

과정 목록 메타 데이터입니다.

```json
{
  "tenantId": "woongjin",
  "courses": [
    {
      "courseId": "legal-001",
      "title": "법정의무과정 테스트 과정",
      "category": "법정의무과정",
      "required": true,
      "dueDate": "2026-06-30",
      "estimatedMinutes": 45,
      "courseFile": "./data/tenants/woongjin/courses/legal-001.json"
    },
    {
      "courseId": "skill-001",
      "title": "AI 시대 스킬 트랜스포메이션",
      "category": "스킬과정",
      "required": true,
      "dueDate": "2026-07-15",
      "estimatedMinutes": 60,
      "courseFile": "./data/tenants/woongjin/courses/skill-001.json"
    }
  ]
}
```

---

### 5.5 과정 상세 JSON

예시 파일:

```text
data/tenants/woongjin/courses/legal-001.json
data/tenants/woongjin/courses/skill-001.json
```

과정 상세 JSON에는 다음 정보가 포함됩니다.

- 과정명
- 과정 설명
- 카테고리
- 마감일
- 예상 학습 시간
- 강사 정보
- 수료 정책
- 챕터 목록
- 영상 URL
- 챕터별 정책

---

## 6. 수료 정책 구조

예시:

```json
{
  "completionPolicy": {
    "requiredCourseProgressPercent": 95,
    "requiredActualWatchPercent": 50,
    "requireAllChaptersCompleted": true,
    "allowPlaybackRate": true,
    "minPlaybackRate": 0.75,
    "maxPlaybackRate": 2,
    "preventForwardSeeking": true,
    "identityCheckCount": 1,
    "pauseWhenHidden": true
  }
}
```

의미:

| 필드 | 설명 |
|---|---|
| `requiredCourseProgressPercent` | 과정 전체 진행률 수료 기준 |
| `requiredActualWatchPercent` | 실제 재생시간 기준 |
| `requireAllChaptersCompleted` | 모든 챕터 완료 필요 여부 |
| `allowPlaybackRate` | 배속 허용 여부 |
| `minPlaybackRate` | 최소 배속 |
| `maxPlaybackRate` | 최대 배속 |
| `preventForwardSeeking` | 앞으로 이동 제한 여부 |
| `identityCheckCount` | 본인확인 필요 횟수 |
| `pauseWhenHidden` | 탭 숨김 시 일시정지 여부 |

학습자 화면에서는 기술 용어 대신 다음처럼 표시합니다.

```text
배속: 허용 / 비허용
앞으로 이동: 가능 / 불가
본인확인: 1회
완료 기준: 95% 이상
```

---

## 7. 로컬 저장 방식

현재 버전은 서버 없이 `localStorage`를 사용합니다.

저장되는 주요 값:

```text
session
learnerOverrides
progress:{userId}:{courseId}
```

예시:

```text
onelearn:woongjin:session
onelearn:woongjin:learnerOverrides
onelearn:woongjin:progress:usr-001:legal-001
```

저장 정보:

- 로그인 세션
- 이메일 인증 여부
- 비밀번호 변경 여부
- 약관 동의 여부
- 챕터별 진행률
- 챕터별 실제 재생시간
- 본인확인 횟수
- 완료 여부
- 최근 학습 시간

---

## 8. 모바일 최적화 요약

### 로그인

- 모바일에서 설명/롤업 요소 축소 또는 숨김
- 입력창이 한 화면 안에 들어오도록 카드 높이 조정
- 모바일 푸터 숨김
- `100svh` 기준 레이아웃 적용

### 학습장

- PC 메뉴 제거
- 모바일 햄버거 메뉴 제공
- 통계 카드 모바일 압축
- 모바일 통계 카드 이모지 제거
- 검색 버튼 줄바꿈 방지
- 과정 카드는 1열 표시
- 추천 강의/최근 학습 카드 제공

### 플레이어

- 모바일 헤더 구조:

```text
OneLearn              [과정 목록] [챕터]
```

- 챕터 drawer 하단 슬라이드 방식
- 컨트롤러 축소
- 가로 넘침 방지
- 모바일 푸터 숨김
- 영상 우선 배치
- 진행률/수료기준 2분할 카드 배치

---

## 9. 현재 포함된 테스트 과정

### 9.1 법정의무과정 테스트 과정

```text
courseId: legal-001
category: 법정의무과정
chapter: 1개
forward seeking: 불가
identity check: 1회
```

### 9.2 AI 시대 스킬 트랜스포메이션

```text
courseId: skill-001
category: 스킬과정
chapter: 2개
forward seeking: 가능
identity check: 0회
```

스킬 과정은 챕터 이동 테스트를 위해 같은 영상 URL을 사용하는 챕터 2개로 구성되어 있습니다.

---

## 10. 실행 방법

정적 파일 서버에서 실행해야 `fetch()`로 JSON 파일을 정상적으로 불러올 수 있습니다.

### VS Code Live Server

1. 프로젝트 폴더 열기
2. `index.html` 또는 `login.html`에서 Live Server 실행
3. 아래 주소로 접속

```text
/login.html?tenant=woongjin
```

### Python 간단 서버

```bash
python -m http.server 8000
```

접속:

```text
http://localhost:8000/login.html?tenant=woongjin
```

---

## 11. 테스트 시나리오

### 최초 로그인

```text
1. /login.html?tenant=woongjin 접속
2. test@company.com 입력
3. 10018177 입력
4. 인증 코드 123456 입력
5. 새 비밀번호 8자 이상 설정
6. 대시보드 진입
7. 약관 전체 확인
8. 학습 시작
```

### 비밀번호 찾기

```text
1. 비밀번호를 잊으셨나요? 클릭
2. test@company.com 입력
3. 화면에 표시된 임시 비밀번호 확인
4. 임시 비밀번호로 로그인
5. 새 비밀번호 변경
```

### 대시보드

```text
1. 추천 과정/진행 중/수료 완료/마감 임박 카드 클릭
2. 필터링 확인
3. 과정 검색
4. 과정 상세보기 펼침
5. 학습 시작 클릭
```

### 플레이어

```text
1. 영상 클릭으로 재생/일시정지
2. 더블클릭으로 전체화면
3. 진행바 클릭
4. 챕터 이동
5. 모바일에서 챕터 drawer 확인
6. 수료 조건 충족 오버레이 확인
7. 문제가 있나요? 클릭
```

---

## 12. 서버 구축 시 전환해야 할 부분

현재는 정적 프론트이므로 다음 기능은 서버 구축 시 API로 전환해야 합니다.

### 인증

현재:

```text
localStorage 기반 데모 로그인
```

서버 전환:

```text
POST /auth/login
POST /auth/verify-email
POST /auth/reset-password
POST /auth/change-password
```

### 이메일 발송

현재:

```text
임시 비밀번호 화면 표시
```

서버 전환:

```text
이메일 API 연동
임시 비밀번호 또는 재설정 링크 발송
```

### 약관 동의

현재:

```text
localStorage learnerOverrides 저장
```

서버 전환:

```text
POST /learners/{learnerId}/consents
```

### 학습 기록

현재:

```text
localStorage progress:{userId}:{courseId}
```

서버 전환:

```text
POST /learning-events
PATCH /learning-progress/{courseId}/chapters/{chapterId}
```

### 공지

현재:

```text
프론트 JS 배열
```

서버 전환:

```text
GET /tenants/{tenantId}/notices
```

### 과정/챕터

현재:

```text
정적 JSON 파일
```

서버 전환:

```text
GET /tenants/{tenantId}/courses
GET /courses/{courseId}
```

---

## 13. 추천 서버 아키텍처

현재 배포 방향이 GitHub + Cloudflare 기준이므로 다음 구성이 적합합니다.

```text
Cloudflare Pages
- 정적 프론트 배포

Cloudflare Workers
- 인증 API
- 학습 이벤트 API
- 과정/공지 API

Cloudflare D1
- 테넌트
- 학습자
- 과정
- 챕터
- 학습 기록
- 수료 기록
- 공지
- 약관 동의

Cloudflare R2
- 영상 파일
- 자막 파일
- 썸네일
- 첨부 자료
```

---

## 14. 향후 개발 우선순위

1. Cloudflare D1 스키마 설계
2. Workers API 설계
3. 인증/세션 구조 구현
4. 학습 이벤트 저장 API 구현
5. 수료 판정 서버화
6. 공지 관리 API 구현
7. 테넌트별 과정 관리 API 구현
8. 관리자/슈퍼어드민 화면 구현
9. R2 영상 업로드 및 서명 URL 적용
10. 수료 리포트 및 다운로드 기능 구현

---

## 15. 주요 UX 결정 사항

- PC에서는 학습장 메뉴 제거
- 모바일에서는 햄버거 메뉴 제공
- 모바일 로그인은 한 화면 수납 우선
- 모바일 플레이어는 챕터 drawer 방식
- 학습 기록 초기화는 학습자 화면에서 제거
- 통계 카드는 클릭 필터 역할 유지
- 공지는 카드형 + 자동 전환 + 팝업 상세 방식
- 과정 카드는 기본 compact, 상세보기 클릭 시 확장
- 플레이어 문제 해결은 별도 링크형 팝업으로 제공
- 수료 기준은 학습자 친화 문구로 표시

---

## 16. 참고

현재 프로젝트는 프론트 프로토타입이므로 보안/인증/이메일/진행률 검증은 실제 운영 수준이 아닙니다.  
운영 전환 시 반드시 서버 기반 인증, 서버 기반 학습 이벤트 저장, 서버 기반 수료 판정으로 전환해야 합니다.
