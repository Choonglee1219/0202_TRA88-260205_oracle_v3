# OpenBIM Oracle Viewer

이 프로젝트는 **OpenBIM Components**와 **Oracle Database**를 기반으로 구축된 웹 기반 BIM(Building Information Modeling) 뷰어 및 협업 플랫폼입니다. IFC 모델의 업로드, 시각화, 속성 관리, 그리고 BCF(BIM Collaboration Format)를 통한 이슈 관리 및 간섭 체크(Clash Detection) 기능을 제공합니다.

## 🚀 주요 기능

*   **IFC & Fragment 모델 뷰어**: `.ifc` 및 `.frag` (최적화된 형상 포맷) 파일의 로드 및 3D 시각화.
*   **데이터베이스 연동**: Oracle Database를 사용하여 모델 파일(BLOB) 및 메타데이터 저장/로드.
*   **BCF 이슈 관리 (BCF Topics)**:
    *   이슈 생성, 수정, 삭제.
    *   뷰포트(카메라 위치, 선택된 객체, 색상) 저장 및 복원.
    *   BCF 파일(`.bcf`) 가져오기/내보내기 및 DB 저장.
    *   N:N 관계를 통해 하나의 BCF 이슈를 여러 IFC 모델에 연결.
*   **간섭 체크 (Clash Detection)**:
    *   두 모델 간의 간섭을 분석하고 결과를 시각화.
    *   간섭 결과를 BCF 이슈로 자동 변환하여 저장.
*   **프로퍼티 관리 (Properties Manager)**: IFC 객체의 속성 조회 및 수정.
*   **공간구조 트리 (Spatial Tree)**: 모델의 공간 구조(층, 실 등) 탐색.
*   **쿼리 빌더 (Query Builder)**: 조건에 맞는 객체 검색 및 강조.

## 🛠 기술 스택

### Frontend
*   **Language**: TypeScript
*   **Library**: That Open Company (OpenBIM Components)
    *   `@thatopen/components`: 코어 BIM 로직.
    *   `@thatopen/ui`: UI 컴포넌트 (Lit 기반).
    *   `@thatopen/components-front`: 프론트엔드 전용 기능.
*   **3D Engine**: Three.js
*   **Build Tool**: Vite

### Backend
*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Database Driver**: `oracledb` (Oracle Database Node.js Driver)
*   **File Handling**: Multer (메모리 스토리지 사용)

### Database
*   **DBMS**: Oracle Database

## ⚙️ 설치 및 설정 (Setup)

### 1. 데이터베이스 설정 (Oracle DB)

프로젝트 루트의 `src/SQL-worksheet.sql` 파일을 사용하여 필요한 테이블을 생성합니다.

```sql
-- 주요 테이블: ifc, frag, bcf, ifc_bcf (관계 테이블)
-- SQL-worksheet.sql의 내용을 Oracle 데이터베이스에서 실행하세요.
```

### 2. 백엔드 설정 (`src/app.ts`)

`src/app.ts` 파일에서 Oracle DB 연결 정보 및 서버 IP를 환경에 맞게 수정하세요.

```typescript
const ifcPoolConfig = {
  user: "HR",          // 사용자 이름
  password: "123456",  // 비밀번호
  connectString: "localhost/orcl", // 연결 문자열
  // ...
};
	// Unchanged lines
		const response = await fetch("http://${서버IP}/clash", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(clashRequest),
		});
```

### 3. 의존성 설치

```bash
npm install
```

## ▶️ 실행 방법 (Usage)

이 프로젝트는 `concurrently` 패키지를 사용하여 프론트엔드와 백엔드를 하나의 명령어로 동시에 실행합니다.

### 1. 개발 서버 실행

백엔드 서버와 프론트엔드(Vite) 개발 서버를 동시에 실행합니다.

```bash
npm run dev
```

### 2. 프로젝트 빌드

TypeScript 소스 코드를 컴파일하고 프론트엔드 리소스를 빌드합니다. 
주의: src/app.ts 등 백엔드 코드가 수정된 경우, 변경 사항을 반영하려면 다시 빌드해야 합니다.

```bash
npm run build
```

### 3. 간섭 체크 서비스 (선택 사항)

간섭 체크 기능은 외부 서비스(`http://${서버IP}/clash`)로 요청을 프록시합니다. 해당 Python/C++ 기반의 간섭 체크 서비스가 별도로 실행 중이어야 정상 작동합니다.

## 🔧 설정 상세 (Configuration Details)

### `vite.config.ts` (Vite 설정)
*   **API Proxy**: 개발 서버 실행 시 `/api`로 시작하는 요청을 백엔드 서버(`http://${서버IP}:3001`)로 프록시(Proxy)하여 CORS 문제를 방지합니다.
*   **Build**: `top-level-await`를 지원하도록 설정되어 있어, 비동기 모듈 로딩이 가능합니다.

### `tsconfig.json` (TypeScript 설정)
*   **Target**: `ES2022`를 타겟으로 하여 최신 ECMAScript 기능을 활용합니다.
*   **Decorators**: `experimentalDecorators` 및 `emitDecoratorMetadata`가 활성화되어 있어 데코레이터 문법을 지원합니다.

### `vite-env.d.ts`
*   Vite의 클라이언트 타입 정의(`vite/client`)를 참조하여 정적 에셋 가져오기 및 환경 변수에 대한 타입 지원을 제공합니다.

## 📂 프로젝트 구조

*   `src/`
    *   `app.ts`: 백엔드 Express 서버 및 API 엔드포인트.
    *   `main.ts`: 프론트엔드 진입점, 뷰어 초기화.
    *   `globals.ts`: 전역 상수, 아이콘, 사용자 정보 정의.
    *   `bim-components/`: 커스텀 BIM 컴포넌트 (BCF, IFC, Fragment 관리).
    *   `setup/`: 뷰어 초기화 및 설정 로직 (Finders, Templaters).
    *   `ui-components/`: 재사용 가능한 UI 컴포넌트.
    *   `ui-templates/`: UI 레이아웃 및 패널 템플릿.
    *   `markdown/`: 마크다운 처리 관련 유틸리티.
    *   `SQL-worksheet.sql`: 데이터베이스 DDL 스크립트.


Special Thanks to ThatOpen Company.