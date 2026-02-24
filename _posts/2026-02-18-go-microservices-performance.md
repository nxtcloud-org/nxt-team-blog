---
layout: post
title: "Go 마이크로서비스 성능 최적화 경험기"
description: "수백만 RPS를 처리하는 Go 마이크로서비스를 구축하면서 적용한 성능 최적화 기법들을 공유합니다."
author: minjun
date: 2026-02-18 09:00:00 +0900
tags: [Go, Performance, Microservices]
---

NXT 팀의 핵심 API 서버는 Go로 작성되어 있습니다. 초기에는 하루 1,000만 요청 정도였지만, 지금은 피크 타임 기준 초당 50만 요청(500k RPS)을 처리합니다. 이 과정에서 경험한 성능 최적화 여정을 공유합니다.

## sync.Pool로 할당 최소화

Go의 GC는 훌륭하지만, 고성능 서비스에서는 할당(allocation) 자체를 줄이는 것이 중요합니다.

```go
var bufferPool = sync.Pool{
    New: func() interface{} {
        return make([]byte, 0, 4096)
    },
}

func processRequest(data []byte) []byte {
    buf := bufferPool.Get().([]byte)
    defer func() {
        buf = buf[:0]
        bufferPool.Put(buf)
    }()

    // buf를 사용한 처리
    buf = append(buf, data...)
    return processData(buf)
}
```

이 변경만으로 GC pause time이 평균 8ms에서 0.5ms로 줄었습니다.

## 채널 대신 락-프리 자료구조

처음에는 채널로 작업자 풀을 구현했습니다.

```go
// 이전 방식 - 채널 기반
jobs := make(chan Job, 1000)
for i := 0; i < numWorkers; i++ {
    go worker(jobs)
}
```

하지만 채널 경합이 병목이 됐습니다. `ants` 라이브러리의 goroutine pool로 교체하니 처리량이 35% 향상됐습니다.

```go
import "github.com/panjf2000/ants/v2"

pool, _ := ants.NewPoolWithFunc(numWorkers, func(i interface{}) {
    processJob(i.(Job))
})
defer pool.Release()

pool.Invoke(job)
```

## 프로파일링으로 실제 병목 찾기

추측하지 말고 측정하세요. pprof는 Go에 내장된 강력한 도구입니다.

```go
import _ "net/http/pprof"

// 별도 포트에서 pprof 서버 실행
go func() {
    log.Println(http.ListenAndServe(":6060", nil))
}()
```

```bash
# CPU 프로파일 30초 수집
go tool pprof -http=:8081 http://localhost:6060/debug/pprof/profile?seconds=30

# 힙 메모리 분석
go tool pprof -http=:8081 http://localhost:6060/debug/pprof/heap
```

실제로 프로파일링해보니 예상치 못한 곳에서 병목이 발생했습니다. `json.Marshal`이 전체 CPU의 23%를 차지하고 있었고, `sonic` 라이브러리로 교체하니 JSON 처리 시간이 60% 줄었습니다.

## 구조체 필드 정렬

작지만 놀라운 최적화입니다.

```go
// 나쁜 예 - 패딩 낭비
type Bad struct {
    A bool    // 1 byte
    B int64   // 8 bytes (7 bytes padding)
    C bool    // 1 byte
    D int64   // 8 bytes (7 bytes padding)
} // 총 32 bytes

// 좋은 예 - 큰 필드 먼저
type Good struct {
    B int64   // 8 bytes
    D int64   // 8 bytes
    A bool    // 1 byte
    C bool    // 1 byte
} // 총 18 bytes (패딩 포함 24 bytes)
```

수백만 개 객체를 처리하는 서비스에서 메모리 사용량이 15% 감소했습니다.

## 벤치마크로 검증

성능 개선 전후를 항상 벤치마크로 측정합니다.

```go
func BenchmarkProcessRequest(b *testing.B) {
    data := generateTestData()
    b.ResetTimer()
    b.ReportAllocs()

    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            processRequest(data)
        }
    })
}
```

```bash
go test -bench=. -benchtime=10s -count=5 ./...
```

## 결과

이러한 최적화들을 적용한 결과:
- **처리량**: 150k RPS → 500k RPS (233% 향상)
- **P99 지연**: 45ms → 12ms
- **메모리 사용**: 8GB → 3.2GB
- **GC Pause**: 평균 8ms → 0.5ms

성능 최적화는 한 번에 모든 것을 바꾸는 것이 아닙니다. 프로파일링으로 병목을 찾고, 하나씩 측정하며 개선하는 과정입니다.
