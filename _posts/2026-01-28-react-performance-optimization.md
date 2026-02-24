---
layout: post
title: "React 앱 성능 최적화: Core Web Vitals 개선기"
description: "LCP 4.2초에서 1.1초로, CLS 0.3에서 0.02로 개선한 실전 React 성능 최적화 경험을 공유합니다."
author: hyunwoo
date: 2026-01-28 10:00:00 +0900
tags: [React, Performance, Frontend]
---

지난 분기에 NXT 팀 메인 대시보드의 Core Web Vitals를 개선하는 작업을 진행했습니다. 처음 측정 결과는 참담했습니다.

- **LCP**: 4.2초 (기준: 2.5초 이하)
- **FID**: 380ms (기준: 100ms 이하)
- **CLS**: 0.31 (기준: 0.1 이하)

## 번들 크기 분석부터

먼저 무엇이 번들을 크게 만드는지 파악했습니다.

```bash
# webpack-bundle-analyzer 설치
npm install --save-dev webpack-bundle-analyzer

# 분석 실행
npx webpack-bundle-analyzer build/static/js/*.js
```

충격적이었습니다. moment.js가 전체 번들의 23%를 차지하고 있었습니다. 한국어 날짜 포맷팅을 위해 추가했는데, 모든 로케일 파일이 포함돼 있었습니다.

```javascript
// 이전: moment.js (67KB gzipped)
import moment from 'moment';
const formatted = moment(date).format('YYYY년 MM월 DD일');

// 이후: date-fns (트리쉐이킹 지원, 2KB)
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
const formatted = format(date, 'yyyy년 MM월 dd일', { locale: ko });
```

번들 크기가 340KB에서 180KB로 줄었습니다.

## 코드 스플리팅

모든 라우트를 한 번에 로드하지 않아도 됩니다.

```jsx
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

초기 번들이 180KB에서 72KB로 줄었고, LCP가 4.2초 → 2.1초로 개선됐습니다.

## 이미지 최적화

프로파일링 도구로 보니 대용량 PNG 이미지들이 LCP에 큰 영향을 미치고 있었습니다.

{% raw %}
```jsx
// 반응형 이미지 + WebP 지원
function OptimizedImage({ src, alt, width, height }) {
  const webpSrc = src.replace(/\.(png|jpg)$/, '.webp');

  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        style={{ aspectRatio: `${width}/${height}` }}
      />
    </picture>
  );
}
```
{% endraw %}

`aspectRatio` 설정이 CLS를 크게 개선했습니다. 이미지가 로드되기 전에 공간을 미리 확보하기 때문입니다.

## useMemo와 useCallback의 올바른 사용

이 훅들을 모든 곳에 남발하면 오히려 성능이 나빠집니다.

```jsx
// ❌ 잘못된 사용 - 단순한 연산에 useMemo는 오버헤드
const doubled = useMemo(() => value * 2, [value]);

// ✅ 올바른 사용 - 무거운 연산에만
const processedData = useMemo(() => {
  return heavyDataProcessing(rawData); // 수만 개 항목 처리
}, [rawData]);

// ✅ 자식 컴포넌트에 전달하는 함수
const handleSubmit = useCallback((data) => {
  onSubmit(data);
}, [onSubmit]);
```

React DevTools Profiler로 실제로 불필요한 리렌더링이 발생하는 컴포넌트를 찾아 최적화했습니다.

## 가상화로 긴 목록 처리

1만 개 항목을 렌더링하면 당연히 느립니다.

```jsx
import { FixedSizeList } from 'react-window';

function VirtualizedList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ListItem data={items[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={72}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

10,000개 항목 렌더링 시간이 2.3초에서 16ms로 줄었습니다.

## 최종 결과

| 메트릭 | 이전 | 이후 | 기준 |
|--------|------|------|------|
| LCP | 4.2초 | 1.1초 | ✅ 2.5초 |
| FID | 380ms | 45ms | ✅ 100ms |
| CLS | 0.31 | 0.02 | ✅ 0.1 |

Lighthouse 점수가 42점에서 96점으로 올라갔고, 사용자 이탈률이 18% 감소했습니다.

성능 최적화의 핵심은 **측정 → 분석 → 개선 → 재측정** 사이클입니다. 추측하지 말고 데이터로 판단하세요.
