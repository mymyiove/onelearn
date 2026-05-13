# 법정의무교육 비디오 플레이어 테스트

Google Drive MP4 영상을 HTML5 커스텀 플레이어로 재생하는 MVP입니다.

## 기능

- Google Drive 영상 재생 테스트
- 기본 video controls 제거
- 커스텀 재생/일시정지 버튼
- 10초 뒤로가기
- 배속 허용
- 빨리감기 차단
- 15초 heartbeat 로그
- 탭 이탈 시 일시정지
- 30초 시점 수강 확인 팝업
- localStorage 기반 테스트 로그 저장

## Google Drive 설정

1. MP4 파일 업로드
2. 공유 설정: 링크가 있는 모든 사용자 / Viewer
3. 공유 링크에서 파일 ID 추출

예:

https://drive.google.com/file/d/FILE_ID/view?usp=sharing

`data/videos.json`에 FILE_ID 입력

## Cloudflare Pages 설정

- Framework preset: None
- Build command: 비워둠
- Build output directory: /

## 주의

Google Drive는 영상 스트리밍 CDN이 아니므로 대용량 파일, 트래픽, 권한, 다운로드 제한에 따라 재생이 실패할 수 있습니다.
운영 단계에서는 Cloudflare R2, S3 호환 스토리지, OneDrive/SharePoint 연동, 또는 전용 미디어 저장소를 검토해야 합니다.
