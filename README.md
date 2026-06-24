# jomd2pdf — 마크다운 → PDF 변환기

마크다운 노트를 브라우저에서 미리보고 고품질 PDF로 저장하는 순수 정적 웹페이지.

## 로컬 실행
정적 파일이지만 ES 모듈은 http로 서빙해야 합니다(`file://` 불가):
```bash
npm run serve   # http://localhost:8080 (또는 npx serve)
```
Chrome/Edge 권장.

## 사용법
1. 📁 폴더 선택(또는 창에 폴더 드래그)으로 .md·이미지 등록
2. 왼쪽 목록에서 파일 선택 → 미리보기
3. ⚙ 설정에서 용지/여백/폰트/코드 테마/페이지 번호 조절
4. 🖨 인쇄 → "PDF로 저장"

## 배포 (빌드 불필요)
정적 호스팅에 루트 파일을 그대로 올리면 됩니다.
- **GitHub Pages**: 저장소 push 후 Settings → Pages에서 브랜치 지정
- **Netlify/Vercel**: 빌드 명령 없이 루트 디렉터리 배포
(`node_modules/`·`tests/`·`fixtures/`는 배포에 불필요)

## 테스트
```bash
npm test
```
