# v04 OneLearn Fullcode No Common Restore

중요:
- common.css는 포함하지 않았습니다.
- config.js는 포함하지 않았습니다.
- login/dashboard/player 모두 common.css와 config.js를 참조하지 않습니다.
- storage.js는 필수 유틸이므로 포함했습니다.

테스트 로그인:
- 이메일: test@company.com
- 비밀번호: 10018177
- 인증 코드: 123456

핵심 복구:
- 로그인은 제거하지 않고 정상 동작하도록 auth.js에서 config.js 의존성을 제거했습니다.
- 로그인 성공 시 localStorage session을 생성합니다.
- dashboard/player는 session 기반으로 동작합니다.
- player.js는 사용자가 공유한 제한 기능 로직을 기준으로 유지하고 seek/playback/identity/chapter 정책 우회를 보강했습니다.
- footer는 로고 왼쪽 끝, 문구 오른쪽 끝 정렬입니다.
- common.css 전역 오염을 제거했습니다.
