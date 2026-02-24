---
layout: post
title: "쿠버네티스 프로덕션 운영 실전 가이드"
description: "실제 프로덕션 환경에서 쿠버네티스를 안정적으로 운영하면서 얻은 교훈과 베스트 프랙티스를 공유합니다."
author: jiwon
date: 2026-02-24 10:00:00 +0900
tags: [Kubernetes, DevOps, Cloud]
---

NXT 팀에서 2년간 쿠버네티스를 프로덕션에서 운영하면서 경험한 것들을 정리합니다. 처음에는 단순히 "컨테이너를 오케스트레이션하는 도구"로 시작했지만, 이제는 우리 인프라의 핵심이 되었습니다.

## 리소스 요청과 제한 설정

가장 먼저 배운 교훈은 **모든 파드에 리소스 요청과 제한을 명시해야 한다**는 것입니다.

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "500m"
```

처음에는 귀찮아서 이 설정을 생략했다가 노드가 OOM Killer에 의해 파드를 무작위로 종료하는 상황을 겪었습니다. 특히 `requests`와 `limits`의 차이를 이해하는 것이 중요합니다.

- **requests**: 스케줄링 시 보장되는 최소 리소스
- **limits**: 파드가 사용할 수 있는 최대 리소스

> QoS 클래스를 Guaranteed로 만들려면 requests와 limits를 동일하게 설정하세요. 이렇게 하면 OOM 상황에서 가장 마지막으로 종료됩니다.

## Liveness와 Readiness Probe 분리

이 두 가지를 동일하게 설정하는 실수를 자주 봅니다.

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 2
```

- **Liveness Probe**: 애플리케이션이 데드락 등으로 응답 불가 상태인지 확인. 실패하면 파드 재시작.
- **Readiness Probe**: 트래픽을 받을 준비가 됐는지 확인. 실패하면 서비스 엔드포인트에서 제거.

데이터베이스 초기화나 워밍업이 필요한 서비스는 readiness probe에 더 엄격한 기준을 적용하고, liveness probe는 단순히 프로세스가 살아있는지만 확인하도록 분리했습니다.

## PodDisruptionBudget 설정

노드 업그레이드나 클러스터 유지보수 시 서비스 중단을 방지하려면 필수입니다.

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: api-server
```

이 설정 없이 클러스터를 업그레이드했다가 모든 파드가 동시에 종료되어 서비스가 5분간 다운된 경험이 있습니다.

## 네임스페이스별 ResourceQuota

멀티 팀 환경에서 특정 팀이 클러스터 리소스를 독점하는 것을 방지합니다.

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    count/pods: "20"
```

## 모니터링과 알림

Prometheus + Grafana 조합을 사용하고 있으며, 다음 메트릭을 핵심으로 모니터링합니다.

| 메트릭 | 임계값 | 조치 |
|--------|--------|------|
| Pod Restart Count | 5회/시간 | 즉시 알림 |
| CPU Throttling | 70% 이상 | 리소스 검토 |
| Memory Working Set | limits의 80% | 메모리 누수 확인 |
| PVC 사용률 | 80% 이상 | 용량 확장 |

## 마무리

쿠버네티스 운영은 한 번에 완벽하게 설정하기 어렵습니다. 장애를 겪고, 배우고, 개선하는 과정이 반복됩니다. 다음 포스트에서는 Helm Chart 구조화와 GitOps 워크플로우에 대해 더 자세히 다루겠습니다.
