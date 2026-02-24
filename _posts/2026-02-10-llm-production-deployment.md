---
layout: post
title: "LLM 서비스 프로덕션 배포: 비용과 성능의 균형"
description: "GPT-4 수준의 LLM 서비스를 프로덕션에 배포하면서 겪은 비용 폭탄과 성능 이슈를 어떻게 해결했는지 공유합니다."
author: soyeon
date: 2026-02-10 11:00:00 +0900
tags: [AI, LLM, MLOps]
---

LLM 기반 서비스를 처음 론칭했을 때, 첫 달 API 비용이 예상의 10배가 나왔습니다. 이후 6개월간 비용을 92% 절감하면서 동시에 응답 속도도 40% 개선한 경험을 공유합니다.

## 문제 진단: 어디서 돈이 새나

처음에는 모든 요청에 GPT-4를 사용했습니다. 사용자가 "안녕"이라고 입력해도 GPT-4가 응답했죠. 토큰 사용량을 분석해보니:

| 요청 유형 | 비율 | 평균 토큰 |
|-----------|------|-----------|
| 단순 질의응답 | 65% | 800 tokens |
| 복잡한 추론 | 20% | 3,200 tokens |
| 코드 생성 | 15% | 4,500 tokens |

단순 질의응답이 전체의 65%인데 GPT-4를 쓰고 있었습니다.

## 솔루션 1: 라우팅 레이어 도입

요청의 복잡도를 분류해 적절한 모델로 라우팅합니다.

```python
from enum import Enum

class Complexity(Enum):
    SIMPLE = "simple"
    MEDIUM = "medium"
    COMPLEX = "complex"

class ModelRouter:
    def __init__(self):
        self.models = {
            Complexity.SIMPLE: "gpt-3.5-turbo",
            Complexity.MEDIUM: "gpt-4o-mini",
            Complexity.COMPLEX: "gpt-4o",
        }

    def classify(self, query: str, context: dict) -> Complexity:
        # 간단한 휴리스틱으로 분류
        tokens = len(query.split())

        if tokens < 20 and not context.get("requires_reasoning"):
            return Complexity.SIMPLE
        elif tokens < 100 or context.get("is_code_task"):
            return Complexity.MEDIUM
        else:
            return Complexity.COMPLEX

    def get_model(self, query: str, context: dict) -> str:
        complexity = self.classify(query, context)
        return self.models[complexity]
```

이것만으로 비용의 60%가 절감됐습니다.

## 솔루션 2: 시맨틱 캐싱

동일하거나 유사한 질문에 대해 캐시된 응답을 반환합니다.

```python
import numpy as np
from redis import Redis
import pickle

class SemanticCache:
    def __init__(self, redis_client: Redis, threshold: float = 0.92):
        self.redis = redis_client
        self.threshold = threshold
        self.embedder = load_embedding_model()

    def get(self, query: str) -> str | None:
        query_embedding = self.embedder.encode(query)

        # 저장된 모든 임베딩과 코사인 유사도 계산
        cached_keys = self.redis.keys("cache:embed:*")

        for key in cached_keys:
            cached_embed = pickle.loads(self.redis.get(key))
            similarity = self._cosine_sim(query_embedding, cached_embed)

            if similarity >= self.threshold:
                response_key = key.replace(b"embed:", b"resp:")
                return self.redis.get(response_key).decode()

        return None

    def set(self, query: str, response: str, ttl: int = 3600):
        cache_id = generate_id(query)
        embedding = self.embedder.encode(query)

        self.redis.setex(f"cache:embed:{cache_id}", ttl, pickle.dumps(embedding))
        self.redis.setex(f"cache:resp:{cache_id}", ttl, response)

    def _cosine_sim(self, a, b) -> float:
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
```

캐시 히트율이 안정화된 이후 32%로, 추가로 32%의 비용이 절감됐습니다.

## 솔루션 3: 스트리밍과 청크 처리

긴 응답을 기다리는 동안 사용자는 이탈합니다. 스트리밍으로 첫 토큰 도달 시간(TTFT)을 줄입니다.

```python
async def stream_response(query: str):
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.openai.com/v1/chat/completions",
            json={
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": query}],
                "stream": True,
            },
            headers={"Authorization": f"Bearer {API_KEY}"},
        ) as response:
            async for line in response.content:
                if line.startswith(b"data: "):
                    data = line[6:].decode().strip()
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)
                    if content := chunk["choices"][0]["delta"].get("content"):
                        yield content
```

TTFT가 3.2초에서 0.4초로 줄어 사용자 이탈률이 45% 감소했습니다.

## 결과 정리

6개월간의 최적화 결과:

- **월 비용**: $48,000 → $3,840 (92% 절감)
- **평균 응답 시간**: 4.1초 → 2.4초
- **TTFT**: 3.2초 → 0.4초
- **사용자 만족도**: 3.4점 → 4.2점 (5점 만점)

비용 절감이 오히려 성능 향상으로 이어진 경우입니다. 복잡도에 맞는 모델을 사용하니 더 빠른 응답이 가능했고, 캐싱으로 반복 질문에 즉시 응답하게 됐습니다.

다음 포스트에서는 LLM 응답 품질 평가 시스템 구축에 대해 다루겠습니다.
