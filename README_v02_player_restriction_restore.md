# v02 OneLearn Player Restriction Restore Full Code

기준:
- 사용자가 공유한 player.js / player.html을 기준으로 플레이어만 복구/보강했습니다.
- 대시보드 파일은 포함하지 않았습니다.

포함 파일:
- player.html
- src/js/player.js
- src/css/player.css

핵심 보강:
- preventForwardSeeking 우회 차단: timeline / seeking / keyboard
- maxAllowedTime 기준 앞으로 이동 제한 유지
- seek_blocked / seek_attempt 로그 유지
- 배속 제한: allowPlaybackRate, minPlaybackRate, maxPlaybackRate, option disabled, ratechange 보정
- 본인확인: identityCheckCount 1회 이상 분산 체크포인트 지원
- actualWatchSeconds 재생 중에만 증가
- pauseWhenHidden 유지
- 챕터 이동 정책: allowChapterNavigation, allowPreviousChapter, allowNextChapter, requireCurrentChapterCompleteBeforeNext, confirmChapterMove
- course_completed 로그 보강
- 사용법 2번 모바일 챕터 드로어 자동 열림 / 다른 단계 자동 닫힘
- 모바일 챕터 드로어 바깥 터치 닫힘
- PC 챕터 버튼 숨김
- footer B안: 로고 왼쪽 끝, 문구 오른쪽 끝
- 자세히/접기 버튼 동일 스타일
- CC 버튼 크기/두께 완화
